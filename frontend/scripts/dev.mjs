// Starts the Next.js dev server and opens the browser once the app is ready.
// Set NO_OPEN=1 to start without opening a browser.
import { spawn } from "node:child_process";

const PORT = 3000;
const URL = `http://localhost:${PORT}`;
const win = process.platform === "win32";

const next = spawn(win ? "npx.cmd" : "npx", ["next", "dev", "-p", String(PORT)], { stdio: "inherit", shell: win });
next.on("exit", (code) => process.exit(code ?? 0));

function openBrowser() {
  const cmd = win ? ["cmd", ["/c", "start", "", URL]] : process.platform === "darwin" ? ["open", [URL]] : ["xdg-open", [URL]];
  const child = spawn(cmd[0], cmd[1], { stdio: "ignore", detached: true });
  child.on("error", () => console.log(`Open ${URL} in your browser.`));
  child.unref();
}

async function waitAndOpen() {
  if (process.env.NO_OPEN) return;
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`${URL}/login`);
      if (res.status < 500) return openBrowser();
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.log(`The app didn't respond in time. Open ${URL} yourself.`);
}
waitAndOpen();