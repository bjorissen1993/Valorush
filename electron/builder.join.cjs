const base = require("./builder.base.cjs");

/** @type {import('electron-builder').Configuration} */
module.exports = {
  ...base,
  productName: "ValoRush",
  extraMetadata: {
    main: "electron/main.cjs",
  },
};
