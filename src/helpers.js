// --- SYSTEM ARCHITECTURE HELPER UTILITIES ---

import { session } from "./config.js";
import { BALANCE } from "./balance.js";

export const deg2rad = (deg) => deg * Math.PI / 180;
export const rad2deg = (rad) => rad * 180 / Math.PI;

// mm:ss formatter for match-duration displays on the win/lose result screens
export function formatMatchTime(totalSeconds) {
    const clamped = Math.max(0, Math.floor(totalSeconds || 0));
    const mins = Math.floor(clamped / 60);
    const secs = clamped % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ==========================================
// BRANDING
// ==========================================
export function addBranding() {
    const logo = add([
        sprite("fifa26"),
        pos(20, 10),
        scale(0.3),
        anchor("topleft"),
        fixed(),
        z(100),
        opacity(0.92)
    ]);
    logo.onUpdate(() => { logo.opacity = 0.82 + Math.sin(time() * 1.6) * 0.1; });

    add([
        sprite("my_club"),
        pos(width() - 15, 10),
        anchor("topright"),
        scale(0.3),
        fixed(),
        z(100)
    ]);
}

// ==========================================
// SCENE TRANSITION (soft fade-in used on every scene)
// ==========================================
export function fadeInScene(duration = 0.45) {
    const veil = add([
        rect(width(), height()),
        pos(0, 0),
        color(6, 9, 8),
        opacity(1),
        fixed(),
        z(500)
    ]);
    tween(1, 0, duration, (o) => veil.opacity = o, easings.easeOutQuad);
    wait(duration, () => destroy(veil));
}

// Small reusable "punch" scale-pop for UI/score feedback.
export function punch(obj, factor = 1.25, upDur = 0.08, downDur = 0.18) {
    if (!obj) return;
    // Capture the object's true resting scale ONCE. Reading obj.scale.x fresh on every
    // call was the bug: rapid repeat calls (e.g. several coins pulled in by the magnet
    // within the same fraction of a second) would read an already mid-tween, inflated
    // value as their new "base" and scale up from that - compounding into runaway growth.
    if (obj._punchBaseScale === undefined) {
        obj._punchBaseScale = (obj.scale && obj.scale.x) ? obj.scale.x : 1;
    }
    const base = obj._punchBaseScale;
    if (obj._punchTween) obj._punchTween.cancel();
    obj._punchTween = tween(obj.scale, vec2(base * factor), upDur, (v) => obj.scale = v, easings.easeOutQuad);
    wait(upDur, () => {
        if (obj._punchTween) obj._punchTween.cancel();
        obj._punchTween = tween(obj.scale, vec2(base), downDur, (v) => obj.scale = v, easings.easeOutQuad);
    });
}

// Staggered fade + rise-in entrance for menu/UI elements. Objects with no pos() of their
// own (e.g. child text inside a button, positioned purely via anchor()) just fade in
// place - only objects with a real pos also get the rise/slide motion.
export function riseIn(obj, delay = 0, dist = 18, duration = 0.35) {
    const hasPos = obj.pos !== undefined && obj.pos !== null;
    const targetPos = hasPos ? (obj.pos.clone ? obj.pos.clone() : vec2(obj.pos.x, obj.pos.y)) : null;
    const targetOpacity = (obj.opacity !== undefined) ? obj.opacity : 1;
    if (hasPos) obj.pos = vec2(targetPos.x, targetPos.y + dist);
    obj.opacity = 0;
    wait(delay, () => {
        if (hasPos) tween(obj.pos, targetPos, duration, (p) => obj.pos = p, easings.easeOutQuad);
        tween(0, targetOpacity, duration, (o) => obj.opacity = o, easings.easeOutQuad);
    });
}

// ==========================================
// NAVIGATION RETURN CONTEXT
// ==========================================
// A tiny "where did I come from" pointer so a screen like Settings or Help can be opened
// from more than one place (main menu, or the win/lose recap) and its Back button still
// lands somewhere sensible either way, without every caller having to wire that up by hand.
let _navigationReturn = null;

// Call instead of go() when navigating to a screen that has (or should have) a Back
// button - remembers where to return to, then navigates.
export function goWithReturn(targetScene, returnScene, returnArgs = []) {
    _navigationReturn = { scene: returnScene, args: returnArgs };
    go(targetScene);
}

// Reads (and clears) the pending return context. Call once, on scene entry, and hold on
// to the result locally - calling it a second time would return null since it's consumed.
export function consumeReturnContext() {
    const ctx = _navigationReturn;
    _navigationReturn = null;
    return ctx;
}

// Call from a Back button: returns to whatever screen navigated here via goWithReturn,
// or to fallbackScene if this screen was opened some other way (e.g. Settings from the
// main menu, which has no "previous screen" worth returning to).
export function returnToPrevious(fallbackScene = "menu") {
    const ctx = consumeReturnContext();
    if (ctx) {
        go(ctx.scene, ...ctx.args);
    } else {
        go(fallbackScene);
    }
}

// ==========================================
// "LEAVE TO MAIN MENU" CONFIRMATION
// ==========================================
// Plain DOM overlay (same approach as the name-entry prompt in menu.js) so it works
// identically whether it's triggered from a live match (debug.paused) or a Kaboom-driven
// results screen. Only calls onConfirm if the player actually confirms leaving.
let _leaveMenuPromptOpen = false;
export function confirmLeaveToMenu(onConfirm) {
    if (_leaveMenuPromptOpen) return;
    _leaveMenuPromptOpen = true;

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(3, 8, 12, 0.86)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "99999";
    overlay.style.fontFamily = "Arial, sans-serif";

    const card = document.createElement("div");
    card.style.width = "min(92vw, 360px)";
    card.style.padding = "24px";
    card.style.borderRadius = "14px";
    card.style.background = "linear-gradient(135deg, #1a0d0d, #2d1a1a)";
    card.style.border = "2px solid #ff6b6b";
    card.style.boxShadow = "0 16px 40px rgba(0,0,0,0.45)";
    card.style.textAlign = "center";

    const title = document.createElement("div");
    title.textContent = "LEAVE THIS MATCH?";
    title.style.color = "#ffe8a3";
    title.style.fontSize = "20px";
    title.style.fontWeight = "700";
    title.style.marginBottom = "10px";

    const subtitle = document.createElement("div");
    subtitle.textContent = "Heading back to the main menu means you'll have to start with a new profile.";
    subtitle.style.color = "#dce8e2";
    subtitle.style.fontSize = "13px";
    subtitle.style.lineHeight = "1.4";
    subtitle.style.marginBottom = "18px";

    const btnRow = document.createElement("div");
    btnRow.style.display = "flex";
    btnRow.style.gap = "10px";
    btnRow.style.justifyContent = "center";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "STAY";
    cancelBtn.style.padding = "10px 16px";
    cancelBtn.style.borderRadius = "8px";
    cancelBtn.style.border = "1px solid #6ad4a7";
    cancelBtn.style.background = "transparent";
    cancelBtn.style.color = "#dce8e2";
    cancelBtn.style.cursor = "pointer";
    cancelBtn.style.fontWeight = "700";

    const confirmBtn = document.createElement("button");
    confirmBtn.textContent = "LEAVE MATCH";
    confirmBtn.style.padding = "10px 16px";
    confirmBtn.style.borderRadius = "8px";
    confirmBtn.style.border = "none";
    confirmBtn.style.background = "#ff6b6b";
    confirmBtn.style.color = "#1a0d0d";
    confirmBtn.style.cursor = "pointer";
    confirmBtn.style.fontWeight = "700";

    const cleanup = () => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        _leaveMenuPromptOpen = false;
    };

    cancelBtn.addEventListener("click", cleanup);
    confirmBtn.addEventListener("click", () => { cleanup(); onConfirm(); });
    overlay.addEventListener("click", (event) => { if (event.target === overlay) cleanup(); });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(confirmBtn);
    card.appendChild(title);
    card.appendChild(subtitle);
    card.appendChild(btnRow);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
}

// Post-match action row (Try Again / Main Menu / Settings / Help), shared by the win and
// lose screens so both stay in sync. `sceneName`/`sceneArgs` identify the calling screen
// itself, so SETTINGS/HELP can bring the player back here afterward via goWithReturn.
export function createPostMatchActions(sceneName, sceneArgs, yPos) {
    const actions = [
        { label: "TRY AGAIN", run: () => { debug.paused = false; go("main"); } },
        { label: "MAIN MENU", run: () => confirmLeaveToMenu(() => go("menu")) },
        { label: "SETTINGS", run: () => goWithReturn("settings", sceneName, sceneArgs) },
        { label: "HELP", run: () => goWithReturn("instructions", sceneName, sceneArgs) }
    ];

    const btnW = 132, btnH = 42, gap = 12;
    const totalW = actions.length * btnW + (actions.length - 1) * gap;
    const startX = center().x - totalW / 2 + btnW / 2;

    actions.forEach((action, i) => {
        const bx = startX + i * (btnW + gap);
        const isPrimary = i === 0;
        const btn = add([
            rect(btnW, btnH, { radius: 5 }), pos(bx, yPos), anchor("center"), scale(1),
            color(isPrimary ? rgb(0, 60, 40) : rgb(14, 20, 17)),
            outline(1.5, isPrimary ? rgb(0, 255, 150) : rgb(0, 180, 130)),
            area(), fixed(), z(300)
        ]);
        const label = btn.add([text(action.label, { size: 13, font: "bebas" }), anchor("center"), color(240, 245, 240), opacity(1)]);

        btn.onHover(() => {
            setCursor("pointer");
            play("ui_hover", { volume: 0.3 });
            btn.outline.color = rgb(255, 215, 0);
        });
        btn.onHoverEnd(() => {
            setCursor("default");
            btn.outline.color = isPrimary ? rgb(0, 255, 150) : rgb(0, 180, 130);
        });
        btn.onClick(() => { play("ui_click", { volume: 0.7 }); action.run(); });

        riseIn(btn, 0.75 + i * 0.06, 12, 0.3);
        riseIn(label, 0.75 + i * 0.06, 0, 0.3);
    });
}

// ==========================================
// DIFFICULTY PROGRESSION
// ==========================================
export function advancePhase() {
    session.run.enemySpeed += BALANCE.enemySpeedIncreasePerPhase;
    session.run.spawnRate *= BALANCE.spawnRateDecayPerPhase;

    // Crowd roars whenever a new phase kicks off (mid-tournament, not on kickoff/final win screen).
    // Volume climbs and pitch drops slightly deeper into the tournament, so the Final's
    // roar reads as bigger than the Round of 32's, using the same one audio file.
    if (session.run.phase >= 2 && session.run.phase <= 10) {
        const intensity = Math.min(1, (session.run.phase - 1) / 9);
        play("crowd_cheer", { volume: 0.4 + intensity * 0.3, detune: -intensity * 150 });
    }
}

export function getPhaseName(phase) {
    const names = [
        "GROUP STAGE (A-D)", "GROUP STAGE (E-H)", "ROUND OF 32",
        "ROUND OF 16", "QUARTER FINALS", "SEMI FINALS",
        "3RD PLACE PLAY-OFF", "ROAD TO THE FINAL", "FINAL COUNTDOWN", "WORLD CUP FINAL"
    ];
    return names[phase - 1] || "WORLD CUP CHAMPION";
}

// Rival "difficulty tier" unlocks progressively by phase, same curve as the original build,
// and each type carries its own visual scale so you can read enemy danger at a glance.
export const ENEMY_VISUALS = {
    normal: { scale: 0.8, hp: 1 },
    winger: { scale: 0.6, hp: 1 },
    defender: { scale: 1.1, hp: 2 },
    boss: { scale: 2.0, hp: 15 }
};

export function rollEnemyType(phase) {
    let type = "normal";
    if (phase >= 4 && phase < 7) type = choose(["normal", "normal", "winger"]);
    else if (phase >= 7 && phase < 10) type = choose(["normal", "winger", "defender"]);
    else if (phase >= 10) type = choose(["normal", "winger", "defender", "boss"]);
    return type;
}

// Smooth rainbow cycle - hand-rolled instead of relying on an hsl helper, so it doesn't
// depend on anything beyond plain rgb(). Shared by the shop's endgame-tier glow (main.js)
// and the rare-achievement toast glow (achievements.js) so both cycle identically.
export const rainbowColor = (t) => rgb(
    Math.sin(t) * 127 + 128,
    Math.sin(t + 2.094) * 127 + 128,
    Math.sin(t + 4.188) * 127 + 128
);

// ==========================================
// PARTICLES / JUICE
// ==========================================
export function spawnParticles(spawnPos, customColor = rgb(255, 255, 255), count = 6) {
    for (let i = 0; i < count; i++) {
        add([
            rect(6, 6), pos(spawnPos), color(customColor), anchor("center"),
            move(rand(0, 360), rand(150, 350)), opacity(1), lifespan(0.25, { fade: 0.25 }), z(40)
        ]);
    }
}

// Quick expanding ring flash - used for kills and impacts
export function spawnImpactRing(spawnPos, ringColor = rgb(255, 255, 255), maxRadius = 34) {
    const ring = add([
        circle(4), pos(spawnPos), color(ringColor), opacity(0.6), anchor("center"), z(41)
    ]);
    tween(4, maxRadius, 0.26, (r) => ring.radius = r, easings.easeOutQuad);
    tween(0.6, 0, 0.26, (o) => ring.opacity = o, easings.easeOutQuad);
    wait(0.26, () => destroy(ring));
}

// Tiny muzzle flash at the player's feet when a shot is fired
export function spawnMuzzleFlash(spawnPos) {
    const flash = add([
        circle(4), pos(spawnPos), color(255, 245, 200), opacity(0.85), anchor("center"), z(29)
    ]);
    tween(4, 12, 0.1, (r) => flash.radius = r, easings.easeOutQuad);
    tween(0.85, 0, 0.12, (o) => flash.opacity = o, easings.easeOutQuad);
    wait(0.12, () => destroy(flash));
}

// Falling confetti piece for the win screen
export function spawnConfettiPiece() {
    const palette = [rgb(255, 215, 0), rgb(0, 215, 140), rgb(255, 255, 255), rgb(0, 190, 255), rgb(255, 90, 90)];
    const piece = add([
        rect(rand(4, 8), rand(9, 15)),
        pos(rand(0, width()), -20),
        anchor("center"),
        color(choose(palette)),
        opacity(1),
        rotate(rand(0, 360)),
        fixed(),
        z(300),
        lifespan(4.5, { fade: 0.8 }),
        move(DOWN, rand(70, 150))
    ]);
    const spinSpeed = rand(-220, 220);
    piece.onUpdate(() => { piece.angle += dt() * spinSpeed; });
}

export function spawnCoin(spawnPos) {
    add([
        sprite("coin"), pos(spawnPos), scale(1.0), area(), anchor("center"),
        lifespan(10, { fade: 1.5 }), "coin", z(20)
    ]);
}

export function spawnGoldenBall(spawnPos) {
    const gb = add([
        sprite("golden_ball"), pos(spawnPos), scale(1.0), area(), anchor("center"),
        lifespan(5, { fade: 1.0 }), "goldenball", z(20)
    ]);
    gb.onUpdate(() => { gb.angle += dt() * 60; });
    gb.onDraw(() => {
        drawCircle({
            pos: vec2(0, 0),
            radius: 36 + Math.sin(time() * 10) * 5,
            color: rgb(255, 215, 0),
            opacity: 0.45,
            fill: true
        });
    });
}

function getGoldenBallChance() {
    if (session.run.phase <= 1) return 0.30;
    if (session.run.phase >= 10) return 0.03;
    const slope = (0.03 - 0.30) / 9;
    return Math.max(0.03, 0.30 + slope * (session.run.phase - 1));
}

export function rollStandardLoot(spawnPos) {
    if (chance(getGoldenBallChance())) spawnGoldenBall(spawnPos);
    else spawnCoin(spawnPos);
}

export function dropEnemyLoot(enemyPos, enemyType = "normal") {
    if (enemyType === "boss") {
        for (let i = 0; i < 9; i++) spawnCoin(enemyPos.add(rand(-40, 40), rand(-40, 40)));
        for (let i = 0; i < 4; i++) spawnGoldenBall(enemyPos.add(rand(-40, 40), rand(-40, 40)));
        return;
    }
    if (enemyType === "defender") {
        rollStandardLoot(enemyPos.add(rand(-20, 20), rand(-20, 20)));
        rollStandardLoot(enemyPos.add(rand(-20, 20), rand(-20, 20)));
        return;
    }
    rollStandardLoot(enemyPos.add(rand(-20, 20), rand(-20, 20)));
    if (chance(0.25)) rollStandardLoot(enemyPos.add(rand(-20, 20), rand(-20, 20)));
}

// ==========================================
// AUDIO
// ==========================================
// Fades a currently-playing loop out (and stops it once silent) while fading a newly
// started one in, instead of the old hard stop()/play() cut. Respects whatever mute/
// volume wrapper main.js has installed on play(), since it just calls play() normally.
export function crossfadeTo(newSoundId, targetVolume, outgoingHandle, duration = 0.6, opts = {}) {
    const effectiveTarget = session.audio.muted ? 0 : targetVolume * session.audio.musicVolume;
    const incoming = play(newSoundId, { ...opts, loop: true, volume: 0 });
    tween(0, effectiveTarget, duration, (v) => incoming.volume = v, easings.easeOutQuad);
    if (outgoingHandle) {
        const startVolume = outgoingHandle.volume || 0;
        tween(startVolume, 0, duration, (v) => outgoingHandle.volume = v, easings.easeOutQuad);
        wait(duration, () => outgoingHandle.stop());
    }
    return incoming;
}

// Pushes the current mute/musicVolume setting onto whatever loop(s) are already playing.
// Needed because a loop's volume, once started, is just a plain property on its handle -
// it won't retroactively pick up a settings change the way a fresh play() call would.
// Called by the persistent mute button and by the Settings screen's sliders.
export function applyAudioSettingsToLoops() {
    const vol = session.audio.muted ? 0 : session.audio.musicVolume;
    if (session.audio.bgm) session.audio.bgm.volume = vol * 0.35;
    if (session.audio.gameAmbience) session.audio.gameAmbience.volume = vol * 0.18;
}

// Brief global-timescale dip for a frame of "weight" on big hits/kills. Restored through
// a REAL (unscaled) setTimeout rather than kaboom's own wait() - if we used wait() here,
// a near-zero timeScale would make wait() itself take ages to fire and the game would
// appear to hang.
export function hitStop(duration = 0.06, dipTo = 0.05) {
    debug.timeScale = dipTo;
    setTimeout(() => { debug.timeScale = 1; }, duration * 1000);
}

// Full-screen color veil that fades out - for damage taken, shield breaks, and similar
// "something just happened to you" moments. Sits above the HUD (z 550) but below the
// strategy-shop backdrop (z 200 in main.js's fixed-UI layer... actually shop uses lower z
// values than this on purpose, so a flash never gets stuck covering the shop UI).
export function screenFlash(flashColor = rgb(255, 60, 60), peakOpacity = 0.35, duration = 0.3) {
    const veil = add([
        rect(width(), height()), pos(0, 0), color(flashColor), opacity(peakOpacity), fixed(), z(550)
    ]);
    tween(peakOpacity, 0, duration, (o) => veil.opacity = o, easings.easeOutQuad);
    wait(duration, () => destroy(veil));
}

// Kill impact scales with how dangerous the thing you just killed was, so a boss going
// down reads as a much bigger deal than a normal rival - same particle/ring system as
// before, just tuned per tier instead of using one fixed size for everything.
const TIER_IMPACT = {
    normal:   { particles: 6,  ringRadius: 32, shakeAmount: 2,  hitStop: false, sfxDetune: 250,  sfxVolume: 0.3 },
    winger:   { particles: 6,  ringRadius: 32, shakeAmount: 2,  hitStop: false, sfxDetune: 400,  sfxVolume: 0.28 },
    defender: { particles: 11, ringRadius: 46, shakeAmount: 5,  hitStop: false, sfxDetune: -100, sfxVolume: 0.42 },
    boss:     { particles: 24, ringRadius: 72, shakeAmount: 12, hitStop: true,  sfxDetune: -350, sfxVolume: 0.6 }
};

export function spawnTieredKillImpact(spawnPos, tier = "normal", impactColor = rgb(255, 155, 50)) {
    const cfg = TIER_IMPACT[tier] || TIER_IMPACT.normal;
    spawnParticles(spawnPos, impactColor, cfg.particles);
    spawnImpactRing(spawnPos, impactColor, cfg.ringRadius);
    shake(cfg.shakeAmount);
    // Reuses the existing kick sfx rather than needing new audio assets - a lower/heavier
    // pitch on bigger kills, a brighter one on small ones, so kills don't all sound identical.
    play("ball_kick", { volume: cfg.sfxVolume, detune: cfg.sfxDetune });
    if (cfg.hitStop) hitStop(0.09, 0.04);
}