# ValoRush — Railway deployment

Single source of truth: **`railway.json`** + **`Dockerfile`**.

All deploy settings live in `railway.json` (config-as-code). The Railway dashboard will show fields as locked/read-only with “The value is set in ./railway.json” — that is expected. Do not try to edit builder, build command, start command, or healthcheck in the dashboard.

## What Railway runs

| Setting | Source | Value |
|---------|--------|-------|
| Builder | `railway.json` → `build.builder` | `DOCKERFILE` |
| Dockerfile | `railway.json` → `build.dockerfilePath` | `Dockerfile` |
| Build command | Dockerfile `RUN` steps | `node scripts/build-production.mjs` |
| Start command | Dockerfile `CMD` | `node dist-server/index.cjs` |
| Health check | Railway default | TCP probe on injected `$PORT` |
| Restart policy | `railway.json` → `deploy` | ON_FAILURE, max 10 retries |

Stale Nixpacks/build/start/healthcheck overrides are explicitly cleared with `null` in `railway.json` so Railway does not keep old values from earlier commits.

## Deploy workflow

```bash
git push origin main
```

Railway redeploys from `main`. No manual dashboard changes required.

## Required Railway variables

Set these in the Railway service **Variables** tab. They are used at **Docker build time** (baked into the Vite client) and at **runtime** (server-side OAuth token exchange).

| Variable | Required | Notes |
|----------|----------|-------|
| `VITE_TWITCH_CLIENT_ID` | Yes | Twitch app Client ID. Must match the redirect URI registered in the [Twitch developer console](https://dev.twitch.tv/console/apps). |
| `VITE_TWITCH_CLIENT_SECRET` | Yes | Used by the production server at `/api/twitch/oauth/token` (not exposed in the browser bundle for OAuth). |
| `VITE_TWITCH_REDIRECT_URI` | Yes (production) | Exact callback URL, e.g. `https://valorush.freakydev.com/`. Must be registered in the Twitch app. |
| `PORT` | Auto | Injected by Railway; do not override unless you know why. |

`VITE_*` variables are embedded during `node scripts/build-production.mjs` inside the Docker builder stage. The `Dockerfile` declares them as `ARG`/`ENV` so Railway passes them into the image build. Changing a `VITE_*` value requires a **redeploy** (rebuild), not just a service restart.

After setting variables, trigger a fresh deploy and confirm Twitch Link is enabled on the lobby identity screen (no `.env.local` hint).

## Local smoke test

```bash
npm ci
node scripts/build-production.mjs
node dist-server/index.cjs
```

Then open `http://localhost:3001/api/health` (or whatever `PORT` you set).

## Troubleshooting mangled executable errors

If deploy logs show errors like:

- `The executable '$PORT:$PORT' could not be found`
- `The executable "apihealth_port=$port" could not be found`

Railway was treating a healthcheck or port string as an exec-form start command (no shell). Common causes that are now fixed in this repo:

1. **`healthcheckPath` in `railway.json`** — removed; set to `null`. Use Railway’s TCP probe instead.
2. **`HEALTHCHECK` in Dockerfile** — removed. Railway misparses it as a start command.
3. **`startCommand` override with `$PORT`** — removed; set to `null`. The app reads `process.env.PORT` inside Node; no shell expansion needed.
4. **Stale Nixpacks `buildCommand` / `startCommand`** — cleared with explicit `null` values after switching to Dockerfile.

After pushing an updated `railway.json`, trigger a fresh deploy. Settings should show Dockerfile builder and empty/null overrides.

## Files not used on Railway

- `nixpacks.toml` — local reference only; ignored when `build.builder` is `DOCKERFILE`.
