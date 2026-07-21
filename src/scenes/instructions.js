import { addBranding, fadeInScene, riseIn, consumeReturnContext } from "../helpers.js";

export default function loadInstructionsScene() {
    scene("instructions", () => {
        window.gameInputActive = false;
        debug.paused = false;
        fadeInScene(0.5);

        // If we got here via goWithReturn (the win/lose screen's HELP button), this is a
        // read-only rules skim with a Back button - not the pre-match briefing, so no
        // "KICK OFF MATCH" CTA (that would start a brand new match from the recap screen,
        // which isn't what tapping HELP means).
        const returnCtx = consumeReturnContext();
        const isHelpMode = !!returnCtx;

        const bg = add([sprite("stadium"), pos(center()), anchor("center"), scale(1), z(0)]);
        bg.onUpdate(() => {
            if (bg.width && bg.height) {
                const scaleFactor = Math.max(width() / bg.width, height() / bg.height);
                bg.scale = vec2(scaleFactor, scaleFactor);
            }
        });

        const panel = add([rect(width() * 0.7, height() * 0.6, { radius: 8 }), pos(center()), anchor("center"), color(10, 16, 14), opacity(0.85), outline(2, rgb(0, 255, 150)), z(1)]);
        if (!isHelpMode) addBranding();

        const heading = add([text(isHelpMode ? "QUICK REFRESHER" : "HOW TO PLAY", { size: 44, font: "bebas" }), pos(width() / 2, height() * 0.26), anchor("center"), color(255, 215, 0), opacity(1), z(2)]);
        const mission = add([
            text("MISSION:\nSurvive the defensive pressure! Collect coins\nto purchase attributes inside the item shop and \nCollect Golden Balls to proceed to the next Match.\nReach the Final and win to emerge on the Leaderboards!!", { size: 20, font: "teko", align: "center", lineSpacing: 4 }),
            pos(width() / 2, height() * 0.42), anchor("center"), color(240, 240, 240), opacity(1), z(2)
        ]);

        const controls = add([
            text("CONTROLS:\n[WASD / ARROWS] : Move Striker\n[SHIFT] : Slide Tackle Dash (Invincible + Cleaves Rivals)\n[SPACE] : Bicycle Shockwave Kick (Massive Area Deflection)\n[E] : Open Strategy Upgrade Shop Matrix", { size: 16, font: "teko", align: "center", lineSpacing: 3 }),
            pos(width() / 2, height() * 0.63), anchor("center"), color(0, 215, 140), opacity(1), z(2)
        ]);

        riseIn(panel, 0, 24, 0.4);
        riseIn(heading, 0.15, 16, 0.35);
        riseIn(mission, 0.28, 16, 0.35);
        riseIn(controls, 0.42, 16, 0.35);

        let beginHovering = false;
        const btnLabel = isHelpMode ? "< BACK" : "KICK OFF MATCH";
        const beginBtn = add([rect(180, 38, { radius: 4 }), pos(width() / 2, height() * 0.78), anchor("center"), opacity(1), color(20, 25, 22), outline(1.5, rgb(255, 215, 0)), area(), z(2)]);
        const beginText = beginBtn.add([text(btnLabel, { size: 16, font: "bebas" }), anchor("center"), color(255, 255, 255), opacity(1)]);
        riseIn(beginBtn, 0.58, 14, 0.35);
        riseIn(beginText, 0.58, 0, 0.35);

        beginBtn.onUpdate(() => {
            if (!beginHovering) {
                const pulse = wave(0.55, 1, time() * 2.4);
                beginBtn.outline.color = rgb(255, 215 * pulse, 0);
            }
        });

        beginBtn.onHover(() => {
            beginHovering = true;
            play("ui_hover", { volume: 0.5 });
            setCursor("pointer");
            beginBtn.outline.color = rgb(0, 255, 150);
            beginBtn.scale = vec2(1.06, 1.06);
        });

        beginBtn.onHoverEnd(() => {
            beginHovering = false;
            setCursor("default");
            beginBtn.outline.color = rgb(255, 215, 0);
            beginBtn.scale = vec2(1.0, 1.0);
        });

        const proceed = () => {
            setCursor("default");
            play("ui_click", { volume: 0.6 });
            if (isHelpMode) {
                go(returnCtx.scene, ...returnCtx.args);
            } else {
                go("main");
            }
        };

        beginBtn.onClick(proceed);
        onKeyPress("enter", proceed);
        if (isHelpMode) onKeyPress("escape", proceed);

        // Pre-match briefing also needs its own way back to team selection - the recap's
        // HELP button already gets "< BACK" via btnLabel above, but that path returns to
        // the win/lose screen, not team select, so this is a separate secondary button.
        if (!isHelpMode) {
            const backBtn = add([rect(150, 38, { radius: 4 }), pos(width() / 2, height() * 0.86), anchor("center"), opacity(1), color(14, 18, 16), outline(1.2, rgb(0, 180, 130)), area(), z(2)]);
            const backText = backBtn.add([text("< BACK", { size: 14, font: "bebas" }), anchor("center"), color(220, 230, 225), opacity(1)]);
            riseIn(backBtn, 0.66, 12, 0.3);
            riseIn(backText, 0.66, 0, 0.3);
            const goBack = () => { play("ui_click", { volume: 0.6 }); go("start"); };
            backBtn.onClick(goBack);
            backBtn.onHover(() => { setCursor("pointer"); backBtn.outline.color = rgb(255, 215, 0); });
            backBtn.onHoverEnd(() => { setCursor("default"); backBtn.outline.color = rgb(0, 180, 130); });
            onKeyPress("escape", goBack);
        }
    });
}
