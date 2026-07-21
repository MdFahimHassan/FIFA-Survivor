import { session, savePlayerProfile } from "../config.js";
import { countriesList } from "../assets.js";
import { fadeInScene, riseIn, punch } from "../helpers.js";
import { unlockAchievement } from "../achievements.js";

export default function loadStartScene() {
    scene("start", () => {
        window.gameInputActive = false;
        debug.paused = false;
        fadeInScene(0.5);

        const bg = add([sprite("stadium"), pos(center()), anchor("center"), scale(1), z(0)]);
        bg.onUpdate(() => {
            if (bg.width && bg.height) {
                const scaleFactor = Math.max(width() / bg.width, height() / bg.height);
                bg.scale = vec2(scaleFactor, scaleFactor);
            }
        });

        const titleShadow = add([
            text("SELECT YOUR TEAM", { size: 52, font: "bebas" }),
            pos(center().x + 3, height() * 0.14 + 3),
            anchor("center"),
            color(0, 0, 0),
            opacity(0.9)
        ]);
        const titleFace = add([
            text("SELECT YOUR TEAM", { size: 52, font: "bebas" }),
            pos(center().x, height() * 0.14),
            anchor("center"),
            color(255, 228, 160),
            outline(3, rgb(15, 15, 15)),
            opacity(1)
        ]);

        const subShadow = add([
            text("CLICK A NATION FROM THE GRID TO CHOOSE YOUR SQUAD", { size: 16, font: "bebas", letterSpacing: 2 }),
            pos(center().x + 2, height() * 0.20 + 2),
            anchor("center"),
            color(0, 0, 0),
            opacity(0.85)
        ]);
        const subFace = add([
            text("CLICK A NATION FROM THE GRID TO CHOOSE YOUR SQUAD", { size: 16, font: "bebas", letterSpacing: 2 }),
            pos(center().x, height() * 0.20),
            anchor("center"),
            color(230, 240, 245),
            outline(2, rgb(15, 15, 15)),
            opacity(1)
        ]);

        riseIn(titleShadow, 0.03);
        riseIn(titleFace, 0.03);
        riseIn(subShadow, 0.14);
        riseIn(subFace, 0.14);

        const previewX = width() * 0.73;
        const previewY = height() * 0.48;

        const previewPanel = add([
            rect(280, 280, { radius: 8 }),
            pos(previewX, previewY),
            anchor("center"),
            color(8, 12, 10),
            opacity(0.85),
            outline(1, rgb(0, 255, 150)),
            fixed(),
            z(1)
        ]);
        riseIn(previewPanel, 0.2, 20, 0.4);

        // No team is pre-selected when this scene opens - the preview starts as an empty
        // placeholder (a dim trophy icon + "SELECT A TEAM" prompt) until the player taps
        // a nation from the grid below.
        let selectedCountry = null;

        const teamSprite = add([
            sprite("trophy"),
            pos(previewX, previewY - 20),
            anchor("center"),
            scale(1.3),
            opacity(0.25),
            z(2),
            fixed()
        ]);

        const teamLabel = add([
            text("SELECT A TEAM", { size: 20, font: "bebas" }),
            pos(previewX, previewY + 100),
            anchor("center"),
            color(180, 190, 185),
            outline(1, rgb(12, 12, 12)),
            fixed(),
            z(2)
        ]);

        const displayName = (name) => name.replace(/_/g, " ").replace(/&/g, " & ").toUpperCase();
        const gridStart = vec2(width() * 0.07, height() * 0.27);
        const cols = 5;
        const cellW = 122;
        const cellH = 42;
        const xGap = 128;
        const yGap = 52;
        const countryButtons = [];

        const selectionBorder = add([
            rect(cellW + 8, cellH + 8, { radius: 8 }),
            pos(0, 0),
            anchor("center"),
            outline(2, rgb(255, 215, 0)),
            color(0, 0, 0),
            opacity(0),
            fixed(),
            z(2)
        ]);

        const updateTeamDisplay = () => {
            if (!selectedCountry) return;
            teamSprite.use(sprite(selectedCountry));
            teamSprite.opacity = 1;
            teamLabel.text = displayName(selectedCountry);
            teamLabel.color = rgb(255, 255, 255);
            punch(teamSprite, 1.15);
            const selected = countryButtons.find((btn) => btn.country === selectedCountry);
            if (selected) {
                selectionBorder.pos = selected.pos.add(cellW / 2, cellH / 2);
                selectionBorder.opacity = 1;
            }
        };

        countriesList.forEach((country, idx) => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            const x = gridStart.x + col * xGap;
            const y = gridStart.y + row * yGap;

            const btn = add([
                rect(cellW, cellH, { radius: 3 }),
                pos(x, y),
                anchor("topleft"),
                color(10, 15, 12),
                opacity(0.75),
                outline(1, rgb(255, 255, 255)),
                area(),
                fixed(),
                z(1),
                { country }
            ]);

            btn.onHover(() => {
                play("ui_hover", { volume: 0.35 });
                btn.outline.color = rgb(0, 255, 150);
                setCursor("pointer");
            });

            btn.onHoverEnd(() => {
                btn.outline.color = rgb(255, 255, 255);
                setCursor("default");
            });

            const flagIcon = add([
                sprite(country),
                pos(x + 15, y + cellH / 2),
                anchor("center"),
                scale(0.42),
                fixed(),
                z(2)
            ]);

            const cellLabelText = displayName(country);
            const cellLabelSize = cellLabelText.length > 17 ? 7 : cellLabelText.length > 12 ? 8.5 : 10;
            const label = add([
                text(cellLabelText, { size: cellLabelSize, font: "bebas" }),
                pos(x + 30, y + cellH / 2),
                anchor("left"),
                color(240, 240, 240),
                opacity(1),
                fixed(),
                z(2)
            ]);

            // Cascading grid entrance - small stagger per cell so the grid "builds" on screen.
            // dist=0 keeps position exact throughout (fade only) so selection-border math below is never off.
            const cellDelay = 0.22 + (row * cols + col) * 0.012;
            riseIn(btn, cellDelay, 0, 0.25);
            riseIn(flagIcon, cellDelay, 0, 0.25);
            riseIn(label, cellDelay, 0, 0.25);

            btn.onClick(() => {
                play("ui_click", { volume: 0.85 });
                selectedCountry = country;
                session.player.teamSprite = country;
                savePlayerProfile();
                updateTeamDisplay();
                unlockAchievement("colours_chosen");
            });
            countryButtons.push(btn);
        });

        let startBtnTween = null;
        let confirmHovering = false;
        const confirmBtn = add([
            rect(240, 52, { radius: 4 }),
            pos(previewX, height() * 0.80),
            anchor("center"),
            scale(1),
            opacity(1),
            color(10, 16, 14),
            outline(1.5, rgb(0, 255, 150)),
            area(),
            fixed(),
            z(2)
        ]);
        riseIn(confirmBtn, 0.4, 14, 0.4);

        const confirmText = confirmBtn.add([
            text("START MATCH", { size: 24, font: "bebas" }),
            anchor("center"),
            color(255, 255, 255),
            opacity(1)
        ]);
        riseIn(confirmText, 0.4, 0, 0.4);

        confirmBtn.onUpdate(() => {
            if (!confirmHovering) {
                const pulse = wave(0.55, 1, time() * 2.4);
                confirmBtn.outline.color = rgb(0, 255 * pulse, 150 * pulse + 40);
            }
        });

        confirmBtn.onHover(() => {
            confirmHovering = true;
            play("ui_hover", { volume: 0.2 });
            setCursor("pointer");
            confirmBtn.outline.color = rgb(255, 215, 0);
            if (startBtnTween) startBtnTween.cancel();
            startBtnTween = tween(confirmBtn.scale, vec2(1.06), 0.15, (v) => confirmBtn.scale = v, easings.easeOutQuad);
        });

        confirmBtn.onHoverEnd(() => {
            confirmHovering = false;
            setCursor("default");
            confirmBtn.outline.color = rgb(0, 255, 150);
            if (startBtnTween) startBtnTween.cancel();
            startBtnTween = tween(confirmBtn.scale, vec2(1.0), 0.15, (v) => confirmBtn.scale = v, easings.easeOutQuad);
        });

        const tryStartMatch = () => {
            if (!selectedCountry) {
                play("ui_hover", { volume: 0.4 });
                punch(previewPanel, 1.05);
                teamLabel.text = "PICK A TEAM FIRST!";
                teamLabel.color = rgb(255, 120, 120);
                wait(1.1, () => {
                    if (!selectedCountry) {
                        teamLabel.text = "SELECT A TEAM";
                        teamLabel.color = rgb(180, 190, 185);
                    }
                });
                return;
            }
            play("ui_click", { volume: 0.5 });
            if (session.audio.bgm) session.audio.bgm.paused = true;
            go("instructions");
        };

        confirmBtn.onClick(tryStartMatch);
        onKeyPress("enter", tryStartMatch);

        // Back to the main menu - lets the player bail out of team selection (e.g. they
        // opened it by mistake, or want to re-enter their manager name) without being
        // forced through a full match first. Sits above the grid (which can run up to 10
        // rows deep) rather than below it, so it never overlaps a country cell.
        const backBtn = add([rect(110, 34, { radius: 4 }), pos(76, height() * 0.045), anchor("center"), color(10, 16, 14), outline(1.5, rgb(0, 255, 150)), area(), fixed(), z(3)]);
        backBtn.add([text("< BACK", { size: 13, font: "bebas" }), anchor("center"), color(255, 255, 255)]);
        riseIn(backBtn, 0.1, 10, 0.3);
        const goBack = () => { play("ui_click", { volume: 0.6 }); go("menu"); };
        backBtn.onClick(goBack);
        backBtn.onHover(() => { setCursor("pointer"); backBtn.outline.color = rgb(255, 215, 0); });
        backBtn.onHoverEnd(() => { setCursor("default"); backBtn.outline.color = rgb(0, 255, 150); });
        onKeyPress("escape", goBack);
    });
}
