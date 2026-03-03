import { verify, getTokenFromRequest } from "./auth.js";

export async function onRequestPost(ctx) {
  const { request, env } = ctx;
  const auth = await getAuth(request, env);
  if (!auth) return json({ ok: false, error: "Unauthorized" }, 401);

  const { job_id } = await request.json().catch(() => ({}));
  const jobId = String(job_id || "");
  if (!jobId) return json({ ok: false, error: "job_id missing" }, 400);

  const job = await env.DB.prepare(`SELECT * FROM jobs WHERE job_id = ?`).bind(jobId).first();
  if (!job) return json({ ok: false, error: "job not found" }, 404);

  const obj = await env.BUCKET.get(job.input_object_key);
  if (!obj) return json({ ok: false, error: "input missing" }, 500);

  const text = await obj.text();

  const rows = [];
  const seen = new Set();
  const dup = new Set();

  for (const line of text.split(/\r?\n/)) {
    const original = (line ?? "").toString().trim();
    if (!original) continue;
    const n = original.toUpperCase();
    rows.push({ original, n });
    if (seen.has(n)) dup.add(n); else seen.add(n);
  }

  const exists = await fetchExists(env.DB, Array.from(seen), 800);

  const header = "id,normalized_id,status,duplicate_in_upload,in_suppression\n";
  const parts = [header];

  for (const r of rows) {
    const isDup = dup.has(r.n);
    const inSup = exists.has(r.n);
    const status = isDup ? "DUPLICATE_IN_UPLOAD" : (inSup ? "FOUND" : "NOT_FOUND");
    parts.push(csvLine([r.original, r.n, status, isDup ? "YES" : "NO", inSup ? "YES" : "NO"]));
  }

  const csv = parts.join("");

  const resultKey = `results/${jobId}.csv`;
  await env.BUCKET.put(resultKey, csv, { httpMetadata: { contentType: "text/csv" } });

  await env.DB.prepare(
    `UPDATE jobs SET result_object_key = ?, total_rows = ? WHERE job_id = ?`
  ).bind(resultKey, rows.length, jobId).run();

  return json({ ok: true, job_id: jobId, total_rows: rows.length });
}

export async function onRequestGet(ctx) {
  const { request, env } = ctx;
  const auth = await getAuth(request, env);
  if (!auth) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const jobId = url.searchParams.get("job_id") || "";
  if (!jobId) return new Response("job_id missing", { status: 400 });

  const job = await env.DB.prepare(`SELECT * FROM jobs WHERE job_id = ?`).bind(jobId).first();
  if (!job || !job.result_object_key) return new Response("result not ready", { status: 404 });

  const obj = await env.BUCKET.get(job.result_object_key);
  if (!obj) return new Response("result missing", { status: 500 });

  return new Response(obj.body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="result_${jobId}.csv"`
    }
  });
}

async function getAuth(request, env) {
  const token = getTokenFromRequest(request);
  return token ? await verify(env, token) : null;
}

async function fetchExists(db, ids, chunkSize) {
  const set = new Set();
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "?").join(",");
    const sql = `SELECT id FROM suppression_ids WHERE id IN (${placeholders})`;
    const res = await db.prepare(sql).bind(...chunk).all();
    for (const row of res.results || []) set.add(row.id);
  }
  return set;
}

function csvLine(cols) {
  const esc = (s) => {
    s = String(s ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return cols.map(esc).join(",") + "\n";
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
