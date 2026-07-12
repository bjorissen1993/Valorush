const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");
const net = require("node:net");

const isPackaged = app.isPackaged;
const appRoot = isPackaged
  ? path.join(process.resourcesPath, "app")
  : path.join(__dirname, "..");

const mode =
  process.env.VALORUSH_MODE?.trim() ||
  (process.argv.includes("--join") ? "join" : "host");

const lobbyPort = process.env.LOBBY_PORT?.trim() || "3001";
let serverProcess = null;

function waitForPort(port, timeoutMs = 20000) {
  const started = Date.now();

  return new Promise((resolve, reject) => {
    function attempt() {
      const socket = net.connect({ port: Number(port), host: "127.0.0.1" }, () => {
        socket.end();
        resolve();
      });

      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Lobby server did not start on port ${port}.`));
          return;
        }
        setTimeout(attempt, 250);
      });
    }

    attempt();
  });
}

function startLobbyServer() {
  const serverScript = path.join(appRoot, "dist-server", "index.cjs");
  const userData = app.getPath("userData");

  serverProcess = spawn(process.execPath, [serverScript], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      VALORUSH_ROOT: appRoot,
      VALORUSH_DIST: path.join(appRoot, "dist"),
      VALORUSH_USER_DATA: userData,
      LOBBY_PORT: lobbyPort,
    },
    stdio: "inherit",
  });

  serverProcess.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`Lobby server exited with code ${code}`);
    }
  });
}

function createWindow(loadTarget) {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    autoHideMenuBar: true,
    title: "ValoRush",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (loadTarget.startsWith("http")) {
    void window.loadURL(loadTarget);
  } else {
    void window.loadFile(loadTarget);
  }

  return window;
}

app.whenReady().then(async () => {
  if (mode === "join") {
    createWindow(path.join(appRoot, "dist", "index.html"));
    return;
  }

  startLobbyServer();
  await waitForPort(lobbyPort);
  createWindow(`http://127.0.0.1:${lobbyPort}/`);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
});
