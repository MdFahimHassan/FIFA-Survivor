import { session } from "../config.js";

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

        const unlockAudio = () => {
            session.audio.bgm = play("menu_theme", { loop: true, volume: 0.35 });
            go("loading");
        };

        onMousePress(unlockAudio);
        onKeyPress(unlockAudio);
    });
}