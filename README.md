# RxBooks

Bookkeeping platform for independent pharmacies.

| Folder | What it is |
|---|---|
| `backend/` | NestJS API with TypeORM and MySQL |
| `frontend/` | One React + Ant Design app with two role areas: `/admin` (staff) and `/client` (pharmacy owners) |
| `docker-compose.yml` | Runs MySQL, backend and frontend together |
| `docker-compose.dev.yml` | Same, with hot reload for development |

The only requirement is Docker Desktop.

## First run

```bash
cp .env.example .env          # then replace the two passwords (letters and numbers only)
docker compose up --build
```

- App: http://localhost:8080 (admin area `/admin`, client area `/client`)
- Backend health check: http://localhost:3000/api/health

### Signing in

Open the app and sign in. Admins land in `/admin`, pharmacy owners in `/client`; each area is closed to the other role.

Two demo users are created on start-up when `DEMO_USERS_ENABLED=true` (local development only). Their emails and passwords are the `DEMO_*` values in your `.env`:

```bash
grep DEMO_ .env
```

Stop with `Ctrl+C`, or `docker compose down`. Data stays in the `mysql-data` volume; `docker compose down -v` deletes it.

## Running the frontend on your Mac (without Docker)

Needs Node 24 (Vite needs at least 20.19). With nvm, `nvm install` / `nvm use` in the repo picks it up from `.nvmrc`.

```bash
docker compose up -d mysql backend      # backend + database in Docker
cd frontend && npm ci && npm run dev     # http://localhost:5173
```

If `npm run dev` says "Cannot find native binding", `node_modules` was installed with an older Node: delete `frontend/node_modules` and run `npm ci` again. Keep `package-lock.json`.

## Development (hot reload)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

- App: http://localhost:5173
- Backend: http://localhost:3000 (restarts on save)

After changing a `package.json`, add `-V` so the `node_modules` volumes are rebuilt.

## Checks

Run inside Docker so your local Node version doesn't matter:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm backend sh -c "npm run lint && npm test && npm run test:e2e && npm run build"
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm --no-deps frontend sh -c "npm run lint && npm run build"
```

The same checks run on GitHub for every push (`.github/workflows/ci.yml`).

## Database changes (migrations)

The schema only changes through migrations in `backend/src/database/migrations/`, listed in `backend/src/database/database.config.ts`. Pending migrations run automatically when the backend starts. To see which have run:

```bash
docker compose exec backend npm run migration:show
```

## Status

The phase plan, what is done and what was left for later are in [TASKS.md](TASKS.md).
