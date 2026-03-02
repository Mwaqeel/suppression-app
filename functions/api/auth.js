export async function onRequestPost(ctx) {
  const { request, env } = ctx;
  const { password } = await request.json().catch(() => ({}));

  let role = null;
  if (password === env.ADMIN_PASSWORD) role = "admin";
  else if (password === env.USER_PASSWORD) role = "user";
  if (!role) return json({ ok: false, error: "Invalid password" }, 401);

  const token = await sign(env, { role, iat: Date.now() });
  return json({ ok: true, role, token });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}

// minimal HMAC token
async function sign(env, payload) {
  const secret = env.TOKEN_SECRET;
  if (!secret) throw new Error("TOKEN_SECRET missing");
  const data = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  const sig = await hmac(secret, data);
  return `${data}.${sig}`;
}

export async function verify(env, token) {
  const secret = env.TOKEN_SECRET;
  if (!secret) throw new Error("TOKEN_SECRET missing");
  const [data, sig] = (token || "").split(".");
  if (!data || !sig) return null;
  const expected = await hmac(secret, data);
  if (sig !== expected) return null;
  const payload = JSON.parse(decodeURIComponent(escape(atob(data))));
  if (Date.now() - (payload.iat || 0) > 7 * 86400000) return null;
  return payload;
}

async function hmac(secret, msg) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  const bytes = new Uint8Array(sigBuf);
  let b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
