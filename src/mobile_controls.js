// --- MOBILE TOUCH CONTROLS ---
// A small DOM overlay (not Kaboom game objects) so it works identically regardless of
// which scene is active, and never has to fight the canvas for input priority. It writes
// movement into session.run.touchVec (read by the main scene's movement update) and calls
// into window.gameInput for dash/bicycle-kick/shop, which src/scenes/main.js populates
// with the exact same functions the keyboard shortcuts use - so there is only ever one
// implementation of each action, keyboard and touch just both trigger it.
//
// The whole overlay only renders on touch devices, and only shows its gameplay buttons
// while window.gameInputActive is true (set by main.js while a match is in progress). On
// desktop, or while looking at a menu/shop/result screen, it stays hidden and inert.
//
// The buttons ARE the touch player's skill icons: DASH and KICK show their own cooldown
// countdown (read from window.gameInput.getState()), and SHOP glows when an upgrade is
// affordable - so the in-canvas skill slots and "[E] STRATEGY SHOP" hint used on desktop
// are not drawn on touch screens (see main.js).

import { session } from "./config.js";
import { IS_TOUCH } from "./viewport.js";

export function initMobileControls() {
    if (!IS_TOUCH) return;

    const root = document.createElement("div");
    root.id = "touch-controls";
    root.innerHTML = `
        <button class="tc-btn tc-btn-pause" type="button" aria-label="Pause">II</button>
        <div class="tc-joystick-zone">
            <div class="tc-joystick-base">
                <div class="tc-joystick-knob"></div>
            </div>
        </div>
        <div class="tc-action-zone">
            <button class="tc-btn tc-btn-shop" type="button">SHOP</button>
            <div class="tc-action-row">
                <button class="tc-btn tc-btn-dash" type="button">DASH<span class="tc-cd"></span></button>
                <button class="tc-btn tc-btn-kick" type="button">KICK<span class="tc-cd"></span></button>
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
        // How far the knob may travel from the centre: the base radius minus the knob radius
        // (the base size follows the screen height, so this can't be a fixed pixel number).
        const maxOffset = Math.max(1, rect.width * 0.3);
        let dx = clientX - centerX;
        let dy = clientY - centerY;
        const dist = Math.hypot(dx, dy);
        if (dist > maxOffset) {
            dx = (dx / dist) * maxOffset;
            dy = (dy / dist) * maxOffset;
        }
        joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
        // Normalize to [-1, 1] on each axis for the movement update to consume directly.
        session.run.touchVec.x = dx / maxOffset;
        session.run.touchVec.y = dy / maxOffset;
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

    // --- Per-frame sync with the match ---
    // Visible only while a match is in progress, and hidden while paused or while the shop
    // is open (the shop has its own on-canvas RESUME button), so the only interactive thing
    // on screen during those moments is the overlay that owns the screen.
    const dashCd = dashBtn.querySelector(".tc-cd");
    const kickCd = kickBtn.querySelector(".tc-cd");
    let wasVisible = false;
    function frame() {
        const visible = !!window.gameInputActive && !debug.paused && !session.run.isUpgrading;
        if (visible !== wasVisible) {
            root.style.display = visible ? "block" : "none";
            wasVisible = visible;
            if (!visible) resetJoystick();
        }
        if (visible) {
            const st = window.gameInput?.getState?.();
            if (st) {
                const setCd = (btn, label, secs) => {
                    const cooling = secs > 0;
                    btn.classList.toggle("tc-cooling", cooling);
                    const txt = cooling ? String(Math.ceil(secs)) : "";
                    if (label.textContent !== txt) label.textContent = txt;
                };
                setCd(dashBtn, dashCd, st.dashCooldown);
                setCd(kickBtn, kickCd, st.kickCooldown);
                shopBtn.classList.toggle("tc-glow-rare", !!st.endgameAffordable);
                shopBtn.classList.toggle("tc-glow", !st.endgameAffordable && !!st.normalAffordable);
            }
        }
        requestAnimationFrame(frame);
    }
    root.style.display = "none";
    requestAnimationFrame(frame);
}