/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: "com.valorush.app",
  directories: {
    output: "release",
  },
  files: [
    "dist/**/*",
    "electron/**/*",
    "package.json",
  ],
  win: {
    target: [
      { target: "nsis", arch: ["x64"] },
      { target: "portable", arch: ["x64"] },
    ],
    signAndEditExecutable: false,
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    artifactName: "${productName}-Setup-${version}.${ext}",
  },
  portable: {
    artifactName: "${productName}-Portable-${version}.${ext}",
  },
};
