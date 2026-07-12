const base = require("./builder.base.cjs");

/** @type {import('electron-builder').Configuration} */
module.exports = {
  ...base,
  productName: "ValoRush Host",
  extraMetadata: {
    main: "electron/main.cjs",
  },
  files: [
    ...(base.files ?? []),
    "dist-server/**/*",
  ],
};
