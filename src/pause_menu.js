// --- PAUSE MENU ---
// Deliberately built as a DOM overlay rather than Kaboom game objects. Pausing works by
// setting Kaboom's own `debug.paused` (its real, documented pause switch - it's what F8
// toggles in debug mode) which freezes every game object's update loop: enemies, bullets,
// spawn timers, cooldowns, all of it, with zero extra bookkeeping on our side. The catch
// is that a "Resume" button built the normal Kaboom way (area() + onClick()) relies on
// that same per-frame update loop to detect the click - so it would freeze right along
// with everything else and become unclickable. A plain DOM button has no such problem;
// it's outside Kaboom's world entirely and stays responsive no matter what debug.paused
// is set to.

import { session } from "./config.js";
import { confirmLeaveToMenu } from "./helpers.js";

let onResumeCallback = null;

function setVisible(visible) {
    const root = document.getElementById("pause-menu");
    if (root) root.style.display = visible ? "flex" : "none";
}

export function initPauseMenu() {
    const root = document.createElement("div");
    root.id = "pause-menu";
    root.innerHTML = `
        <div class="pm-panel">
            <div class="pm-title">PAUSED</div>
            <button class="pm-btn pm-resume" type="button">RESUME MATCH</button>
            <button class="pm-btn pm-quit" type="button">QUIT TO MENU</button>
            <div class="pm-hint">Press ESC to resume</div>
        </div>
    `;
    document.body.appendChild(root);
    root.style.display = "none";

    root.querySelector(".pm-resume").addEventListener("click", () => {
        setVisible(false);
        if (onResumeCallback) onResumeCallback();
    });

    root.querySelector(".pm-quit").addEventListener("click", () => {
        confirmLeaveToMenu(() => {
            setVisible(false);
            debug.paused = false;
            window.gameInputActive = false;
            if (session.audio.gameAmbience) {
                session.audio.gameAmbience.stop();
                session.audio.gameAmbience = null;
            }
            go("menu");
        });
    });

    // The gameplay scene calls window.pauseMenuAPI.show(resumeFn) on ESC / the mobile
    // pause button, and passes the exact function that should run to un-pause things on
    // its side (so main.js keeps full ownership of what "resumed" actually means).
    window.pauseMenuAPI = {
        show: (resumeFn) => { onResumeCallback = resumeFn; setVisible(true); },
        hide: () => setVisible(false)
    };
}
