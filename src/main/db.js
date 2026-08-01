"use strict";
// Database connectors for the DB widget (a mini DataGrip). Drivers are loaded
// lazily so the app runs even if a driver isn't installed. Version-aware:
// each driver reports the server version on connect. ClickHouse is spoken over
// its HTTP interface (stable across server versions — no version-pinned driver).

const connections = new Map();
let seq = 0;

function normRows(columns, rows) {
    return { columns, rows, rowCount: rows.length };
}

const drivers = {
    postgres: {
        async connect(cfg) {
            const { Client } = require("pg");
            const client = new Client({
                host: cfg.host || "127.0.0.1", port: cfg.port || 5432,
                user: cfg.user, password: cfg.password, database: cfg.database,
                ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined,
                connectionTimeoutMillis: 8000, statement_timeout: 30000
            });
            await client.connect();
            const v = await client.query("SELECT version()");
            return { client, version: v.rows[0].version };
        },
        async query(client, sql) {
            const r = await client.query(sql);
            const rows = Array.isArray(r) ? r[r.length - 1] : r;
            return { columns: (rows.fields || []).map(f => f.name), rows: rows.rows || [], rowCount: rows.rowCount ?? (rows.rows ? rows.rows.length : 0) };
        },
        async close(client) { await client.end(); }
    },

    mysql: {
        async connect(cfg) {
            const mysql = require("mysql2/promise");
            const client = await mysql.createConnection({
                host: cfg.host || "127.0.0.1", port: cfg.port || 3306,
                user: cfg.user, password: cfg.password, database: cfg.database,
                ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined, connectTimeout: 8000
            });
            const [rows] = await client.query("SELECT VERSION() AS v");
            return { client, version: rows[0].v };
        },
        async query(client, sql) {
            const [rows, fields] = await client.query(sql);
            if (Array.isArray(rows)) return normRows((fields || []).map(f => f.name), rows);
            return normRows(["affectedRows"], [{ affectedRows: rows.affectedRows }]);
        },
        async close(client) { await client.end(); }
    },

    // ClickHouse over the HTTP interface — works from old to current versions.
    clickhouse: {
        async connect(cfg) {
            const conn = {
                base: `${cfg.ssl ? "https" : "http"}://${cfg.host || "127.0.0.1"}:${cfg.port || 8123}/`,
                user: cfg.user || "default", password: cfg.password || "", database: cfg.database || "default"
            };
            const version = await clickhouseScalar(conn, "SELECT version()");
            return { client: conn, version: "ClickHouse " + version };
        },
        async query(conn, sql) {
            // Try JSON format (modern); fall back to TSVWithNames (very old servers)
            try {
                const txt = await clickhousePost(conn, sql.trim().replace(/;+\s*$/, "") + "\nFORMAT JSON");
                if (!txt.trim()) return normRows([], []);
                const j = JSON.parse(txt);
                return normRows((j.meta || []).map(m => m.name), j.data || []);
            } catch (e) {
                const txt = await clickhousePost(conn, sql.trim().replace(/;+\s*$/, "") + "\nFORMAT TabSeparatedWithNames");
                const lines = txt.replace(/\n$/, "").split("\n");
                if (!lines[0]) return normRows([], []);
                const cols = lines[0].split("\t");
                const rows = lines.slice(1).map(l => { const c = l.split("\t"); const o = {}; cols.forEach((k, i) => o[k] = c[i]); return o; });
                return normRows(cols, rows);
            }
        },
        async close() { /* stateless HTTP */ }
    },

    mongodb: {
        async connect(cfg) {
            const { MongoClient } = require("mongodb");
            const auth = cfg.user ? `${encodeURIComponent(cfg.user)}:${encodeURIComponent(cfg.password || "")}@` : "";
            const uri = cfg.uri || `mongodb://${auth}${cfg.host || "127.0.0.1"}:${cfg.port || 27017}`;
            const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
            await client.connect();
            const info = await client.db(cfg.database || "admin").admin().serverInfo();
            return { client: { client, dbName: cfg.database || "test" }, version: "MongoDB " + info.version };
        },
        // Accepts a JSON command document, e.g. {"find":"users","filter":{},"limit":50}
        async query(conn, sql) {
            const cmd = JSON.parse(sql);
            const res = await conn.client.db(conn.dbName).command(cmd);
            let rows = [];
            if (res.cursor && res.cursor.firstBatch) rows = res.cursor.firstBatch;
            else rows = [res];
            const cols = rows.length ? Object.keys(rows[0]) : Object.keys(res);
            return normRows(cols, rows);
        },
        async close(conn) { await conn.client.close(); }
    },

    redis: {
        async connect(cfg) {
            const Redis = require("ioredis");
            const client = new Redis({ host: cfg.host || "127.0.0.1", port: cfg.port || 6379, password: cfg.password || undefined, db: Number(cfg.database) || 0, lazyConnect: true, connectTimeout: 8000, maxRetriesPerRequest: 1 });
            await client.connect();
            const info = await client.info("server");
            const m = /redis_version:([^\r\n]+)/.exec(info);
            return { client, version: "Redis " + (m ? m[1] : "?") };
        },
        // Accepts a command line, e.g. "GET mykey" or "KEYS *"
        async query(client, sql) {
            const parts = sql.trim().match(/(?:[^\s"]+|"[^"]*")+/g) || [];
            const args = parts.map(p => p.replace(/^"|"$/g, ""));
            const res = await client.call(...args);
            const rows = Array.isArray(res) ? res.map((v, i) => ({ "#": i, value: Array.isArray(v) ? JSON.stringify(v) : v })) : [{ value: res }];
            return normRows(Array.isArray(res) ? ["#", "value"] : ["value"], rows);
        },
        async close(client) { client.disconnect(); }
    },

    mssql: {
        async connect(cfg) {
            const sql = require("mssql");
            const pool = new sql.ConnectionPool({
                server: cfg.host || "127.0.0.1", port: cfg.port || 1433,
                user: cfg.user, password: cfg.password, database: cfg.database,
                options: { encrypt: !!cfg.ssl, trustServerCertificate: true }, connectionTimeout: 8000
            });
            await pool.connect();
            const v = await pool.request().query("SELECT @@VERSION AS v");
            return { client: pool, version: (v.recordset[0].v || "").split("\n")[0] };
        },
        async query(pool, sql) {
            const r = await pool.request().query(sql);
            const rs = r.recordset || [];
            return normRows(rs.length ? Object.keys(rs[0]) : [], rs);
        },
        async close(pool) { await pool.close(); }
    }
};

async function clickhousePost(conn, body) {
    const headers = { "X-ClickHouse-User": conn.user, "X-ClickHouse-Key": conn.password };
    const url = conn.base + "?database=" + encodeURIComponent(conn.database);
    const r = await fetch(url, { method: "POST", headers, body });
    const txt = await r.text();
    if (!r.ok) throw new Error(txt.slice(0, 400));
    return txt;
}
async function clickhouseScalar(conn, sql) {
    const txt = await clickhousePost(conn, sql + "\nFORMAT TabSeparated");
    return txt.trim();
}

function register(ipcMain) {
    ipcMain.handle("db:connect", async (e, cfg = {}) => {
        const drv = drivers[cfg.type];
        if (!drv) return { error: `Unknown database type: ${cfg.type}` };
        try {
            const { client, version } = await drv.connect(cfg);
            const id = "db" + (++seq);
            connections.set(id, { type: cfg.type, client });
            return { id, type: cfg.type, version };
        } catch (err) { return { error: err.message || String(err) }; }
    });

    ipcMain.handle("db:query", async (e, id, sql) => {
        const conn = connections.get(id);
        if (!conn) return { error: "Not connected" };
        const t0 = Date.now();
        try {
            const res = await drivers[conn.type].query(conn.client, sql);
            res.elapsedMs = Date.now() - t0;
            return res;
        } catch (err) { return { error: err.message || String(err) }; }
    });

    ipcMain.handle("db:close", async (e, id) => {
        const conn = connections.get(id);
        if (!conn) return true;
        try { await drivers[conn.type].close(conn.client); } catch (err) { /* ignore */ }
        connections.delete(id);
        return true;
    });
}

module.exports = { register, TYPES: Object.keys(drivers) };
