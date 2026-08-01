"use strict";
// dyo-term platform helper.
//
// Isolates the OS-specific bits of the pty/shell layer so main/index.js stays
// platform-agnostic. Three concerns live here:
//   * defaultShell()      — which shell binary to launch
//   * defaultShellArgs()  — the launch arguments for that shell
//   * cwdOf(pid)          — best-effort "current working directory of a live
//                           process", used by the file/title widgets
//
// Nothing here touches the renderer-facing bridge (window.dyo.*). It is pure
// main-process internals: the values returned by defaultShell/defaultShellArgs
// are only ever used as DEFAULT_SETTINGS fallbacks, and cwdOf backs the
// "pty:cwd" IPC handler. The renderer contract is unchanged.

const fs = require("fs");
const path = require("path");
const {execFile} = require("child_process");

const isWin = process.platform === "win32";
const isMac = process.platform === "darwin";

// ------------------------------------------------------------- shell select ---

// Windows PowerShell 7 (pwsh.exe) is the preferred default when installed:
// it is the modern, cross-platform shell and behaves closest to a POSIX-ish
// interactive experience. We probe a few well-known install locations plus
// PATH rather than shelling out, so the check is synchronous and cheap.
function which(exe) {
    // Absolute/relative path given directly.
    if (exe.includes(path.sep) || (isWin && exe.includes("/"))) {
        return fs.existsSync(exe) ? exe : null;
    }
    const pathVar = process.env.PATH || process.env.Path || "";
    const dirs = pathVar.split(path.delimiter).filter(Boolean);
    // On Windows a bare name like "pwsh" needs an extension appended.
    const exts = isWin
        ? (process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean)
        : [""];
    for (const dir of dirs) {
        for (const ext of exts) {
            const candidate = path.join(dir, exe + (exe.toLowerCase().endsWith(ext.toLowerCase()) ? "" : ext));
            try {
                if (fs.existsSync(candidate)) return candidate;
            } catch (e) { /* unreadable dir entry — skip */ }
        }
    }
    return null;
}

function firstExisting(paths) {
    for (const p of paths) {
        try { if (p && fs.existsSync(p)) return p; } catch (e) { /* skip */ }
    }
    return null;
}

// Windows: prefer PowerShell 7 (pwsh) -> Windows PowerShell -> cmd.exe.
function windowsShell() {
    // 1. PowerShell 7, installed out-of-band from Windows. Check PATH first,
    //    then the standard MSI install root(s).
    const pwsh = which("pwsh.exe") || firstExisting([
        process.env.ProgramFiles && path.join(process.env.ProgramFiles, "PowerShell", "7", "pwsh.exe"),
        process.env["ProgramFiles(x86)"] && path.join(process.env["ProgramFiles(x86)"], "PowerShell", "7", "pwsh.exe")
    ]);
    if (pwsh) return pwsh;

    // 2. Windows PowerShell 5.x, shipped in-box. Build the System32 path from
    //    the real system root so it works on non-C: installs.
    const sysRoot = process.env.SystemRoot || process.env.windir || "C:\\Windows";
    const winPs = which("powershell.exe") || firstExisting([
        path.join(sysRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
    ]);
    if (winPs) return winPs;

    // 3. cmd.exe — always present.
    return which("cmd.exe")
        || firstExisting([path.join(sysRoot, "System32", "cmd.exe")])
        || "cmd.exe";
}

// The default shell binary for this platform. Respects an explicit $SHELL on
// unix (users who set it mean it); on Windows $SHELL is ignored because it is
// almost never a Windows-native shell.
function defaultShell() {
    if (isWin) return windowsShell();
    if (isMac) return process.env.SHELL || "/bin/zsh";
    // linux / other unix
    return process.env.SHELL || "/bin/bash";
}

// Launch args for the default shell.
//   * unix: "-l" for a login shell (loads the user's profile — this is what
//     makes PATH etc. match a normal terminal).
//   * Windows: none. pwsh/powershell/cmd have no "-l" concept, and passing
//     login-style flags would either error (cmd) or change behaviour
//     unexpectedly. An interactive pwsh already loads the user's $PROFILE.
function defaultShellArgs(shell) {
    if (isWin) return [];
    // Basename check so a custom absolute path still gets the right flag.
    const base = String(shell || defaultShell()).toLowerCase();
    if (base.endsWith("cmd.exe") || base.endsWith("powershell.exe") || base.endsWith("pwsh") || base.endsWith("pwsh.exe")) {
        return [];
    }
    return ["-l"];
}

// ---------------------------------------------------------------- cwd probe ---

// Best-effort current working directory of a live process, by pid.
//
//   * macOS: `lsof` reports the cwd file descriptor. Same invocation the app
//     has always used; kept here so index.js has a single code path.
//   * Linux: the kernel exposes it as a symlink at /proc/<pid>/cwd — no
//     external process needed.
//   * Windows: there is no cheap, dependency-free way to read another
//     process's cwd (it would require a native module or WMI/CDB tooling that
//     is not guaranteed present). We degrade gracefully to null; the renderer
//     already falls back to window.term.lastCwd, which the shell integration
//     keeps reasonably fresh, so the file/title widgets still work.
//
// Always resolves (never rejects) with a string path or null.
function cwdOf(pid) {
    if (pid == null) return Promise.resolve(null);

    if (isMac) {
        return new Promise(resolve => {
            execFile("lsof", ["-a", "-d", "cwd", "-p", String(pid), "-F", "n"], (err, out) => {
                if (err) return resolve(null);
                const line = String(out).split("\n").find(l => l.startsWith("n"));
                resolve(line ? line.slice(1).trim() : null);
            });
        });
    }

    if (!isWin) {
        // Linux and other /proc-backed unices.
        return new Promise(resolve => {
            fs.readlink(`/proc/${pid}/cwd`, (err, target) => {
                resolve(err ? null : target);
            });
        });
    }

    // Windows: no supported probe — degrade to null.
    return Promise.resolve(null);
}

// ------------------------------------------------------------ window chrome ---
//
// Returns ONLY the platform-varying BrowserWindow options. index.js keeps the
// common options (size, backgroundColor, webPreferences, show, ...) inline and
// spreads this on top:
//
//     win = new BrowserWindow({ ...common, ...windowOptions(process.platform) });
//
//   * macOS: frameless "hiddenInset" title bar. The custom in-app topbar (which
//     already sets -webkit-app-region: drag) is the drag surface, and the native
//     traffic-light buttons are nudged to line up with it. Unchanged behaviour.
//   * win32 / linux: a normal OS frame with native minimize/maximize/close, so
//     window controls are guaranteed to work. The in-app topbar's drag region is
//     harmless (a bonus drag surface under the native title bar).
//     trafficLightPosition is macOS-only and deliberately omitted.
function windowOptions(platform) {
    if (platform === "darwin") {
        return {
            titleBarStyle: "hiddenInset",
            trafficLightPosition: {x: 14, y: 18}
        };
    }
    // win32 + linux: standard framed window, native controls.
    return {
        frame: true,
        titleBarStyle: "default"
    };
}

// --------------------------------------------------------- application menu ---
//
// Returns a Menu template array for Menu.buildFromTemplate, or null to install
// no application menu. index.js does:
//
//     const tmpl = menuTemplate(process.platform);
//     Menu.setApplicationMenu(tmpl ? Menu.buildFromTemplate(tmpl) : null);
//
//   * macOS: the standard role-based menus (appMenu = Cmd+Q/Hide/About;
//     editMenu/viewMenu/windowMenu give the expected shortcuts). Unchanged.
//   * win32 / linux: a minimal menu that mainly keeps clipboard / zoom / devtools
//     accelerators alive and discoverable. Recommend the caller hides it by
//     default with `win.setAutoHideMenuBar(true)` so it does not clutter the
//     terminal (Alt reveals it; accelerators keep working while hidden).
//
// Terminal caveat: plain Ctrl+C is SIGINT in a shell, so the Edit menu binds
// copy/paste to Ctrl+Shift+C / Ctrl+Shift+V (the terminal convention) rather
// than the role default Ctrl+C / Ctrl+V. Cut/undo/redo/select-all keep their
// defaults — they do not collide with the pty.
function menuTemplate(platform) {
    // copy/paste use registerAccelerator:false everywhere: the shortcut is shown
    // in the menu for discoverability, but the key event is NOT grabbed by the
    // OS menu — it reaches the renderer, which copies xterm's own selection in a
    // terminal (works with the WebGL renderer) and does normal copy/paste in
    // form fields. See core/terminal.js and core/app.js.
    if (platform === "darwin") {
        return [
            {role: "appMenu"},
            {
                label: "Edit",
                submenu: [
                    {role: "undo"},
                    {role: "redo"},
                    {type: "separator"},
                    {role: "cut"},
                    {role: "copy", accelerator: "Cmd+C", registerAccelerator: false},
                    {role: "paste", accelerator: "Cmd+V", registerAccelerator: false},
                    {role: "selectAll"}
                ]
            },
            {role: "viewMenu"},
            {role: "windowMenu"}
        ];
    }

    // win32 + linux
    return [
        {
            label: "File",
            submenu: [{role: "quit"}]
        },
        {
            label: "Edit",
            submenu: [
                {role: "undo"},
                {role: "redo"},
                {type: "separator"},
                {role: "cut"},
                // Terminal-safe clipboard: Ctrl+C stays SIGINT in the pty.
                {role: "copy", accelerator: "Ctrl+Shift+C", registerAccelerator: false},
                {role: "paste", accelerator: "Ctrl+Shift+V", registerAccelerator: false},
                {role: "selectAll"}
            ]
        },
        {
            label: "View",
            submenu: [
                {role: "reload"},
                {role: "forceReload"},
                {role: "toggleDevTools"},
                {type: "separator"},
                {role: "resetZoom"},
                {role: "zoomIn"},
                {role: "zoomOut"},
                {type: "separator"},
                {role: "togglefullscreen"}
            ]
        },
        {role: "windowMenu"}
    ];
}

module.exports = {defaultShell, defaultShellArgs, cwdOf, windowOptions, menuTemplate};
