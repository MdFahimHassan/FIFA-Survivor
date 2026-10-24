import { deferredBatches } from "../assets.js";
import { preloadFirebase } from "../config.js";
import { IS_TOUCH } from "../viewport.js";

export default function loadLoadingScene() {
    scene("loading", () => {
        window.gameInputActive = false;
        debug.paused = false;
        // Everything (critical + the rest) now loads HERE, behind the loading bar, instead
        // of in the background on the menu - background texture/audio decoding while the menu
        // was animating is what made it stutter. The bar tracks the real download
        // (loadProgress()) but never finishes before this minimum, so the screen doesn't flash by.
        // Raise/lower this number to taste.
        const MIN_LOADING_TIME = 2.8;
        // Start the remaining asset batches one at a time, spread across the first ~1.2s,
        // instead of all in one frame (that burst of decoding is what caused the stutter).
        const BATCH_GAP = 0.25;
        let batchesStarted = 0;
        deferredBatches.forEach((startBatch, i) => {
            wait(0.1 + i * BATCH_GAP, () => { startBatch(); batchesStarted++; });
        });
        // Firebase's SDK is parsed on the main thread too, so it goes after the asset batches.
        wait(0.1 + deferredBatches.length * BATCH_GAP + 0.3, preloadFirebase);
        let elapsed = 0;
        let progress = 0;
        const barMaxWidth = 280;

        const loadBg = add([sprite("stadium"), pos(center()), anchor("center"), scale(1), z(0)]);
        loadBg.onUpdate(() => {
            if (loadBg.width && loadBg.height) {
                const scaleFactor = Math.max(width() / loadBg.width, height() / loadBg.height);
                loadBg.scale = vec2(scaleFactor, scaleFactor);
            }
        });

        const baseX = center().x;
        const baseY = center().y;

        const spinningO = add([
            sprite("loading_ball"), pos(baseX - 59, baseY - 28),
            scale(0.36), rotate(0), anchor("center"), z(10) // loading_ball.png is now 140px wide (was 504px at scale 0.1), so 0.36 keeps the same ~50px on screen
        ]);

        add([text("L", { size: 54, font: "bebas" }), pos(baseX - 105, baseY - 50), color(255, 255, 255), outline(2, rgb(10, 10, 10))]);
        add([text("ADING", { size: 54, font: "bebas", letterSpacing: 2 }), pos(baseX - 32, baseY - 50), color(255, 255, 255), outline(2, rgb(10, 10, 10))]);

        add([rect(barMaxWidth + 8, 12, { radius: 6 }), pos(baseX, baseY + 40), color(20, 26, 23), outline(1, rgb(45, 60, 50)), anchor("center"), z(5)]);
        const progressFill = add([rect(0, 6, { radius: 3 }), pos(baseX - barMaxWidth / 2, baseY + 40), color(0, 215, 140), anchor("left"), z(6)]);
        const percentLabel = add([text("0%", { size: 14, font: "bebas" }), pos(baseX, baseY + 66), anchor("center"), color(150, 220, 195), z(6)]);

        const tips = IS_TOUCH ? [
            "TIP: Tap DASH to slide-tackle through a crowd of rivals.",
            "TIP: KICK unleashes a bicycle-kick shockwave in every direction.",
            "TIP: Golden Balls advance you - don't just farm coins!",
            "TIP: Standing still too long enrages nearby rivals - keep moving.",
            "TIP: Tap SHOP when you can afford an upgrade.",
            "Congratulations to SPAIN for winning the FIFA 2026 World Cup!"
        ] : [
            "TIP: Hold SHIFT to slide-tackle through a crowd of rivals.",
            "TIP: SPACE unleashes a bicycle-kick shockwave in every direction.",
            "TIP: Golden Balls advance you - don't just farm coins!",
            "TIP: Standing still too long enrages nearby rivals - keep moving.",
            "TIP: Open the Strategy Shop with [E] when you can afford an upgrade.",
            "Congratulations to SPAIN for winning the FIFA 2026 World Cup!"
        ];
        const TIP_BOX_PADDING_X = 28;
        const tipBox = add([rect(10, 34, { radius: 6 }), pos(baseX, baseY + 100), anchor("center"), color(6, 10, 8), opacity(0.72), outline(1, rgb(0, 150, 100)), z(5)]);
        const tipLabel = add([
            text(choose(tips), { size: 13, font: "teko" }),
            pos(baseX, baseY + 100), anchor("center"), color(225, 235, 230), outline(1, rgb(5, 8, 6)), z(6)
        ]);
        const fitTipBox = () => { tipBox.width = tipLabel.width + TIP_BOX_PADDING_X; };
        fitTipBox();
        wait(0, fitTipBox); // safety re-measure a frame later, in case width isn't final synchronously
        loop(3, () => { tipLabel.text = choose(tips); fitTipBox(); });

        onUpdate(() => {
            const smoothDt = Math.min(dt(), 0.016);
            spinningO.angle += smoothDt * 160;
            elapsed += dt();
            // Bar follows real download progress, never moves backwards, and can't hit 100%
            // before the minimum display time.
            const allQueued = batchesStarted >= deferredBatches.length;
            const target = Math.min(allQueued ? loadProgress() : 0.9 * loadProgress(), elapsed / MIN_LOADING_TIME, 1);
            // Ease the bar toward the target instead of snapping to it: real download
            // progress arrives in jumps, and a frame-by-frame snap looks like stutter.
            progress = Math.max(progress, progress + (target - progress) * Math.min(1, dt() * 7));
            if (allQueued && loadProgress() >= 1 && elapsed >= MIN_LOADING_TIME && progress > 0.985) progress = 1;

            progressFill.width = barMaxWidth * progress;
            percentLabel.text = `${Math.floor(progress * 100)}%`;
            if (progress >= 1) {
                go("menu");
            }
        });
    });
}