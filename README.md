# ELearning

Internal automation control dashboard for Andrew Biggs, EdLearning, and Speexx. Standalone Docker stack with encrypted job history, multi-user auth, and parallel worker dispatch.

## Stack

- **Web**: Next.js 15, shadcn/Radix, SQLite (Drizzle), Better Auth
- **Workers**: FastAPI (Python 3.11) × 3
- **Access**: Tailscale-only via `learning.slynxstudio.net`

## First-time setup

```bash
# 1. Generate .env with secrets
./scripts/generate-env.sh

# 2. Edit bootstrap admin credentials
#    BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD in .env

# 3. (Optional) Install LINE Seed fonts - see Fonts section
./scripts/setup-fonts.sh

# 4. Start stack (local overlay publishes :3000 and loads .env)
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

Open `http://localhost:3000` and sign in with your bootstrap admin.

## Coolify (main)

Production deploys via `coolify.yaml` + `docker-compose.yml` on server **main**. Compose service name is **`app`** (port 3000). Coolify routes `learning.slynxstudio.net` over Tailscale.

## Tailscale deployment

1. Install Tailscale on the server and join your tailnet.
2. Point `learning.slynxstudio.net` DNS to the server Tailscale IP.
3. Host nginx proxies Tailscale `:443` to the `app` container (container IP changes after each deploy).

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

## Fonts (LINE Seed Sans)

Fonts are committed under `apps/web/public/fonts/` for Docker builds. To refresh from npm packages:

```bash
./scripts/setup-fonts.sh
```

The UI falls back to system sans-serif until fonts load.

## Development (without Docker)

Local dev on Google Drive paths with parentheses may fail to build `better-sqlite3`. Prefer Docker, or clone outside synced folders.

```bash
cd apps/web
cp ../../.env.example .env.local
# Fill ENCRYPTION_KEY, INTERNAL_API_KEY, BETTER_AUTH_SECRET
npm install --legacy-peer-deps
npm run db:migrate
npm run db:seed
npm run dev
```

Python workers (`worker-andrewbiggs`, `worker-edlearning`, `worker-speexx`):

```bash
pip install -r requirements.txt
INTERNAL_API_KEY=your-key uvicorn app.main:app --port 8001
```

## Roles

| Role | Access |
|------|--------|
| **admin** | All pages, user management, disable users |
| **operator** | Run jobs, view history |

## Features

- **Jobs**: platform + status + date filters, DataTable history, SSE job timeline
- **Run**: one-off parallel jobs for Andrew Biggs, EdLearning (module picker), Speexx (cookie or password auth)
- **Admin**: create users, change roles, disable/enable accounts

## EdLearning worker tuning

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_CONCURRENT_JOBS` | 5 | Max concurrent jobs per worker container |
| `MAX_CONCURRENT` | 100 | Parallel EdLearning API calls inside one job |
| `MAX_RETRY` | 10000 | Retries per task API call |
| `PING_INTERVAL` | 60 | Seconds between time-ping rounds |

Smoke test (requires credentials in env):

```bash
cd services/worker-edlearning
EDLEARNING_USERNAME=... EDLEARNING_PASSWORD=... python test_client_smoke.py
```

## Project layout

```
(platform)/
├── apps/web/
├── services/worker-andrewbiggs/
├── services/worker-edlearning/
├── services/worker-speexx/
├── scripts/
│   ├── generate-env.sh
│   └── setup-fonts.sh
├── coolify.yaml
├── docker-compose.yml
├── docker-compose.local.yml
└── .env.example
```

## Health checks

- Web: `GET /api/health`
- Workers: `GET /health` (Docker internal network only)

## Known limitations

- No persistent customer account CRUD (job history only)
- Job cancel API not implemented (`cancelled` status reserved)
