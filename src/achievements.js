// ==========================================
// ACHIEVEMENT SYSTEM ("Match Milestones")
// ==========================================
// A Minecraft-style toast system with no account/database behind it yet - everything
// lives in session.achievements (see config.js) so it's pure in-memory state: it survives
// "Try Again"/"Play Again" loops within the same browser tab (same session object), but
// resets the moment the player hits RESET SAVED PROFILE in Settings (see settings.js),
// or refreshes the page. That's the intended behaviour - a sense of accomplishment for
// *this* playthrough, without pretending to be a real persistent profile. When an actual
// account system exists, these can move to their own persisted section instead.
//
// 7 standard achievements + 4 rare ones (one of which - trophy_cabinet - is a meta
// achievement for unlocking every other one), 11 total. Two are menu-only (star_struck,
// full_squad); the rest span team selection through to the post-match leaderboard.
import { session } from "./config.js";
import { rainbowColor } from "./helpers.js";

export const ACHIEVEMENTS = {
    star_struck: {
        name: "Star Struck",
        phrase: "You spotted a legend in the crowd.",
        rare: false
    },
    full_squad: {
        name: "Full Squad",
        phrase: "Found every hidden celebration.",
        rare: false
    },
    colours_chosen: {
        name: "Colours Chosen",
        phrase: "Your team, your colours.",
        rare: false
    },
    kickoff: {
        name: "Kickoff",
        phrase: "Whistle blown, still standing.",
        rare: false
    },
    shop_smart: {
        name: "Shop Smart",
        phrase: "Knowledge is power, manager.",
        rare: false
    },
    first_blood: {
        name: "First Blood",
        phrase: "The first of many.",
        rare: false
    },
    golden_touch: {
        name: "Golden Touch",
        phrase: "Shining bright already.",
        rare: false
    },
    boss_down: {
        name: "Boss Down",
        phrase: "The big one goes down.",
        rare: true
    },
    world_class_legend: {
        name: "World Class Legend",
        phrase: "History has been made.",
        rare: true
    },
    leaderboard_material: {
        name: "Leaderboard Material",
        phrase: "Your name, in lights.",
        rare: true
    },
    trophy_cabinet: {
        name: "Trophy Cabinet",
        phrase: "There's nothing left to prove.",
        rare: true
    }
};

const ALL_IDS = Object.keys(ACHIEVEMENTS);
const COMPLETIONIST_ID = "trophy_cabinet";

export function isUnlocked(id) {
    return !!session.achievements.unlocked[id];
}

// Called by Settings' "RESET SAVED PROFILE" - see the module comment above for why this
// is the reset trigger instead of a dedicated button.
export function resetAchievements() {
    session.achievements.unlocked = {};
    toastSlotCount = 0;
}

export function unlockAchievement(id) {
    if (!ACHIEVEMENTS[id] || isUnlocked(id)) return;
    session.achievements.unlocked[id] = true;
    spawnToast(id);

    // Meta achievement - fires itself once every OTHER achievement is unlocked, so it's
    // always the last one to pop and never double-counts itself in its own check.
    if (id !== COMPLETIONIST_ID) {
        const rest = ALL_IDS.filter((a) => a !== COMPLETIONIST_ID);
        if (rest.every(isUnlocked)) unlockAchievement(COMPLETIONIST_ID);
    }
}

// ==========================================
// TOAST RENDERING
// ==========================================
// Kaboom is loaded as a global (see index.html), so add()/tween()/wait()/etc. are all
// available here exactly like in a scene file - whatever scene happens to be active when
// unlockAchievement() fires is the scene the toast renders into, with no wiring needed
// per-scene. If a scene change happens to cut a toast off mid-animation, it's destroyed
// along with everything else in that scene (normal Kaboom behaviour) - a rare enough
// edge case (an achievement firing in the last half-second before a scene transition)
// that it isn't worth extra plumbing to guard against.
const TOAST_W = 300;
const TOAST_H = 84;
const TOAST_GAP = 10;
const TOAST_TOP = 16;
const TOAST_MARGIN_RIGHT = 16;
const HOLD_TIME = 2.6;
const SLIDE_TIME = 0.4;

// Simple stacking counter rather than a strict queue - multiple toasts (e.g. the
// completionist one firing in the same tick as the achievement that triggered it) just
// stack vertically and animate independently instead of waiting in line. Slightly loses
// slot-collapsing precision if toasts finish out of order, but for 1-2 simultaneous
// toasts that's not visible in practice.
let toastSlotCount = 0;

function spawnToast(id) {
    const def = ACHIEVEMENTS[id];
    const slot = toastSlotCount++;
    const yPos = TOAST_TOP + slot * (TOAST_H + TOAST_GAP);
    const onscreenX = width() - TOAST_W - TOAST_MARGIN_RIGHT;
    const offscreenX = width() + 20;

    play(def.rare ? "rare_achievement" : "achievement", { volume: 0.85 });

    const baseGlowColor = def.rare ? rainbowColor(0) : rgb(255, 205, 0);

    const panel = add([
        rect(TOAST_W, TOAST_H, { radius: 10 }),
        pos(offscreenX, yPos),
        anchor("topleft"),
        color(10, 14, 12),
        opacity(0.96),
        outline(2.5, baseGlowColor),
        fixed(),
        z(600)
    ]);

    // Soft halo behind the panel - a CHILD of panel (not a sibling), so it automatically
    // slides/stacks with its parent with no manual position syncing needed.
    const glow = panel.add([
        rect(TOAST_W + 20, TOAST_H + 20, { radius: 16 }),
        pos(-10, -10),
        anchor("topleft"),
        color(baseGlowColor),
        opacity(0.2),
        fixed(),
        z(-1)
    ]);

    const iconSlot = panel.add([
        rect(56, 56, { radius: 8 }),
        pos(14, (TOAST_H - 56) / 2),
        anchor("topleft"),
        color(0, 0, 0),
        opacity(0.32),
        fixed(),
        z(1)
    ]);
    const icon = panel.add([
        sprite(def.rare ? "coin_3d" : "trophy"),
        pos(14 + 28, TOAST_H / 2),
        anchor("center"),
        scale(def.rare ? 0.22 : 0.7),
        fixed(),
        z(2)
    ]);
    if (def.rare && icon.play) icon.play("spin");

    const textX = 84;
    const titleTxt = panel.add([
        text(def.rare ? "RARE ACHIEVEMENT UNLOCKED!!!" : "ACHIEVEMENT UNLOCKED!", { size: 11, font: "bebas", letterSpacing: 1 }),
        pos(textX, 11),
        anchor("topleft"),
        color(255, 215, 0),
        fixed(),
        z(2)
    ]);
    panel.add([
        text(def.name, { size: 19, font: "bebas" }),
        pos(textX, 27),
        anchor("topleft"),
        color(255, 255, 255),
        outline(1, rgb(10, 10, 10)),
        fixed(),
        z(2)
    ]);
    panel.add([
        text(def.phrase, { size: 11, font: "teko", width: TOAST_W - textX - 14 }),
        pos(textX, 53),
        anchor("topleft"),
        color(205, 215, 210),
        fixed(),
        z(2)
    ]);

    // Golden pulse for standard achievements, RGB/rainbow pulse for rare ones - same
    // visual language as the in-match shop hint's endgame-tier glow (see main.js).
    panel.onUpdate(() => {
        const pulse = wave(0.4, 1, time() * (def.rare ? 3.2 : 2.4));
        if (def.rare) {
            const c = rainbowColor(time() * 3);
            panel.outline.color = c;
            glow.color = c;
            titleTxt.color = c;
        } else {
            const c = rgb(255, 195 + pulse * 20, 0);
            panel.outline.color = c;
            glow.color = rgb(255, 205, 0);
        }
        glow.opacity = 0.14 + pulse * 0.22;
        panel.opacity = 0.9 + pulse * 0.06;
    });

    // Slide in from the right, hold, slide back out, destroy - freeing this toast's slot.
    tween(offscreenX, onscreenX, SLIDE_TIME, (x) => { panel.pos.x = x; }, easings.easeOutQuad);
    wait(SLIDE_TIME + HOLD_TIME, () => {
        if (!panel.exists()) return;
        tween(panel.pos.x, offscreenX, SLIDE_TIME, (x) => { panel.pos.x = x; }, easings.easeInQuad);
        wait(SLIDE_TIME, () => {
            if (panel.exists()) destroy(panel);
            toastSlotCount = Math.max(0, toastSlotCount - 1);
        });
    });
}
