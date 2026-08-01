# dyo-term for Windows

This document covers the **Windows** build of dyo-term. It is the **same application** as
the macOS build — same renderer, same widgets, same `window.dyo.*` bridge API — packaged and
shipped from a **separate repository** whose product is named **"dyo-term for windows"**.

Nothing in the widget layer changes between platforms. Only main-process internals (shell/pty,
cwd tracking, window chrome, menu) and the build/CI pipeline differ.

---

## 1. What is different on Windows

dyo-term is built on Electron, which is cross-platform. The Windows repo abstracts a handful of
macOS-specific main-process behaviors:

| Concern | macOS | Windows |
| --- | --- | --- |
| Default shell | `/bin/zsh` with args `["-l"]` | **PowerShell 7 (`pwsh.exe`)** if on PATH, else **Windows PowerShell (`powershell.exe`)**, else **`cmd.exe`** — with **no `-l`** login flag |
| Login env capture | `zsh -ilc` env dump | Not applicable; child process inherits the normal Windows environment |
| cwd tracking (`pty:cwd`) | `lsof` on the pty pid | No `lsof` on Windows — returns `null` (degrades gracefully; file widgets fall back to `window.term.lastCwd`) |
| Window chrome | `titleBarStyle: "hiddenInset"` + traffic-light position | Standard window frame / default title bar; the topbar keeps `-webkit-app-region: drag` so it stays draggable and native window controls work |
| Application menu | mac roles (`appMenu`) | Minimal menu (or `null`) keeping Edit/View so copy/paste and view shortcuts work |
| Music / volume widgets | `osascript` | Guarded by `dyo.appInfo().platform`; simply inactive on Windows |

> The renderer bridge (`window.dyo.*`) is **identical** on both platforms. Do not change
> widget-facing APIs — a widget written for macOS runs unmodified on Windows.

---

## 2. Requirements (to build locally)

To build the native module and produce an installer on a Windows machine you need:

- **Windows 10 or 11, x64** (arm64 also supported — see targets below).
- **Node.js 20 LTS** (matches `"engines": { "node": ">=20" }`).
- **Python 3.x** (node-gyp dependency; usually installed with the Build Tools workload).
- **Visual Studio Build Tools** with the **"Desktop development with C++"** workload — required to
  compile `node-pty` (a native module) against Electron's headers. The Node.js installer's
  *"Tools for Native Modules"* option installs a compatible toolchain as well.
- **Git**.

### Why the native toolchain is mandatory

`node-pty` is a **native C++ addon** and must be compiled **on Windows, for Windows**. You
**cannot cross-build the Windows installer from macOS or Linux** — the compiled binary is
platform- and ABI-specific. This is the single most important constraint of the Windows build and
the reason CI runs on `windows-latest` (see below).

### Local build steps

```powershell
# from the Windows repo root
npm ci
# postinstall runs electron-rebuild against node-pty automatically;
# if you need to force it:
npx electron-rebuild -f -w node-pty

# run in dev
npm start

# produce installers into dist\
npm run build:win
```

---

## 3. How CI builds it

Because the native module must be compiled on Windows, the Windows repo ships a **GitHub Actions**
workflow that runs on a **`windows-latest`** runner. A cross-build from macOS will not produce a
working installer.

Outline of `.github/workflows/build-win.yml`:

```yaml
name: build-windows

on:
  push:
    tags: ["v*"]        # tagged releases produce installers
  workflow_dispatch: {} # manual runs for testing

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      # windows-latest already ships VS Build Tools with the C++ workload,
      # so node-pty compiles without extra setup.

      - name: Install dependencies
        run: npm ci
        # postinstall runs electron-rebuild -f -w node-pty against Electron 43

      - name: Build installers
        run: npm run build:win
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: dyo-term-windows
          path: dist/*.exe
```

The build produces, via electron-builder:

- an **NSIS installer** (`.exe`) for x64 (and arm64), and
- a **portable** `.exe` that runs without installation.

electron-builder is configured with `npmRebuild: true` so the bundled `node-pty` is the freshly
compiled Windows binary, not a copy carried in from another platform.

### electron-builder Windows targets (in the Windows repo's `package.json`)

```json
"win": {
  "target": [
    { "target": "nsis",     "arch": ["x64", "arm64"] },
    { "target": "portable", "arch": ["x64", "arm64"] }
  ],
  "artifactName": "dyo-term-windows-${arch}.${ext}"
},
"nsis": {
  "oneClick": false,
  "perMachine": false,
  "allowToChangeInstallationDirectory": true
}
```

---

## 4. Install notes

### SmartScreen (unsigned builds)

The Windows installers are **not code-signed** (there is no Authenticode certificate). When you run
the installer, **Microsoft Defender SmartScreen** will show a blue *"Windows protected your PC"*
warning because the publisher is unrecognized. This is expected for an unsigned app.

To proceed:

1. Click **"More info"**.
2. Click **"Run anyway"**.

The app is otherwise identical to the macOS build. If/when an EV or standard code-signing
certificate is available, add signing to the electron-builder `win` config and the CI env, and the
SmartScreen prompt disappears (EV) or attenuates as reputation builds.

### Install locations

- **NSIS installer** — installs per-user by default (no admin prompt); the user can change the
  install directory. Creates Start Menu and optional desktop shortcuts and provides an uninstaller.
- **Portable** — a single `.exe`; run it directly, no installation, nothing written to
  Program Files. Good for USB sticks or locked-down machines.

### First run

The first shell that opens uses PowerShell 7 if present, otherwise Windows PowerShell, otherwise
`cmd.exe`. File-browser widgets that rely on live cwd tracking will fall back to the terminal's last
known directory (`window.term.lastCwd`), since `lsof`-style cwd probing is not available on Windows.

---

## 5. Same app as macOS

dyo-term for Windows is **not a fork of functionality** — it is the same configurable,
widget-driven terminal, built from the same source, with platform-specific main-process branches.
Anything you build or configure as a widget works on both platforms because the `window.dyo.*` and
`window.term.*` APIs are identical. Report widget bugs against the shared behavior; report only
shell/pty/window-chrome/menu/build issues as Windows-specific.

---

## 6. Branding / productName changes for the Windows repo

The Windows repo keeps the same code but changes the following identity fields so releases are
clearly the Windows product:

`package.json` (top level):

```json
{
  "name": "dyo-term-windows",
  "productName": "dyo-term for windows",
  "description": "A configurable, widget-driven sci-fi terminal — Windows edition.",
  "keywords": ["terminal", "tty", "dashboard", "windows", "x64", "arm64"]
}
```

`package.json` → `build` (electron-builder):

```json
"build": {
  "appId": "com.dyoterm.windows",
  "productName": "dyo-term for windows",
  "artifactName": "dyo-term-windows-${arch}.${ext}"
}
```

Notes on branding:

- **`productName`** = `"dyo-term for windows"` — this is what appears in the installer, Start Menu,
  Add/Remove Programs, and the window title.
- **`appId`** is distinct (`com.dyoterm.windows`) so the Windows app is registered independently
  from the macOS app (`com.dyoterm.app`).
- **`build` script** becomes `"build:win": "electron-builder build --win --x64 --arm64"`
  (replacing the mac-only `--mac --arm64` script).
- The macOS `mac`/`dmg` electron-builder blocks are removed or left unused; the Windows repo only
  builds `win` targets.
- Keep the version number in sync with upstream so users can map Windows releases to the shared
  codebase.
