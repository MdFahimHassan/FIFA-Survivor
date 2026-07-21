// =======================================================
// FIFA SURVIVOR: LAST TEAM STANDING (MAIN ROUTER ENTRY)
// =======================================================

import { seedInitialBenchmarks, loadSavedProfile, session } from "./config.js";
import { loadAllAssets } from "./assets.js";
import { initMobileControls } from "./mobile_controls.js";
import { initPauseMenu } from "./pause_menu.js";

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
kaboom({
    background: [10, 14, 12],
    clearColor: [0, 0, 0, 1],
    loadingScreen: false 
});

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

// 2. Initialize Cloud Benchmarks & Data Assets
seedInitialBenchmarks();
loadAllAssets();

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
initMobileControls();
initPauseMenu();

// 5. Fire the Initial Audio Activation Gate
go("interaction_gate");