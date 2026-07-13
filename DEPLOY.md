# ValoRush — Railway deployment

Single source of truth: **`Dockerfile`** + minimal **`railway.json`**.

Railway builds with the Dockerfile and starts the container with `CMD ["node", "dist-server/index.cjs"]`. Do not override start command or health check in the dashboard unless you know exactly why.

## One-time Railway dashboard checklist

Do this once per service (Settings → Deploy):

1. **Builder** → **Dockerfile** (path: `Dockerfile`). Not Nixpacks.
2. **Custom Start Command** → **empty / cleared**. The Dockerfile `CMD` must run.
3. **Healthcheck path** → **empty / cleared**. Railway uses a **TCP probe on `$PORT`**, not HTTP `/api/health`.
4. **Do not set `PORT` manually** in Railway variables. Railway injects it automatically.
5. **Networking** → target port should follow **`$PORT`** (default / auto), not a hardcoded value unless Railway support told you otherwise.

If any of the above are stale from earlier attempts, you may see errors like:

- `The executable "apihealth_port=$port" could not be found`
- `The executable "jobby_port=$port" could not be found`

Those mean Railway is trying to run a mangled healthcheck/start string as a binary — clear the dashboard overrides above and redeploy.

## Deploy workflow

```bash
git push origin main
```

Railway redeploys from `main`. No manual build steps on the platform.

## Local smoke test (optional)

```bash
npm ci
node scripts/build-production.mjs
node dist-server/index.cjs
```

Then open `http://localhost:3001/api/health` (or whatever `PORT` you set).

## Files intentionally unused on Railway

- `nixpacks.toml` — kept for reference only; **ignored** when `railway.json` sets `"builder": "DOCKERFILE"`.
