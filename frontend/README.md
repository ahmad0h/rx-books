# RxBooks frontend

One React + Ant Design app for everyone. The user's role decides which area they see:

| Path | Area | Who |
|---|---|---|
| `/admin` | Admin console | RxBooks staff (admin role) |
| `/client` | Client console | Pharmacy owners (client role) |

Sign-in and the role checks arrive in Phase 2; until then `/` links to both areas.

```
src/
  main.tsx        app entry (theme, router)
  router.tsx      all routes
  admin/          admin area (layout + pages)
  client/         client area (layout + pages)
  pages/          start page, 404
  shared/         pieces used by both areas (page frame, system status)
  theme.ts        brand colours for Ant Design
```

Run it with Docker from the repository root (see the main README).
