// Launcher that removes ELECTRON_RUN_AS_NODE before starting Electron.
// VS Code sets this variable, which forces Electron to run as plain Node.js.
delete process.env.ELECTRON_RUN_AS_NODE;
const electron = require("electron");
const { spawn } = require("child_process");
const child = spawn(electron, ["."], { stdio: "inherit" });
child.on("close", (code) => process.exit(code));
