import { session } from "../config.js";
import { tryEnterImmersive } from "../viewport.js";

export default function loadInteractionGateScene() {
    scene("interaction_gate", () => {
        window.gameInputActive = false;
        debug.paused = false;
        add([rect(width(), height()), color(10, 14, 12)]);

        const promptText = add([
            text("TAP TO ENTER STADIUM", { size: 24, font: "bebas" }),
            pos(center()),
            anchor("center"),
            color(0, 215, 140)
        ]);

        onUpdate(() => {
            promptText.opacity = wave(0.3, 1, time() * 4);
        });

        let entered = false;
        const unlockAudio = () => {
            if (entered) return; // a click AND a keypress in the same frame used to fire this twice
            entered = true;
            tryEnterImmersive(); // phones: fullscreen + landscape, must happen inside this tap
            // Explicitly resume the Web Audio context from inside the user gesture. Browsers
            // start it "suspended" until the first tap/key; relying on a later side effect
            // to resume it is fragile (and is the classic "game is silent" failure).
            try { audioCtx.resume(); } catch (e) { /* older Kaboom builds: play() resumes it */ }
            session.audio.bgm = play("menu_theme", { loop: true, volume: 0.35 });
            go("loading");
        };

        onMousePress(unlockAudio);
        onKeyPress(unlockAudio);
    });
}