export async function onRequestPost(ctx) {
  const { request, env } = ctx;
  const { password } = await request.json().catch(() => ({}));

  let role = null;
  if (password === env.ADMIN_PASSWORD) role = "admin";
  else if (password === env.USER_PASSWORD) role = "user";
  if (!role) return json({ ok: false, error: "Invalid password" }, 401);

  const token = await sign(env, { role, iat: Date.now() });

  // Set session cookie so normal <a href> downloads also work
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "set-cookie": `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`
  });

  return new Response(JSON.stringify({ ok: true, role, token }), { status: 200, headers });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
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
  if (Date.now() - (payload.iat || 0) > 7 * 86400000) return null; // 7 days
  return payload;
}

export function getTokenFromRequest(request) {
  // 1) Authorization header
  const h = request.headers.get("authorization");
  if (h) {
    const t = h.replace(/^Bearer\s+/i, "").trim();
    if (t) return t;
  }

  // 2) Cookie "session"
  const cookie = request.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)session=([^;]+)/);
  if (m && m[1]) return m[1];
  return "";
}

async function hmac(secret, msg) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  const bytes = new Uint8Array(sigBuf);
  let b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
