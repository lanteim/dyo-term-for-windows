"use strict";
// dyo-term main process.
// Security model: the renderer runs with contextIsolation ON and no node
// integration. Everything privileged (pty, systeminformation, fs, window
// control) is reached only through the typed bridge in preload.js over IPC.
// The pty is streamed over IPC — there is no local socket/server at all.

const {app, BrowserWindow, ipcMain, screen, shell, Menu, nativeTheme, dialog} = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const {execFile} = require("child_process");
const pty = require("node-pty");
const sshdetect = require("./sshdetect.js");
const si = require("systeminformation");
const platform = require("./platform");
const {windowOptions, menuTemplate} = platform;

if (process.env.DYOTERM_USER_DATA) {
    app.setPath("userData", path.resolve(process.env.DYOTERM_USER_DATA));
}
const backgroundMode = process.env.DYOTERM_BACKGROUND === "1";
if (backgroundMode && process.platform === "darwin") {
    app.setActivationPolicy("accessory");
}

const USER_DIR = app.getPath("userData");
const SETTINGS_FILE = path.join(USER_DIR, "settings.json");
const NOTES_FILE = path.join(USER_DIR, "notes.txt");
const USER_THEMES_DIR = path.join(USER_DIR, "themes");
const BUILTIN_THEMES_DIR = path.join(__dirname, "..", "renderer", "themes");

let win = null;
const ptys = new Map();      // id -> {proc, cwd}
let ptySeq = 0;

// ---------------------------------------------------------------- settings ---

const DEFAULT_SETTINGS = {
    shell: platform.defaultShell(),
    shellArgs: platform.defaultShellArgs(),
    cwd: app.getPath("home"),
    theme: "stark",
    fontFamily: "JetBrains Mono",
    fontSize: 14,
    cursorStyle: "bar",
    cursorBlink: true,
    forceFullscreen: false,
    layout: null      // saved widget layout (gridstack serialization)
};

function readJSON(file, fallback) {
    try {
        return JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch (e) {
        return fallback;
    }
}

function loadSettings() {
    return Object.assign({}, DEFAULT_SETTINGS, readJSON(SETTINGS_FILE, {}));
}

function saveSettings(patch) {
    const merged = Object.assign(loadSettings(), patch);
    fs.mkdirSync(USER_DIR, {recursive: true});
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2));
    return merged;
}

// ---------------------------------------------------------------- shell env ---

// Capture the login shell environment (GUI apps launch with a minimal env).
// Degrades to process.env instead of failing.
function getLoginEnv(shellPath) {
    return new Promise(resolve => {
        // pwsh/powershell/cmd have no `-ilc`; Electron already inherits the full
        // user env on Windows, so skip the login-shell capture there.
        if (process.platform === "win32") {
            const env = Object.assign({}, process.env);
            env.TERM = "xterm-256color";
            env.COLORTERM = "truecolor";
            env.TERM_PROGRAM = "dyo-term";
            env.TERM_PROGRAM_VERSION = app.getVersion();
            return resolve(env);
        }
        execFile(shellPath, ["-ilc", "command env; exit 0"], {timeout: 8000, maxBuffer: 4 * 1024 * 1024}, (err, stdout) => {
            const env = Object.assign({}, process.env);
            if (!err && stdout) {
                stdout.split("\n").forEach(line => {
                    const i = line.indexOf("=");
                    if (i > 0) env[line.slice(0, i)] = line.slice(i + 1);
                });
            }
            env.TERM = "xterm-256color";
            env.COLORTERM = "truecolor";
            env.TERM_PROGRAM = "dyo-term";
            env.TERM_PROGRAM_VERSION = app.getVersion();
            resolve(env);
        });
    });
}
let loginEnvPromise = null;

// ------------------------------------------------------------------- window ---

function createWindow(settings) {
    const display = screen.getPrimaryDisplay();
    const {width, height} = display.workAreaSize;
    win = new BrowserWindow({
        // In background/test mode the window is created fully off-screen so it
        // never flashes over whatever the user is doing; it still renders and
        // can be screenshotted via CDP.
        x: backgroundMode ? -8000 : undefined,
        y: backgroundMode ? -8000 : undefined,
        width: Math.min(1600, width),
        height: Math.min(1000, height),
        minWidth: 900,
        minHeight: 600,
        backgroundColor: "#05070a",
        fullscreenable: true,
        fullscreen: settings.forceFullscreen || false,
        show: false,
        paintWhenInitiallyHidden: true,
        ...windowOptions(process.platform),
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            backgroundThrottling: false,
            spellcheck: false
        }
    });

    win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

    win.once("ready-to-show", () => {
        if (backgroundMode) {
            // Keep it off-screen and never bring it forward
            win.setPosition(-8000, -8000);
            win.showInactive();
        } else {
            win.show();
            win.focus();
        }
    });

    win.webContents.setWindowOpenHandler(({url}) => {
        openExternalSafe(url);
        return {action: "deny"};
    });
    win.webContents.on("will-navigate", (e, url) => {
        if (url !== win.webContents.getURL()) e.preventDefault();
    });
}

function openExternalSafe(url) {
    try {
        const u = new URL(url);
        if (["http:", "https:", "mailto:"].includes(u.protocol)) shell.openExternal(url);
    } catch (e) { /* ignore */ }
}

// --------------------------------------------------------------------- pty ---

function killAllPtys() {
    for (const {proc} of ptys.values()) {
        try { proc.kill(); } catch (e) { /* already dead */ }
    }
    ptys.clear();
}

function registerIpc() {
    ipcMain.handle("pty:spawn", async (e, opts = {}) => {
        const settings = loadSettings();
        if (!loginEnvPromise) loginEnvPromise = getLoginEnv(settings.shell);
        const env = await loginEnvPromise;

        const id = "pty" + (++ptySeq);
        const cwd = (opts.cwd && fs.existsSync(opts.cwd)) ? opts.cwd
            : (fs.existsSync(settings.cwd) ? settings.cwd : os.homedir());
        const args = Array.isArray(settings.shellArgs) ? settings.shellArgs
            : (typeof settings.shellArgs === "string" && settings.shellArgs.trim() ? settings.shellArgs.trim().split(/\s+/) : platform.defaultShellArgs(settings.shell));

        const proc = pty.spawn(settings.shell, args, {
            name: "xterm-256color",
            cols: opts.cols || 80,
            rows: opts.rows || 24,
            cwd,
            env
        });
        ptys.set(id, {proc, cwd});

        proc.onData(data => {
            if (win && !win.isDestroyed()) win.webContents.send("pty:data", id, data);
        });
        proc.onExit(({exitCode, signal}) => {
            ptys.delete(id);
            if (win && !win.isDestroyed()) win.webContents.send("pty:exit", id, exitCode, signal);
        });

        return {id, pid: proc.pid};
    });

    ipcMain.on("pty:input", (e, id, data) => {
        const t = ptys.get(id);
        if (t) t.proc.write(data);
    });
    ipcMain.on("pty:resize", (e, id, cols, rows) => {
        const t = ptys.get(id);
        if (t) { try { t.proc.resize(cols, rows); } catch (err) { /* transient */ } }
    });
    ipcMain.on("pty:kill", (e, id) => {
        const t = ptys.get(id);
        if (t) { try { t.proc.kill(); } catch (err) { /* dead */ } ptys.delete(id); }
    });

    // Current working directory of a pty (for the file/title widgets)
    ipcMain.handle("pty:cwd", async (e, id) => {
        const t = ptys.get(id);
        if (!t) return null;
        return platform.cwdOf(t.proc.pid);
    });

    // Detect the ssh session a pane is connected to, so A.Petrov widgets can
    // read metrics from THAT server (per active tab). macOS/Linux only.
    ipcMain.handle("pty:sshTarget", (e, id) => {
        if (process.platform === "win32") return null;
        const t = ptys.get(id);
        if (!t) return null;
        try { return sshdetect.detectSshUnderPid(t.proc.pid); } catch (err) { return null; }
    });

    // Run a single command on a remote host over ssh, reusing the pane's own
    // connection args. BatchMode so it never blocks on a password prompt; it
    // relies on the user's keys/agent/ssh config. argv array → no shell inject.
    ipcMain.handle("ssh:exec", async (e, sshArgs, command, opts = {}) => {
        const env = loginEnvPromise ? await loginEnvPromise : process.env;
        const base = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=8", "-o", "StrictHostKeyChecking=accept-new"];
        const args = [...base, ...(Array.isArray(sshArgs) ? sshArgs : []), String(command || "")];
        return new Promise(resolve => {
            execFile("ssh", args, { env, timeout: opts.timeout || 10000, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
                resolve({
                    code: err ? (typeof err.code === "number" ? err.code : 1) : 0,
                    stdout: String(stdout || ""),
                    stderr: String(stderr || (err && err.message) || "")
                });
            });
        });
    });

    // systeminformation, allowlisted by property lookup
    ipcMain.handle("si", async (e, type, ...args) => {
        if (typeof si[type] !== "function") return null;
        try { return await si[type](...args); } catch (err) { return null; }
    });

    // settings + notes
    ipcMain.handle("settings:get", () => loadSettings());
    ipcMain.handle("settings:set", (e, patch) => saveSettings(patch || {}));
    ipcMain.handle("notes:get", () => { try { return fs.readFileSync(NOTES_FILE, "utf-8"); } catch (e) { return ""; } });
    ipcMain.handle("notes:set", (e, text) => { try { fs.mkdirSync(USER_DIR, {recursive: true}); fs.writeFileSync(NOTES_FILE, String(text)); return true; } catch (err) { return false; } });

    // themes: builtin + user overrides
    ipcMain.handle("themes:list", () => {
        const list = {};
        for (const dir of [BUILTIN_THEMES_DIR, USER_THEMES_DIR]) {
            let files = [];
            try { files = fs.readdirSync(dir); } catch (e) { continue; }
            for (const f of files) {
                if (!f.endsWith(".json")) continue;
                const theme = readJSON(path.join(dir, f), null);
                if (theme) list[f.replace(/\.json$/, "")] = theme;
            }
        }
        return list;
    });

    // AppleScript control for the Apple Music widget
    ipcMain.handle("music:control", (e, action) => runMusic(action));
    ipcMain.handle("music:state", () => runMusic("state"));

    // window + app control
    ipcMain.handle("win", (e, action) => {
        if (!win) return null;
        switch (action) {
            case "minimize": win.minimize(); return null;
            case "toggleFullscreen": {
                const target = !(win.isFullScreen() || win.isSimpleFullScreen());
                if (win.isFullScreenable()) win.setFullScreen(target); else win.setSimpleFullScreen(target);
                return target;
            }
            case "isFullscreen": return win.isFullScreen() || win.isSimpleFullScreen();
            case "close": win.close(); return null;
            case "reload": win.webContents.reloadIgnoringCache(); return null;
            case "toggleDevTools": win.webContents.toggleDevTools(); return null;
            default: return null;
        }
    });
    ipcMain.handle("app:info", () => ({
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        noWebgl: process.env.DYOTERM_NO_WEBGL === "1",
        electron: process.versions.electron,
        node: process.versions.node,
        chrome: process.versions.chrome,
        userData: USER_DIR,
        home: app.getPath("home"),
        cpus: os.cpus().length,
        hostname: os.hostname()
    }));
    ipcMain.handle("open:path", (e, p) => shell.openPath(p));
    ipcMain.handle("open:external", (e, u) => openExternalSafe(u));

    // Run a CLI command for DevOps widgets (git, kubectl, docker, aws, …).
    // execFile with an argv array (no shell) so widget inputs can't inject.
    ipcMain.handle("exec", async (e, cmd, args = [], opts = {}) => {
        const env = loginEnvPromise ? await loginEnvPromise : process.env;
        return new Promise(resolve => {
            execFile(cmd, Array.isArray(args) ? args : [], {
                cwd: opts.cwd && fs.existsSync(opts.cwd) ? opts.cwd : app.getPath("home"),
                env,
                timeout: opts.timeout || 8000,
                maxBuffer: 8 * 1024 * 1024
            }, (err, stdout, stderr) => {
                resolve({
                    code: err ? (typeof err.code === "number" ? err.code : 1) : 0,
                    stdout: String(stdout || ""),
                    stderr: String(stderr || (err && err.message) || "")
                });
            });
        });
    });

    // Filesystem reads for file/project/log widgets (read-only)
    ipcMain.handle("fs:list", (e, dir) => {
        try {
            return fs.readdirSync(dir, { withFileTypes: true })
                .map(d => ({ name: d.name, dir: d.isDirectory(), symlink: d.isSymbolicLink() }));
        } catch (err) { return { error: err.message }; }
    });
    ipcMain.handle("fs:read", (e, p, maxBytes = 500000) => {
        try {
            const st = fs.statSync(p);
            if (st.size > maxBytes) return { error: "file too large", size: st.size };
            return { content: fs.readFileSync(p, "utf-8"), size: st.size };
        } catch (err) { return { error: err.message }; }
    });
    ipcMain.handle("fs:stat", (e, p) => {
        try { const s = fs.statSync(p); return { size: s.size, dir: s.isDirectory(), mtimeMs: s.mtimeMs }; }
        catch (err) { return { error: err.message }; }
    });

    // Recursively find audio files under a folder (bounded), for the local player.
    ipcMain.handle("media:scan", (e, dir) => {
        const EXT = new Set([".mp3", ".flac", ".m4a", ".aac", ".ogg", ".oga", ".opus", ".wav", ".webm", ".wma", ".aiff", ".aif"]);
        const out = [];
        const walk = (d, depth) => {
            if (depth > 6 || out.length >= 5000) return;
            let entries;
            try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (err) { return; }
            for (const ent of entries) {
                if (out.length >= 5000) break;
                if (ent.name.startsWith(".")) continue;
                const full = path.join(d, ent.name);
                if (ent.isDirectory()) walk(full, depth + 1);
                else if (EXT.has(path.extname(ent.name).toLowerCase())) out.push({ path: full, name: ent.name });
            }
        };
        try { if (!dir || !fs.statSync(dir).isDirectory()) return { error: "not a directory" }; }
        catch (err) { return { error: err.message }; }
        walk(dir, 0);
        out.sort((a, b) => a.path.localeCompare(b.path));
        return { files: out };
    });

    // Native folder picker for the local player.
    ipcMain.handle("dialog:openDir", async () => {
        const { dialog } = require("electron");
        const r = await dialog.showOpenDialog(win, { properties: ["openDirectory"] });
        return (r.canceled || !r.filePaths.length) ? null : r.filePaths[0];
    });

    // Outbound HTTP for widgets (Prometheus, AI endpoints, etc.), routed through
    // main so the renderer CSP stays locked to 'self'.
    ipcMain.handle("http", async (e, url, opts = {}) => {
        try {
            const controller = new AbortController();
            const to = setTimeout(() => controller.abort(), opts.timeout || 12000);
            const r = await fetch(url, {
                method: opts.method || "GET",
                headers: opts.headers || {},
                body: opts.body,
                signal: controller.signal
            });
            clearTimeout(to);
            const text = await r.text();
            return { status: r.status, ok: r.ok, text };
        } catch (err) { return { error: err.message }; }
    });

    require("./db.js").register(ipcMain);
}

// NOTE: the variable is `ps`, not `st` — `st` is a reserved token in AppleScript
// and `set st to …` fails to compile (-2741), which broke every state query.
// Durations/positions/volume are coerced to integer so locales that use a comma
// decimal separator (e.g. ru_RU) don't emit "137,8" and break parseFloat.
// Tab-separated fields: state, name, artist, album, duration(int s), position(int
// s), volume(int), shuffle(bool), repeat(off/one/all), favorited(bool).
const MUSIC_STATE_SCRIPT = `tell application "Music"
if it is running then
set ps to (player state as string)
if ps is "playing" or ps is "paused" then
set fav to false
try
set fav to (favorited of current track)
end try
return ps & tab & (name of current track) & tab & (artist of current track) & tab & (album of current track) & tab & ((duration of current track) as integer) & tab & ((player position) as integer) & tab & ((sound volume) as integer) & tab & ((shuffle enabled) as string) & tab & (song repeat as string) & tab & (fav as string)
else
return ps & tab & tab & tab & tab & tab & tab & ((sound volume) as integer)
end if
else
return "notrunning"
end if
end tell`;

function runMusic(action) {
    let script;
    switch (action) {
        case "state": script = MUSIC_STATE_SCRIPT; break;
        case "playpause": script = 'tell application "Music" to playpause'; break;
        case "next": script = 'tell application "Music" to next track'; break;
        case "previous": script = 'tell application "Music" to previous track'; break;
        default:
            if (typeof action === "object" && action) {
                if (action.volume != null) {
                    script = `tell application "Music" to set sound volume to ${Math.round(action.volume)}`;
                } else if (action.seek != null) {
                    script = `tell application "Music" to set player position to ${Math.max(0, Math.round(action.seek))}`;
                } else if (action.shuffle != null) {
                    script = `tell application "Music" to set shuffle enabled to ${action.shuffle ? "true" : "false"}`;
                } else if (action.repeat != null && ["off", "one", "all"].includes(action.repeat)) {
                    script = `tell application "Music" to set song repeat to ${action.repeat}`;
                } else if (action.favorite != null) {
                    script = `tell application "Music" to set favorited of current track to ${action.favorite ? "true" : "false"}`;
                } else {
                    return Promise.resolve(null);
                }
            } else {
                return Promise.resolve(null);
            }
    }
    return new Promise(resolve => {
        execFile("osascript", ["-e", script], {timeout: 4000}, (err, out, stderr) => {
            if (err) {
                // Surface the real reason (permission, not installed, timeout, …)
                // so the widget can show it instead of silently failing.
                const msg = String(stderr || err.message || "osascript failed").split("\n").find(l => l.trim()) || "osascript failed";
                resolve("__ERR__" + msg.replace(/^\d+:\d+:\s*/, "").trim().slice(0, 180));
                return;
            }
            resolve(String(out).trim());
        });
    });
}

// ------------------------------------------------------------------ lifecycle ---

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.exit(0);

app.whenReady().then(() => {
    fs.mkdirSync(USER_DIR, {recursive: true});
    nativeTheme.themeSource = "dark";
    const tmpl = menuTemplate(process.platform);
    Menu.setApplicationMenu(tmpl ? Menu.buildFromTemplate(tmpl) : null);
    registerIpc();
    const settings = loadSettings();
    loginEnvPromise = getLoginEnv(settings.shell);
    createWindow(settings);
}).catch(err => {
    dialog.showErrorBox("dyo-term failed to start", err.message || String(err));
    app.exit(1);
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", killAllPtys);
process.on("uncaughtException", err => {
    console.error(err);
});
