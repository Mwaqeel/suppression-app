# Suppression Checker (Cloudflare Pages + D1 + R2)

## What this app does
- Admin logs in with password and uploads (seeds) the master suppression IDs into D1.
- User logs in with password, uploads a file of IDs (txt/csv as plain text: one ID per line).
- User clicks "Check" to generate a result CSV with status for each ID:
  - DUPLICATE_IN_UPLOAD
  - FOUND
  - NOT_FOUND
- Uploaded input files and result CSVs are stored in R2.
- Job metadata is stored in D1.

## Requirements
- Node.js installed
- Cloudflare account
- Wrangler installed (dev dependency included)

## Setup (local)
1) Install deps:
   npm install

2) Login:
   npx wrangler login

3) Create D1 database:
   npx wrangler d1 create suppression-db
   - Copy the database_id into `wrangler.jsonc` (PASTE_DB_ID_HERE)

4) Apply migrations:
   npx wrangler d1 migrations apply suppression-db

5) Create R2 bucket:
   npx wrangler r2 bucket create suppression-files

6) Run locally:
   npm run dev

## Deploy
- Deploy Pages:
  npm run deploy

Then in Cloudflare Dashboard -> Pages project -> Settings:
- Bindings:
  - D1: DB
  - R2: BUCKET
- Environment variables (Secrets):
  - USER_PASSWORD
  - ADMIN_PASSWORD
  - TOKEN_SECRET (random 32+ chars)
Redeploy after setting bindings/vars.

## Notes for 100K+ IDs
- The check endpoint batches IN() queries in chunks (default 800).
- Input file should be one ID per line (recommended for 100K+).
