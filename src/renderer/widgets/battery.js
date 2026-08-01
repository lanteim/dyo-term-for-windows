"use strict";
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.battery = {
    id: "battery",
    title: "widget.battery",
    category: "system",
    description: "Battery & CPU temperature",
    defaultSize: { w: 6, h: 2 },
    mount(body) {
        body.innerHTML = `
            <div class="metric-row"><span class="k">🔋 BATTERY</span><span class="v"><b id="_bat_p">—</b></span></div>
            <div class="bar"><i id="_bat_bar"></i></div>
            <div class="metric-row" style="margin-top:10px"><span class="k">STATE</span><span class="v" id="_bat_s">—</span></div>
            <div class="metric-row"><span class="k">CPU TEMP</span><span class="v" id="_bat_t">—</span></div>`;
        const $ = s => body.querySelector(s);
        let alive = true;
        const tick = async () => {
            if (!alive) return;
            const [bat, temp] = await Promise.all([window.dyo.si("battery"), window.dyo.si("cpuTemperature")]);
            if (bat && bat.hasBattery) {
                $("#_bat_p").textContent = bat.percent + "%";
                $("#_bat_bar").style.width = bat.percent + "%";
                $("#_bat_s").textContent = bat.isCharging ? "charging" : (bat.timeRemaining ? bat.timeRemaining + " min left" : "on battery");
            } else {
                $("#_bat_p").textContent = "AC";
                $("#_bat_bar").style.width = "100%";
                $("#_bat_s").textContent = "no battery";
            }
            $("#_bat_t").textContent = (temp && typeof temp.main === "number" && temp.main > 0) ? Math.round(temp.main) + "°C" : "n/a";
        };
        tick();
        const iv = setInterval(tick, 5000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
