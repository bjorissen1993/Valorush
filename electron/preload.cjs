const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("valorushDesktop", {
  isDesktop: true,
  mode: process.env.VALORUSH_MODE?.trim() || "host",
});
