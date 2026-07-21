// --- MOBILE TOUCH CONTROLS ---
// A small DOM overlay (not Kaboom game objects) so it works identically regardless of
// which scene is active, and never has to fight the canvas for input priority. It writes
// movement into session.run.touchVec (read by the main scene's movement update) and calls
// into window.gameInput for dash/bicycle-kick/shop, which src/scenes/main.js populates
// with the exact same functions the keyboard shortcuts use - so there is only ever one
// implementation of each action, keyboard and touch just both trigger it.
//
// The whole overlay only renders on devices that report touch support, and only shows
// its gameplay buttons while window.gameInputActive is true (set by main.js while a
// match is in progress). On desktop, or while looking at a menu/shop/result screen, it
// stays hidden and inert.

import { session } from "./config.js";

function isTouchDevice() {
    return ("ontouchstart" in window) || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
}

export function initMobileControls() {
    if (!isTouchDevice()) return;

    const root = document.createElement("div");
    root.id = "touch-controls";
    root.innerHTML = `
        <div class="tc-joystick-zone">
            <div class="tc-joystick-base">
                <div class="tc-joystick-knob"></div>
            </div>
        </div>
        <div class="tc-action-zone">
            <button class="tc-btn tc-btn-pause" type="button">II</button>
            <button class="tc-btn tc-btn-shop" type="button">SHOP</button>
            <div class="tc-action-row">
                <button class="tc-btn tc-btn-dash" type="button">DASH</button>
                <button class="tc-btn tc-btn-kick" type="button">KICK</button>
            </div>
        </div>
    `;
    document.body.appendChild(root);

    const joystickZone = root.querySelector(".tc-joystick-zone");
    const joystickBase = root.querySelector(".tc-joystick-base");
    const joystickKnob = root.querySelector(".tc-joystick-knob");
    const dashBtn = root.querySelector(".tc-btn-dash");
    const kickBtn = root.querySelector(".tc-btn-kick");
    const shopBtn = root.querySelector(".tc-btn-shop");
    const pauseBtn = root.querySelector(".tc-btn-pause");

    // --- Joystick ---
    const MAX_KNOB_OFFSET = 40; // px the knob can travel from center before clamping
    let activeJoystickPointerId = null;

    function resetJoystick() {
        activeJoystickPointerId = null;
        session.run.touchVec.x = 0;
        session.run.touchVec.y = 0;
        joystickKnob.style.transform = "translate(0px, 0px)";
        joystickBase.classList.remove("tc-active");
    }

    function updateJoystick(clientX, clientY) {
        const rect = joystickBase.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        let dx = clientX - centerX;
        let dy = clientY - centerY;
        const dist = Math.hypot(dx, dy);
        if (dist > MAX_KNOB_OFFSET) {
            dx = (dx / dist) * MAX_KNOB_OFFSET;
            dy = (dy / dist) * MAX_KNOB_OFFSET;
        }
        joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
        // Normalize to [-1, 1] on each axis for the movement update to consume directly.
        session.run.touchVec.x = dx / MAX_KNOB_OFFSET;
        session.run.touchVec.y = dy / MAX_KNOB_OFFSET;
    }

    joystickZone.addEventListener("pointerdown", (e) => {
        if (activeJoystickPointerId !== null) return;
        activeJoystickPointerId = e.pointerId;
        joystickBase.classList.add("tc-active");
        joystickZone.setPointerCapture(e.pointerId);
        updateJoystick(e.clientX, e.clientY);
        e.preventDefault();
    });
    joystickZone.addEventListener("pointermove", (e) => {
        if (e.pointerId !== activeJoystickPointerId) return;
        updateJoystick(e.clientX, e.clientY);
        e.preventDefault();
    });
    const endJoystick = (e) => {
        if (e.pointerId !== activeJoystickPointerId) return;
        resetJoystick();
    };
    joystickZone.addEventListener("pointerup", endJoystick);
    joystickZone.addEventListener("pointercancel", endJoystick);

    // --- Action buttons ---
    // touchstart (not click) so there's no ~300ms delay and no double-fire with the
    // synthesized mouse events some browsers still send after a touch.
    const bindTap = (el, handler) => {
        el.addEventListener("touchstart", (e) => { e.preventDefault(); handler(); }, { passive: false });
        el.addEventListener("pointerdown", (e) => { if (e.pointerType !== "touch") handler(); });
    };
    bindTap(dashBtn, () => window.gameInput?.dash?.());
    bindTap(kickBtn, () => window.gameInput?.bicycleKick?.());
    bindTap(shopBtn, () => window.gameInput?.toggleShop?.());
    bindTap(pauseBtn, () => window.gameInput?.togglePause?.());

    // Visibility follows whether a match is actually in progress, checked on a light
    // interval rather than wiring into every scene transition. Hidden while paused too,
    // so the only interactive thing on screen during a pause is the pause menu itself.
    setInterval(() => {
        root.style.display = (window.gameInputActive && !debug.paused) ? "block" : "none";
    }, 150);
    root.style.display = "none";
}
