"use strict";
window.I18N.register({
    en: { "widget.enc_passphrase": "Passphrase", "cat.security": "Security" },
    ru: { "widget.enc_passphrase": "Парольная фраза", "cat.security": "Безопасность" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.enc_passphrase = {
    id: "enc_passphrase",
    title: "widget.enc_passphrase",
    category: "security",
    description: "Diceware-style memorable passphrase from a built-in wordlist",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        let alive = true;
        // Compact built-in wordlist (256 short, distinct words) for local generation.
        const WORDS = ("able acid acorn actor adapt agent alarm album alert alien alloy alpha amber amend ample angel " +
            "anvil apple april apron argue arise armor arrow aspen atlas atom audio autumn axis bacon badge baker " +
            "banjo basil batch beach beast beaver bench berry bison black blade blaze bloom board bonus boost brave " +
            "bread brick brisk broke bronze brush buddy bugle bunny cabin cable cacao camel candy canoe canyon cargo " +
            "carol cedar chalk charm chase cheer chess chief chili chord cider cigar civic claim clash clay clean " +
            "cliff cloak clock cloud clover coast cobra cocoa comet coral cove crane crate creek crisp crown cube " +
            "curry daisy dance dandy dawn delta demon depot diary diver dodge dolphin donut draft drama dream drift " +
            "drone eagle early earth ebony echo eddy elbow elder elite ember ember2 emu enter envoy epoch equal essay " +
            "ether ethos exile extra fable fairy falcon fancy fauna feast fable2 ferry fever fiber field finch fjord " +
            "flame flash fleet flint flora fluke flute focus forge fox frame frost fruit fudge gecko gem ginger " +
            "given glade glass gleam globe glory glove gnome goblet gold golf grape grasp gravy green grid grove " +
            "guard gulf habit hazel heron hippo hive honey horn hotel hound humor husky icon igloo image inbox " +
            "index inlet input ivory ivy jade jaunt jelly jewel jolly joust judge juice jumbo jungle karma kayak " +
            "kettle koala label lace lagoon lance larch laser latte lemon lever lilac lime linen lion llama loft " +
            "lotus lunar lynx macro magic mango maple march marsh medal melon mercy merit mesa metro micro mint " +
            "mirror moat mocha moose motto mount mural music nacho navy nectar niche nickel night noble north nova " +
            "oasis ocean ochre olive onion opal orbit orca otter ounce oval owl oxide ozone panda pearl pecan").trim().split(/\s+/);

        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div style="display:flex;gap:6px;align-items:center">
              <input class="_out" readonly style="flex:1;font-family:var(--font-mono);font-size:14px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:8px 10px;word-break:break-all">
              <button class="_copy" style="background:transparent;color:var(--text);border:1px solid var(--accent);border-radius:6px;padding:8px 12px;cursor:pointer;font-family:var(--font-mono)">Copy</button>
              <button class="_gen" title="Regenerate" aria-label="Regenerate" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:8px 12px;cursor:pointer;font-family:var(--font-mono)">↻</button>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="color:var(--text-dim);min-width:52px">Words</span>
              <input class="_n" type="range" min="3" max="10" value="5" style="flex:1">
              <span class="_nv" style="min-width:20px;text-align:right;font-variant-numeric:tabular-nums">5</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:var(--text-dim)">
              <span style="min-width:52px">Sep</span>
              <select class="_sep" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:5px;padding:3px 6px">
                <option value="-">- (dash)</option>
                <option value=".">. (dot)</option>
                <option value="_">_ (underscore)</option>
                <option value=" ">space</option>
                <option value="">(none)</option>
              </select>
              <label style="cursor:pointer"><input type="checkbox" class="_cap"> Capitalize</label>
              <label style="cursor:pointer"><input type="checkbox" class="_num"> Add number</label>
            </div>
            <div class="_ent" style="color:var(--text-dim);font-family:var(--font-mono);margin-top:auto"></div>
          </div>`;
        const $ = s => body.querySelector(s);
        const out = $("._out");
        const rand = n => {
            const a = new Uint32Array(1);
            const limit = Math.floor(0xFFFFFFFF / n) * n;
            let x;
            do { crypto.getRandomValues(a); x = a[0]; } while (x >= limit);
            return x % n;
        };
        const gen = () => {
            const n = +$("._n").value, sep = $("._sep").value, cap = $("._cap").checked, num = $("._num").checked;
            const parts = [];
            for (let i = 0; i < n; i++) {
                let w = WORDS[rand(WORDS.length)];
                if (cap) w = w[0].toUpperCase() + w.slice(1);
                parts.push(w);
            }
            let phrase = parts.join(sep);
            if (num) phrase += (sep || "") + rand(100);
            out.value = phrase;
            const bits = n * Math.log2(WORDS.length) + (num ? Math.log2(100) : 0);
            $("._ent").textContent = `${bits.toFixed(1)} bits · ${WORDS.length}-word list`;
        };
        $("._n").oninput = () => { $("._nv").textContent = $("._n").value; gen(); };
        $("._sep").onchange = gen;
        $("._cap").onchange = gen;
        $("._num").onchange = gen;
        $("._gen").onclick = gen;
        $("._copy").onclick = () => { if (out.value) navigator.clipboard.writeText(out.value).then(() => { const b = $("._copy"); b.textContent = "✓"; setTimeout(() => { if (alive) b.textContent = "Copy"; }, 900); }).catch(() => {}); };
        gen();
        return { destroy: () => { alive = false; } };
    }
};
