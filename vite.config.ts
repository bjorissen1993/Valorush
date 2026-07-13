import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function readJsonBody(req: import("http").IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function twitchDevRoutes(env: Record<string, string>): Plugin {
  return {
    name: "twitch-dev-routes",
    configureServer(server) {
      server.middlewares.use("/api/twitch/token", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        const clientId = env.VITE_TWITCH_CLIENT_ID?.trim();
        const clientSecret = env.VITE_TWITCH_CLIENT_SECRET?.trim();

        if (!clientId || !clientSecret) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error:
                "Set VITE_TWITCH_CLIENT_ID and VITE_TWITCH_CLIENT_SECRET in .env.local, then restart the dev server.",
            })
          );
          return;
        }

        try {
          const body = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "client_credentials",
          });

          const twitchResponse = await fetch(
            "https://id.twitch.tv/oauth2/token",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body,
            }
          );

          const payload = await twitchResponse.text();
          res.statusCode = twitchResponse.status;
          res.setHeader("Content-Type", "application/json");
          res.end(payload);
        } catch {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({ error: "Failed to reach Twitch token endpoint." })
          );
        }
      });

      server.middlewares.use("/api/twitch/oauth/token", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        const clientId = env.VITE_TWITCH_CLIENT_ID?.trim();
        const clientSecret = env.VITE_TWITCH_CLIENT_SECRET?.trim();

        if (!clientId || !clientSecret) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error:
                "Set VITE_TWITCH_CLIENT_ID and VITE_TWITCH_CLIENT_SECRET in .env.local for OAuth sign-in.",
            })
          );
          return;
        }

        try {
          const json = (await readJsonBody(req)) as {
            code?: string;
            redirect_uri?: string;
            code_verifier?: string;
          };

          if (!json.code || !json.redirect_uri || !json.code_verifier) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Missing OAuth parameters." }));
            return;
          }

          const body = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code: json.code,
            grant_type: "authorization_code",
            redirect_uri: json.redirect_uri,
            code_verifier: json.code_verifier,
          });

          const twitchResponse = await fetch(
            "https://id.twitch.tv/oauth2/token",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body,
            }
          );

          const payload = await twitchResponse.text();
          res.statusCode = twitchResponse.status;
          res.setHeader("Content-Type", "application/json");
          res.end(payload);
        } catch {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({ error: "Failed to exchange Twitch OAuth code." })
          );
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const lobbyPort = env.LOBBY_PORT?.trim() || "3001";

  return {
    cacheDir: ".vite",
    build: {
      emptyOutDir: true,
    },
    plugins: [react(), twitchDevRoutes(env)],
    server: {
      host: true,
      proxy: {
        "/ws": {
          target: `ws://localhost:${lobbyPort}`,
          ws: true,
        },
      },
    },
    preview: {
      host: true,
      proxy: {
        "/ws": {
          target: `ws://localhost:${lobbyPort}`,
          ws: true,
        },
      },
    },
    test: {
      envFile: false,
    },
  };
});
