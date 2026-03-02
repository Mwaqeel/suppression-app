import { verify } from "./auth.js";

export async function onRequestPost(ctx) {
  const { request, env } = ctx;
  const auth = await getAuth(request, env);
  if (!auth) return json({ ok: false, error: "Unauthorized" }, 401);

  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") return json({ ok: false, error: "file missing" }, 400);

  const jobId = crypto.randomUUID();
  const uploadedAt = new Date().toISOString();

  const buf = await file.arrayBuffer();
  const safeName = (file.name || "upload.txt").replace(/[^a-z0-9._-]/gi, "_");
  const inputKey = `inputs/${jobId}_${safeName}`;

  await env.BUCKET.put(inputKey, buf, { httpMetadata: { contentType: "text/plain" } });

  await env.DB.prepare(
    `INSERT INTO jobs (job_id, uploaded_at, input_object_key, total_rows) VALUES (?, ?, ?, 0)`
  ).bind(jobId, uploadedAt, inputKey).run();

  return json({ ok: true, job_id: jobId });
}

async function getAuth(request, env) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return token ? await verify(env, token) : null;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
