// --- PERSISTENT AUDIO TOGGLE ---
// A single always-visible mute button, implemented as a DOM overlay so it survives scene
// changes without every scene needing its own copy of a mute button. Talks to the global
// play() wrapper installed in main.js (which reads session.audio.muted/musicVolume/sfxVolume
// on every call) and directly nudges any currently-looping tracks (menu bgm / stadium
// ambience) via applyAudioSettingsToLoops(), since those were already playing before a
// mute toggle and won't get a fresh play() call to pick up the new volume.

import { session, saveAudioSettings } from "./config.js";
import { applyAudioSettingsToLoops } from "./helpers.js";

export function initAudioToggle() {
    const btn = document.createElement("button");
    btn.id = "audio-toggle";
    btn.type = "button";
    btn.setAttribute("aria-label", "Toggle sound");
    document.body.appendChild(btn);

    function render() {
        btn.textContent = session.audio.muted ? "🔇" : "🔊";
        btn.classList.toggle("tc-muted", session.audio.muted);
    }

    btn.addEventListener("click", () => {
        session.audio.muted = !session.audio.muted;
        saveAudioSettings();
        applyAudioSettingsToLoops();
        render();
    });

    render();
    applyAudioSettingsToLoops();
}
