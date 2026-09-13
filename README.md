# Cloud Notes App — Module 3

A small full-stack notes application demonstrating cloud service integration: compute, database, object storage, IAM, networking, and monitoring — deployed end-to-end on a single AWS EC2 instance.

**Live app:** [add your live URL here after deployment]

## Architecture

![Architecture Diagram](docs/architecture.png)

- **Compute:** EC2 (Ubuntu) running the Node.js/Express app
- **Web Server:** Apache httpd as a reverse proxy — listens on port 80, forwards to the app on port 3000
- **Database:** MariaDB installed locally on the same EC2 instance, bound to `localhost` only — not reachable from outside the instance
- **Storage:** S3 bucket for file attachments
- **Networking:** VPC with a security group exposing only ports 22 and 80 — no database port is opened externally
- **IAM:** EC2 IAM Role scoped to `s3:PutObject`/`s3:GetObject` on just this bucket — no hardcoded AWS keys
- **Monitoring:** CloudWatch for logs and metrics; `/health` endpoint for uptime checks

## Features
- Create/list/delete notes (`/api/notes`)
- Optional file attachment per note, uploaded to S3
- Structured JSON logging (`winston`) — ready for CloudWatch ingestion
- `/health` endpoint that checks live database connectivity
- All secrets/config via environment variables — nothing hardcoded

## Local Development
```bash
git clone <this-repo-url>
cd cloud-webapp
npm install
cp .env.example .env   # fill in your local DB and AWS details
npm run dev
```
Visit `http://localhost:3000`. (Requires a local MariaDB/MySQL instance running, or point `DB_HOST` at one.)

## Deployment
Full step-by-step AWS deployment instructions: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

Covers: creating the S3 bucket, creating the IAM role, launching EC2, installing and securing MariaDB locally, deploying the app with `pm2`, configuring Apache httpd as a reverse proxy, and CloudWatch logging.

## Project Structure
```
cloud-webapp/
├── src/
│   ├── server.js      # Express app + routes
│   ├── db.js           # MariaDB connection (mysql2)
│   ├── s3.js            # S3 upload helper
│   └── logger.js        # Structured logging (winston)
├── public/
│   └── index.html        # Frontend UI
├── docs/
│   ├── architecture.png
│   └── DEPLOYMENT.md
├── .env.example
└── package.json
```

## Security Notes
- No credentials committed — `.env` is gitignored
- Production S3 access comes from the EC2 IAM Role, not access keys
- MariaDB is bound to `localhost` and never exposed to the security group/internet
- File uploads are size-limited (5MB) and typed via `multer`

## Trade-offs of this setup
MariaDB runs locally on the same EC2 instance for simplicity and free-tier cost. This means no managed backups/failover, and the database goes down if the instance does — see the notes at the end of [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for details and what you'd change for a production setup.
