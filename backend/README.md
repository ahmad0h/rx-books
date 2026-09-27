# RxBooks backend

NestJS API with TypeORM and MySQL. All routes are under `/api`.

```
src/
  main.ts           start-up
  app.module.ts     wires the modules together
  app.setup.ts      app-wide settings (shared with tests)
  config/           environment variables, checked at start-up
  database/         TypeORM connection to MySQL
  health/           GET /api/health (backend + database status)
test/               end-to-end tests
```

| Setting | Meaning |
|---|---|
| `DATABASE_URL` | `mysql://user:password@host:3306/rxbooks` |
| `DATABASE_TLS` | `true` in production (verified TLS to the database) |
| `PORT` | Default 3000 |
| `APP_VERSION` | Shown by the health check |

Database rules: the schema only changes through migrations (`synchronize` is off), dates are stored as `DATE` and returned as `YYYY-MM-DD` text, and money columns will be `DECIMAL`.

Run it with Docker from the repository root (see the main README).
