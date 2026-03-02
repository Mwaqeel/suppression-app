CREATE TABLE IF NOT EXISTS suppression_ids (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  job_id TEXT PRIMARY KEY,
  uploaded_at TEXT NOT NULL,
  input_object_key TEXT NOT NULL,
  result_object_key TEXT,
  total_rows INTEGER NOT NULL DEFAULT 0
);
