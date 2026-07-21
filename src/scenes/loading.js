export default function loadLoadingScene() {
    scene("loading", () => {
        window.gameInputActive = false;
        debug.paused = false;
        const LOADING_TIME = 2.5;
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
            scale(0.1), rotate(0), anchor("center"), z(10)
        ]);

        add([text("L", { size: 54, font: "bebas" }), pos(baseX - 105, baseY - 50), color(255, 255, 255), outline(2, rgb(10, 10, 10))]);
        add([text("ADING", { size: 54, font: "bebas", letterSpacing: 2 }), pos(baseX - 32, baseY - 50), color(255, 255, 255), outline(2, rgb(10, 10, 10))]);

        add([rect(barMaxWidth + 8, 12, { radius: 6 }), pos(baseX, baseY + 40), color(20, 26, 23), outline(1, rgb(45, 60, 50)), anchor("center"), z(5)]);
        const progressFill = add([rect(0, 6, { radius: 3 }), pos(baseX - barMaxWidth / 2, baseY + 40), color(0, 215, 140), anchor("left"), z(6)]);
        const percentLabel = add([text("0%", { size: 14, font: "bebas" }), pos(baseX, baseY + 66), anchor("center"), color(150, 220, 195), z(6)]);

        const tips = [
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

        let assetsLoaded = false;
        onLoad(() => { assetsLoaded = true; });

        onUpdate(() => {
            const smoothDt = Math.min(dt(), 0.016);
            spinningO.angle += smoothDt * 160;
            progress += smoothDt / LOADING_TIME;
            if (progress > 1) progress = 1;

            progressFill.width = barMaxWidth * progress;
            percentLabel.text = `${Math.floor(progress * 100)}%`;
            if (progress >= 1 && assetsLoaded) {
                go("menu");
            }
        });
    });
}