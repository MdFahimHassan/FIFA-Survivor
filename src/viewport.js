// --- VIEWPORT / DEVICE HELPERS ---
//
// Desktop keeps the original behaviour: the Kaboom canvas simply fills the window and every
// scene lays itself out in real pixels.
//
// Phones and tablets get a FIXED-SIZE STAGE instead (Kaboom "letterbox" mode): the game is
// always laid out on the same ~960-1170 x 540 canvas and the browser scales that whole picture
// to fit the screen. That is what stops the layouts from overflowing on a short landscape
// screen (a phone is only ~390px tall) and from re-laying-out when the address bar moves or
// the keyboard opens. Scenes check IS_TOUCH for the few places that need a compact layout or
// touch wording instead of keyboard wording.

function detectTouch() {
    try {
        if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return true;
        const hasTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
        // A touch-screen laptop is still a desktop; only treat small touch screens as phones/tablets.
        return hasTouch && Math.min(window.screen.width, window.screen.height) < 900;
    } catch (e) {
        return false;
    }
}

export const IS_TOUCH = detectTouch();

// Logical stage size used in touch mode. Height is fixed so every layout can rely on it;
// width follows the device's aspect ratio (long phones get a wider stage, so less black bar).
export function getStageSize() {
    const long = Math.max(window.innerWidth, window.innerHeight);
    const short = Math.max(1, Math.min(window.innerWidth, window.innerHeight));
    const aspect = long / short;
    const h = aspect < 1.6 ? 600 : 540; // squarer tablets get a little more height
    const w = Math.round(Math.min(1170, Math.max(960, h * aspect)));
    return { w, h };
}

// Tag <html> so style.css can switch on touch-only rules, and wire up the "rotate your
// phone" overlay (shown by CSS in portrait; JS only auto-pauses a running match behind it).
export function initViewport() {
    if (!IS_TOUCH) return;
    document.documentElement.classList.add("touch-ui");

    const overlay = document.createElement("div");
    overlay.id = "rotate-overlay";
    overlay.innerHTML = `
        <div class="ro-card">
            <div class="ro-phone"></div>
            <div class="ro-title">ROTATE YOUR PHONE</div>
            <div class="ro-sub">FIFA Survivor plays on the full pitch in landscape.</div>
        </div>`;
    document.body.appendChild(overlay);

    const mq = window.matchMedia("(orientation: portrait)");
    const onChange = () => {
        if (mq.matches && window.gameInputActive) window.gameInput?.togglePause?.();
    };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
}

// Best-effort: go fullscreen and lock to landscape from inside a user gesture (Android
// Chrome honours this; iOS Safari ignores it, which is fine - the rotate overlay covers it).
export function tryEnterImmersive() {
    if (!IS_TOUCH) return;
    try {
        const el = document.documentElement;
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        const p = req && req.call(el);
        const lock = () => { try { window.screen.orientation?.lock?.("landscape").catch(() => { }); } catch (e) { /* unsupported */ } };
        if (p && p.then) p.then(lock).catch(() => { }); else lock();
    } catch (e) { /* unsupported */ }
}