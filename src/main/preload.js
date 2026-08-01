"use strict";
// The only bridge between the sandboxed renderer and the privileged main
// process. Exposes a small, typed API on window.dyo — the renderer never
// touches node, fs, child_process, or the pty directly.
const {contextBridge, ipcRenderer} = require("electron");

const listeners = {data: new Map(), exit: new Map()};

ipcRenderer.on("pty:data", (e, id, data) => {
    const cb = listeners.data.get(id);
    if (cb) cb(data);
});
ipcRenderer.on("pty:exit", (e, id, code, signal) => {
    const cb = listeners.exit.get(id);
    if (cb) cb(code, signal);
});

contextBridge.exposeInMainWorld("dyo", {
    pty: {
        spawn: (opts) => ipcRenderer.invoke("pty:spawn", opts),
        input: (id, data) => ipcRenderer.send("pty:input", id, data),
        resize: (id, cols, rows) => ipcRenderer.send("pty:resize", id, cols, rows),
        kill: (id) => ipcRenderer.send("pty:kill", id),
        cwd: (id) => ipcRenderer.invoke("pty:cwd", id),
        onData: (id, cb) => { listeners.data.set(id, cb); },
        onExit: (id, cb) => { listeners.exit.set(id, cb); },
        off: (id) => { listeners.data.delete(id); listeners.exit.delete(id); }
    },
    si: (type, ...args) => ipcRenderer.invoke("si", type, ...args),
    settings: {
        get: () => ipcRenderer.invoke("settings:get"),
        set: (patch) => ipcRenderer.invoke("settings:set", patch)
    },
    notes: {
        get: () => ipcRenderer.invoke("notes:get"),
        set: (text) => ipcRenderer.invoke("notes:set", text)
    },
    themes: {
        list: () => ipcRenderer.invoke("themes:list")
    },
    music: {
        control: (action) => ipcRenderer.invoke("music:control", action),
        state: () => ipcRenderer.invoke("music:state")
    },
    win: (action) => ipcRenderer.invoke("win", action),
    appInfo: () => ipcRenderer.invoke("app:info"),
    openPath: (p) => ipcRenderer.invoke("open:path", p),
    openExternal: (u) => ipcRenderer.invoke("open:external", u),
    exec: (cmd, args, opts) => ipcRenderer.invoke("exec", cmd, args, opts),
    http: (url, opts) => ipcRenderer.invoke("http", url, opts),
    fs: {
        list: (dir) => ipcRenderer.invoke("fs:list", dir),
        read: (p, maxBytes) => ipcRenderer.invoke("fs:read", p, maxBytes),
        stat: (p) => ipcRenderer.invoke("fs:stat", p)
    },
    db: {
        connect: (cfg) => ipcRenderer.invoke("db:connect", cfg),
        query: (id, sql, params) => ipcRenderer.invoke("db:query", id, sql, params),
        close: (id) => ipcRenderer.invoke("db:close", id)
    }
});
