let token = localStorage.getItem("token") || "";
let role = localStorage.getItem("role") || "";
let jobId = "";

const $ = (id) => document.getElementById(id);
const show = (el) => el.classList.remove("hidden");
const hide = (el) => el.classList.add("hidden");
const msg = (el, t) => el.textContent = t || "";

async function api(url, opts = {}) {
  opts.headers = opts.headers || {};
  if (token) opts.headers["authorization"] = `Bearer ${token}`;
  return fetch(url, opts);
}

function render() {
  if (!token) { show($("loginCard")); hide($("appCard")); return; }
  hide($("loginCard")); show($("appCard"));
  $("roleBadge").textContent = `Role: ${role}`;
  if (role === "admin") show($("adminBlock")); else hide($("adminBlock"));
}

$("loginBtn").onclick = async () => {
  msg($("loginMsg"), "");
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: $("password").value })
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) return msg($("loginMsg"), data.error || "Login failed");

  token = data.token; role = data.role;
  localStorage.setItem("token", token);
  localStorage.setItem("role", role);
  render();
};

$("logoutBtn").onclick = () => {
  token = ""; role = ""; jobId = "";
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  render();
};

$("seedBtn").onclick = async () => {
  msg($("seedMsg"), "Uploading...");
  const res = await api("/api/admin_seed", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: $("adminIds").value || ""
  });
  const data = await res.json().catch(() => ({}));
  msg($("seedMsg"), data.ok ? `Done. Received: ${data.received}` : (data.error || "Failed"));
};

$("uploadBtn").onclick = async () => {
  msg($("statusMsg"), "");
  hide($("downloadLink")); hide($("checkBtn"));
  const file = $("file").files[0];
  if (!file) return msg($("statusMsg"), "Select file first.");

  const fd = new FormData();
  fd.append("file", file);

  const res = await api("/api/upload", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) return msg($("statusMsg"), data.error || "Upload failed");

  jobId = data.job_id;
  msg($("statusMsg"), `Uploaded. Job: ${jobId}`);
  show($("checkBtn"));
};

$("checkBtn").onclick = async () => {
  msg($("statusMsg"), "Checking (100K+ may take some time) ...");
  hide($("downloadLink"));

  const res = await api("/api/check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ job_id: jobId })
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) return msg($("statusMsg"), data.error || "Check failed");

  msg($("statusMsg"), `Done. Rows: ${data.total_rows}`);
  $("downloadLink").href = `/api/check?job_id=${encodeURIComponent(jobId)}`;
  $("downloadLink").textContent = "Download Result CSV";
  show($("downloadLink"));
};

render();
