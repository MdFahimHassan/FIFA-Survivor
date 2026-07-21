import { fadeInScene, riseIn } from "../helpers.js";

export default function loadCreditsScene() {
    scene("credits", () => {
        window.gameInputActive = false;
        debug.paused = false;
        fadeInScene(0.4);

        add([rect(width(), height()), color(8, 12, 10)]);
        const bg = add([sprite("players"), pos(center()), anchor("center"), scale(1), z(0), opacity(0.25)]);
        bg.onUpdate(() => {
            if (bg.width && bg.height) {
                const scaleFactor = Math.max(width() / bg.width, height() / bg.height);
                bg.scale = vec2(scaleFactor, scaleFactor);
            }
        });

        const titleShadow = add([text("CREDITS", { size: 44, font: "bebas" }), pos(center().x + 3, height() * 0.14 + 3), anchor("center"), color(0, 0, 0), opacity(0.7)]);
        const titleFace = add([text("CREDITS", { size: 44, font: "bebas" }), pos(center().x, height() * 0.14), anchor("center"), color(255, 228, 160), outline(3, rgb(15, 15, 15))]);
        riseIn(titleShadow, 0.03);
        riseIn(titleFace, 0.03);

        const panel = add([
            rect(560, 380, { radius: 10 }), pos(center().x, height() * 0.55), anchor("center"),
            color(10, 16, 14), opacity(0.9), outline(2, rgb(0, 200, 140))
        ]);
        riseIn(panel, 0.12, 16, 0.35);

        const lines = [
            { text: "FIFA SURVIVOR: LAST TEAM STANDING", size: 20, font: "bebas", color: rgb(255, 215, 0), gap: 34 },
            { text: "A solo project by Md. Fahim Hassan", size: 15, font: "teko", color: rgb(230, 235, 230), gap: 24 },
            { text: "", size: 8, font: "teko", color: rgb(0, 0, 0), gap: 14 },
            { text: "Built for the Research & Development Department", size: 13, font: "teko", color: rgb(190, 205, 200), gap: 18 },
            { text: "of BUCC — BRAC University Computer Club", size: 13, font: "teko", color: rgb(190, 205, 200), gap: 18 },
            { text: "Club Fair, Summer 2026", size: 13, font: "teko", color: rgb(190, 205, 200), gap: 30 },
            { text: "— BUILT WITH —", size: 12, font: "bebas", color: rgb(0, 215, 140), gap: 22 },
            { text: "Kaboom.js  •  Firebase Firestore  •  JavaScript / HTML5 / CSS3", size: 12, font: "teko", color: rgb(200, 210, 205), gap: 34 },
            { text: "Every line of code, every design decision, and every 2am bug fix", size: 11, font: "teko", color: rgb(160, 175, 170), gap: 16 },
            { text: "in this game was built solo, from scratch, for the club fair floor.", size: 11, font: "teko", color: rgb(160, 175, 170), gap: 30 },
            { text: "Thanks for playing.", size: 15, font: "bebas", color: rgb(255, 255, 255), gap: 0 }
        ];

        let yCursor = height() * 0.55 - 155;
        lines.forEach((line, idx) => {
            if (line.text) {
                const entry = add([
                    text(line.text, { size: line.size, font: line.font }),
                    pos(center().x, yCursor), anchor("center"), color(line.color), opacity(1)
                ]);
                riseIn(entry, 0.2 + idx * 0.05, 10, 0.3);
            }
            yCursor += line.gap;
        });

        const backBtn = add([rect(160, 42, { radius: 4 }), pos(center().x, height() * 0.92), anchor("center"), color(10, 16, 14), outline(1.5, rgb(0, 255, 150)), area()]);
        backBtn.add([text("< BACK", { size: 16, font: "bebas" }), anchor("center"), color(255, 255, 255)]);
        backBtn.onClick(() => { play("ui_click", { volume: 0.6 }); go("menu"); });
        backBtn.onHover(() => { setCursor("pointer"); backBtn.outline.color = rgb(255, 215, 0); });
        backBtn.onHoverEnd(() => { setCursor("default"); backBtn.outline.color = rgb(0, 255, 150); });
        onKeyPress("escape", () => { play("ui_click", { volume: 0.6 }); go("menu"); });
    });
}
