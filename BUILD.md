# Building dyo-term

## Local (current OS)

```
npm ci          # installs deps; postinstall rebuilds node-pty natively for THIS OS/arch
npm run build   # electron-builder for the current OS -> dist/
```

On this repo (macOS/Apple Silicon) `npm run build` runs `electron-builder build --mac --arm64`
and produces a `.dmg` + `.zip` in `dist/`.

## Windows artifacts come from CI

`node-pty` is a native C++ addon: it must be compiled **on Windows for Windows**.
You cannot cross-build a Windows installer from macOS. Windows `.exe` installers
(NSIS + portable, x64/arm64) are produced by GitHub Actions on a `windows-latest`
runner — see `.github/workflows/build.yml` (the `windows` matrix leg), and
`WINDOWS.md` for the full Windows story and the separate "dyo-term for windows" repo.

Trigger: push to `main`, a `v*` tag, or **Actions -> build -> Run workflow**
(`workflow_dispatch`). Artifacts are uploaded per-OS (`dyo-term-macos-arm64`,
`dyo-term-windows`) and downloadable from the run page.

## Platform abstraction

OS-specific main-process bits (shell selection, cwd probe, window chrome, menu)
live in `src/main/platform.js`. The renderer bridge (`window.dyo.*`) is identical
across platforms; only main-process internals and build/CI differ.
