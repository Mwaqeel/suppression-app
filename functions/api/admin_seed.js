import { verify } from "./auth.js";

export async function onRequestPost(ctx) {
  const { request, env } = ctx;
  const auth = await getAuth(request, env);
  if (!auth || auth.role !== "admin") return json({ ok: false, error: "Unauthorized" }, 401);

  // Accept text/plain (one per line) OR JSON {ids:[...]}
  const ct = request.headers.get("content-type") || "";
  let ids = [];
  if (ct.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    ids = Array.isArray(body.ids) ? body.ids : [];
  } else {
    const txt = await request.text();
    ids = txt.split(/\r?\n/);
  }

  const cleaned = normalize(ids);
  if (!cleaned.length) return json({ ok: false, error: "No IDs found" }, 400);

  const now = new Date().toISOString();
  const chunk = 800;
  for (let i = 0; i < cleaned.length; i += chunk) {
    const part = cleaned.slice(i, i + chunk);
    const placeholders = part.map(() => "(?, ?)").join(", ");
    const sql = `INSERT OR IGNORE INTO suppression_ids (id, created_at) VALUES ${placeholders}`;
    const params = [];
    for (const id of part) params.push(id, now);
    await env.DB.prepare(sql).bind(...params).run();
  }

  return json({ ok: true, received: cleaned.length });
}

async function getAuth(request, env) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return token ? await verify(env, token) : null;
}

function normalize(ids) {
  const out = [];
  const seen = new Set();
  for (const x of ids || []) {
    const id = String(x ?? "").trim();
    if (!id) continue;
    const n = id.toUpperCase();
    if (!seen.has(n)) { seen.add(n); out.push(n); }
  }
  return out;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
