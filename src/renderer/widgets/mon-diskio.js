"use strict";
window.I18N.register({
    en: {
        "widget.diskio": "Disk I/O", "cat.monitoring": "Monitoring",
        "diskio.read": "Read", "diskio.write": "Write", "diskio.riops": "Read IOPS", "diskio.wiops": "Write IOPS"
    },
    ru: {
        "widget.diskio": "Диск I/O", "cat.monitoring": "Мониторинг",
        "diskio.read": "Чтение", "diskio.write": "Запись", "diskio.riops": "IOPS чтения", "diskio.wiops": "IOPS записи"
    }
});
window.WIDGETS = window.WIDGETS || {};
function _diskFmtRate(bytesPerSec) {
    if (!bytesPerSec || bytesPerSec < 0) bytesPerSec = 0;
    const units = ["B/s", "kB/s", "MB/s", "GB/s"];
    let i = 0, v = bytesPerSec;
    while (v >= 1000 && i < units.length - 1) { v /= 1000; i++; }
    return (v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)) + " " + units[i];
}
window.WIDGETS.diskio = {
    id: "diskio",
    title: "widget.diskio",
    category: "monitoring",
    description: "Disk read/write IOPS and throughput",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        const t = window.I18N.t.bind(window.I18N);
        body.innerHTML = `
            <div style="height:100%;display:flex;flex-direction:column">
              <div class="metric-row"><span class="k">${t("diskio.read")}</span><span class="v"><b id="_di_rb">--</b> · <span id="_di_ri">--</span> IOPS</span></div>
              <div class="metric-row"><span class="k">${t("diskio.write")}</span><span class="v"><b id="_di_wb">--</b> · <span id="_di_wi">--</span> IOPS</span></div>
              <div id="_di_msg" style="color:var(--text-dim);font-size:11px;margin-top:auto"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const setAll = (rb, ri, wb, wi) => {
            $("#_di_rb").textContent = rb; $("#_di_ri").textContent = ri;
            $("#_di_wb").textContent = wb; $("#_di_wi").textContent = wi;
        };
        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const [io, fs] = await Promise.all([window.dyo.si("disksIO"), window.dyo.si("fsStats")]);
                if (!alive) return;
                const rBytes = fs && fs.rx_sec != null ? fs.rx_sec : null;
                const wBytes = fs && fs.wx_sec != null ? fs.wx_sec : null;
                const rIops = io && io.rIO_sec != null ? io.rIO_sec : null;
                const wIops = io && io.wIO_sec != null ? io.wIO_sec : null;
                if (rBytes == null && wBytes == null && rIops == null && wIops == null) {
                    $("#_di_msg").textContent = "disk I/O stats unavailable";
                    setAll("n/a", "n/a", "n/a", "n/a");
                    return;
                }
                $("#_di_msg").textContent = "";
                setAll(
                    rBytes == null ? "n/a" : _diskFmtRate(rBytes),
                    rIops == null ? "n/a" : Math.round(rIops),
                    wBytes == null ? "n/a" : _diskFmtRate(wBytes),
                    wIops == null ? "n/a" : Math.round(wIops)
                );
            } catch (e) {
                $("#_di_msg").textContent = "disk I/O stats unavailable";
            } finally {
                busy = false;
            }
        };
        tick();
        const iv = setInterval(tick, 2000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
