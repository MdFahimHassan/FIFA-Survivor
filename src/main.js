// =======================================================
// FIFA SURVIVOR: LAST TEAM STANDING (MAIN ROUTER ENTRY)
// =======================================================

import { loadSavedProfile, session } from "./config.js";
import { loadCriticalAssets } from "./assets.js";
import { initMobileControls } from "./mobile_controls.js";
import { initPauseMenu } from "./pause_menu.js";
import { IS_TOUCH, getStageSize, initViewport } from "./viewport.js";

const MIN_TEXT_SIZE = 16;

// Scene Modules
import loadInteractionGateScene from "./scenes/interaction_gate.js";
import loadLoadingScene from "./scenes/loading.js";
import loadMenuScene from "./scenes/menu.js";
import loadStartScene from "./scenes/start.js";
import loadInstructionsScene from "./scenes/instructions.js";
import loadMainGameScene from "./scenes/main.js";
import loadLoseScene from "./scenes/lose.js";
import loadWinScene from "./scenes/win.js";
import loadSettingsScene from "./scenes/settings.js";
import loadCreditsScene from "./scenes/credits.js";

// 1. Initialize Kaboom Canvas Sandbox
// Desktop: canvas fills the window (unchanged). Phones/tablets: fixed-size letterboxed
// stage that the browser scales to fit (see src/viewport.js).
const kaboomOpts = {
    background: [10, 14, 12],
    clearColor: [0, 0, 0, 1],
    loadingScreen: false
};
if (IS_TOUCH) {
    const stage = getStageSize();
    kaboomOpts.width = stage.w;
    kaboomOpts.height = stage.h;
    kaboomOpts.letterbox = true;
}
kaboom(kaboomOpts);

// On touch screens the stage is scaled down to fit (~0.7x on a phone), so very small text
// would end up unreadable. Every text() call funnels through here so nothing renders below a
// readable size; pass { noFloor: true } for the rare label that must stay small.
if (IS_TOUCH) {
    const _kaboomText = text;
    window.text = (str, opts = {}) => {
        const { noFloor, ...rest } = opts || {};
        if (!noFloor && typeof rest.size === "number") rest.size = Math.max(rest.size, MIN_TEXT_SIZE);
        return _kaboomText(str, rest);
    };
}

document.title = "FIFA Survivor";

// 1b. Restore whatever was remembered from a previous visit (name, team, mute state)
// before anything else touches session, so every scene sees the hydrated values.
loadSavedProfile();

// 1c. Every play() call in the whole game funnels through here. This is the one place
// mute/volume preferences are applied, so no individual scene file needs to know about
// audio settings at all - they just keep calling play("sfx", { volume: X }) like before.
// Loops (bgm/ambience) get session.audio.musicVolume; one-shots get session.audio.sfxVolume.
const _kaboomPlay = play;
window.play = (soundId, opts = {}) => {
    const requestedVolume = (opts && typeof opts.volume === "number") ? opts.volume : 1;
    const isMusic = !!(opts && opts.loop);
    const channelVolume = isMusic ? session.audio.musicVolume : session.audio.sfxVolume;
    const effectiveVolume = session.audio.muted ? 0 : requestedVolume * channelVolume;
    return _kaboomPlay(soundId, { ...opts, volume: effectiveVolume });
};

// 2. Load only the assets the first screens need. The rest (gameplay sounds, flags,
// achievement art, ...) is requested by the loading scene once the menu is about to show.
// NOTE: the five benchmark leaderboard docs are no longer re-written on every page load -
// they already exist in Firestore, and with the tightened rules a client can't overwrite
// them anyway.
loadCriticalAssets();

// 3. Register Application Routes
loadInteractionGateScene();
loadLoadingScene();
loadMenuScene();
loadStartScene();
loadInstructionsScene();
loadMainGameScene();
loadLoseScene();
loadWinScene();
loadSettingsScene();
loadCreditsScene();

// 4. Mount DOM overlays that live above every scene (mobile touch controls, mute toggle)
initViewport();
initMobileControls();
initPauseMenu();

// 5. Fire the Initial Audio Activation Gate
go("interaction_gate");