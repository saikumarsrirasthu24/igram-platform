# iGram Digital Hub — Full-Stack Platform

Complete platform: frontend + backend + database + tests. **ZERO npm dependencies** —
runs on pure Node.js built-ins. No `npm install` needed.

## Requirements
- Node.js >= 22.5 (for built-in SQLite)

## Run locally (10 seconds)
```bash
node server.js
# → http://localhost:3000
```

## Run tests
```bash
npm test          # 29 API + frontend tests
```

## Admin login
| Field    | Value          |
|----------|----------------|
| Phone    | 8106442080     |
| Password | igram@2025     |

Change password: set `ADMIN_PASSWORD` env var **before first boot** (it seeds on first run),
or update the user row in `igram.db`.

## Environment variables
| Var            | Default                | Purpose                       |
|----------------|------------------------|-------------------------------|
| PORT           | 3000                   | Server port                   |
| JWT_SECRET     | (dev value)            | MUST set in production        |
| ADMIN_PASSWORD | igram@2025             | Admin seed password           |

## Deploy options

### A) Render.com (free tier, recommended)
1. Push this folder to a GitHub repo
2. Render → New → Web Service → connect repo
3. Build command: *(leave empty)* · Start command: `node server.js`
4. Add env vars `JWT_SECRET` + `ADMIN_PASSWORD`
5. Done — live URL in ~2 min. Point igram.digital via CNAME.

### B) Railway.app
Same as Render: new project → deploy from GitHub → start `node server.js`.

### C) Any VPS (DigitalOcean/Hetzner/EC2, ₹300-500/mo)
```bash
# on server with Node 22+
git clone <repo> && cd igram-fullstack
JWT_SECRET="long-random-string" node server.js
# production: use pm2 → pm2 start server.js --name igram
```

### D) Docker
```bash
docker build -t igram . && docker run -p 3000:3000 igram
```

> ⚠️ Shared cPanel hosting (GoDaddy Economy) cannot run Node.js.
> Use Render/Railway free tier and point the igram.digital domain there.

## Data
All data lives in `igram.db` (SQLite, WAL mode) next to server.js.
Back it up by copying that one file. Tables: users, bookings, farmers,
machine_owners, applications, mitra_applications, activity_log.

## Access model
| Who | Can do |
|-----|--------|
| **Public (no account)** | Browse all pages · Send Service Request form · Send Contact form |
| **Public User account** | Book AgriUber equipment · Apply for iGovt services · Track own bookings/applications (`/api/my/*`) · User Dashboard |
| **iGram Mitra account** | Mitra Portal (cases, earnings, training) |
| **Service Provider account** | Provider Portal (listings, bookings, calendar) |
| **Admin account** | Admin ERP: all data, contacts, requests, status updates, stats |

Dashboards auto-redirect to signin.html if not logged in with the correct role.
Sessions stored in localStorage (token, 7-day expiry).

## API quick reference
| Method | Endpoint                        | Auth   | Purpose                  |
|--------|---------------------------------|--------|--------------------------|
| POST   | /api/auth/register              | —      | Create account           |
| POST   | /api/auth/login                 | —      | Login → JWT              |
| GET    | /api/auth/me                    | token  | My profile               |
| POST   | /api/bookings                   | —      | AgriUber booking         |
| GET    | /api/bookings/track/:ref        | —      | Track booking            |
| GET    | /api/bookings                   | admin  | List all bookings        |
| PATCH  | /api/bookings/:id/status        | admin  | Update status            |
| POST   | /api/farmers                    | —      | Farmer registration      |
| POST   | /api/owners                     | —      | Machine owner reg.       |
| POST   | /api/applications               | —      | iGovt application        |
| GET    | /api/applications/track/:ref    | —      | Track application        |
| POST   | /api/mitra/apply                | —      | Mitra application        |
| GET    | /api/admin/stats                | admin  | Dashboard KPIs           |
| GET    | /api/admin/activity             | admin  | Activity feed            |
| POST   | /api/requests                   | —      | Public service request   |
| POST   | /api/contact                    | —      | Public contact message   |
| GET    | /api/my/bookings                | token  | My own bookings          |
| GET    | /api/my/applications            | token  | My own applications      |
| GET    | /api/contacts                   | admin  | All contact messages     |
| GET    | /api/requests                   | admin  | All service requests     |
| GET    | /api/health                     | —      | Uptime check             |
