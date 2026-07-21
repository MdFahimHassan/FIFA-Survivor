import { session, saveAudioSettings, savePlayerProfile } from "../config.js";
import { fadeInScene, riseIn, punch, applyAudioSettingsToLoops, returnToPrevious } from "../helpers.js";
import { resetAchievements } from "../achievements.js";

export default function loadSettingsScene() {
    scene("settings", () => {
        window.gameInputActive = false;
        debug.paused = false;
        fadeInScene(0.4);

        add([rect(width(), height()), color(8, 12, 10)]);
        const bg = add([sprite("stadium"), pos(center()), anchor("center"), scale(1), z(0), opacity(0.35)]);
        bg.onUpdate(() => {
            if (bg.width && bg.height) {
                const scaleFactor = Math.max(width() / bg.width, height() / bg.height);
                bg.scale = vec2(scaleFactor, scaleFactor);
            }
        });

        // Layout: everything below is positioned relative to PANEL_TOP, not the title, so
        // there's no risk of a row ending up above the box it's supposed to live inside.
        const PANEL_WIDTH = 460;
        const PANEL_HEIGHT = 400;
        const PANEL_TOP = height() * 0.16;
        const panelCenterY = PANEL_TOP + PANEL_HEIGHT / 2;

        const titleShadow = add([text("SETTINGS", { size: 38, font: "bebas" }), pos(center().x + 3, PANEL_TOP - 38 + 3), anchor("center"), color(0, 0, 0), opacity(0.7)]);
        const titleFace = add([text("SETTINGS", { size: 38, font: "bebas" }), pos(center().x, PANEL_TOP - 38), anchor("center"), color(255, 228, 160), outline(3, rgb(15, 15, 15))]);
        riseIn(titleShadow, 0.03);
        riseIn(titleFace, 0.03);

        const panel = add([
            rect(PANEL_WIDTH, PANEL_HEIGHT, { radius: 10 }), pos(center().x, panelCenterY), anchor("center"),
            color(10, 16, 14), opacity(0.92), outline(2, rgb(0, 200, 140)), z(1)
        ]);
        riseIn(panel, 0.12, 16, 0.35);

        // Row Y positions, all measured down from the panel's own top edge - guaranteed
        // to stay inside the box no matter what PANEL_TOP ends up being.
        const rowY = (offsetFromPanelTop) => PANEL_TOP + offsetFromPanelTop;

        const SEGMENTS = 10;
        const BAR_X = center().x - 55;

        // A labeled volume row: [-] ██████░░░░ [+] with the current value shown as filled
        // segments. Step buttons rather than a drag-slider - simpler to get right, and
        // works identically with mouse or touch with no extra input handling.
        const createVolumeRow = (label, y, getVal, setVal) => {
            add([text(label, { size: 15, font: "bebas" }), pos(center().x - 190, y), anchor("left"), color(220, 230, 225), z(2)]);

            const segWidth = 14;
            const segGap = 3;
            const segments = [];
            for (let i = 0; i < SEGMENTS; i++) {
                const seg = add([
                    rect(segWidth, 16, { radius: 2 }), pos(BAR_X + i * (segWidth + segGap), y), anchor("left"),
                    color(i < Math.round(getVal() * SEGMENTS) ? rgb(0, 215, 140) : rgb(40, 48, 44)), z(2)
                ]);
                segments.push(seg);
            }
            const refresh = () => {
                const filled = Math.round(getVal() * SEGMENTS);
                segments.forEach((seg, i) => { seg.color = i < filled ? rgb(0, 215, 140) : rgb(40, 48, 44); });
            };

            const step = (delta) => {
                setVal(Math.max(0, Math.min(1, Math.round((getVal() + delta) * SEGMENTS) / SEGMENTS)));
                saveAudioSettings();
                applyAudioSettingsToLoops();
                refresh();
            };

            const minusBtn = add([rect(24, 24, { radius: 4 }), pos(BAR_X - 34, y), anchor("left"), color(20, 26, 23), outline(1, rgb(0, 180, 120)), area(), z(2)]);
            minusBtn.add([text("-", { size: 16, font: "bebas" }), anchor("center"), pos(12, 12), color(255, 255, 255)]);
            minusBtn.onClick(() => { play("ui_click", { volume: 0.4 }); step(-0.1); });
            minusBtn.onHover(() => setCursor("pointer"));

            const plusX = BAR_X + SEGMENTS * (segWidth + segGap) + 10;
            const plusBtn = add([rect(24, 24, { radius: 4 }), pos(plusX, y), anchor("left"), color(20, 26, 23), outline(1, rgb(0, 180, 120)), area(), z(2)]);
            plusBtn.add([text("+", { size: 16, font: "bebas" }), anchor("center"), pos(12, 12), color(255, 255, 255)]);
            plusBtn.onClick(() => { play("ui_click", { volume: 0.4 }); step(0.1); });
            plusBtn.onHover(() => setCursor("pointer"));
        };

        createVolumeRow("MUSIC", rowY(45), () => session.audio.musicVolume, (v) => { session.audio.musicVolume = v; });
        createVolumeRow("SFX", rowY(85), () => session.audio.sfxVolume, (v) => { session.audio.sfxVolume = v; });

        // Mute toggle
        const muteBtn = add([rect(200, 34, { radius: 5 }), pos(center().x, rowY(130)), anchor("center"), color(20, 26, 23), outline(1, rgb(0, 180, 120)), area(), z(2)]);
        const muteLabel = muteBtn.add([text(session.audio.muted ? "UNMUTE" : "MUTE ALL", { size: 14, font: "bebas" }), anchor("center"), color(255, 255, 255)]);
        muteBtn.onClick(() => {
            play("ui_click", { volume: 0.4 });
            session.audio.muted = !session.audio.muted;
            saveAudioSettings();
            applyAudioSettingsToLoops();
            muteLabel.text = session.audio.muted ? "UNMUTE" : "MUTE ALL";
        });
        muteBtn.onHover(() => setCursor("pointer"));

        // Controls reference
        add([text("CONTROLS", { size: 14, font: "bebas" }), pos(center().x, rowY(175)), anchor("center"), color(255, 215, 0), z(2)]);
        const controlsLines = [
            "MOVE ................. WASD / ARROWS",
            "DASH ................. SHIFT",
            "BICYCLE KICK ......... SPACE",
            "STRATEGY SHOP ........ E",
            "PAUSE ................ ESC"
        ];
        controlsLines.forEach((line, i) => {
            add([text(line, { size: 12, font: "teko" }), pos(center().x, rowY(200 + i * 17)), anchor("center"), color(200, 210, 205), z(2)]);
        });

        // Reset saved profile - genuinely useful for a shared/kiosk device (club fair
        // booth) where a lot of different people play on the same machine and don't
        // necessarily want the next player's name pre-filled with theirs.
        let resetArmed = false;
        const resetBtn = add([rect(260, 32, { radius: 5 }), pos(center().x, rowY(330)), anchor("center"), color(30, 18, 18), outline(1, rgb(200, 70, 70)), scale(1), area(), z(2)]);
        const resetLabel = resetBtn.add([text("RESET SAVED PROFILE", { size: 12, font: "bebas" }), anchor("center"), color(255, 180, 180)]);
        resetBtn.onClick(() => {
            if (!resetArmed) {
                resetArmed = true;
                resetLabel.text = "CLICK AGAIN TO CONFIRM";
                punch(resetBtn, 1.08);
                wait(3, () => { resetArmed = false; resetLabel.text = "RESET SAVED PROFILE"; });
                return;
            }
            play("ui_click", { volume: 0.4 });
            session.player.name = "";
            session.player.teamSprite = "argentina";
            savePlayerProfile();
            resetAchievements();
            session.progress.eggsFound = {};
            resetArmed = false;
            resetLabel.text = "PROFILE RESET";
            wait(1.2, () => { resetLabel.text = "RESET SAVED PROFILE"; });
        });
        resetBtn.onHover(() => setCursor("pointer"));

        // Back - returns to wherever Settings was opened from (main menu by default, or
        // the win/lose recap if that's where the SETTINGS button was pressed).
        const backBtn = add([rect(160, 42, { radius: 4 }), pos(center().x, height() * 0.93), anchor("center"), color(10, 16, 14), outline(1.5, rgb(0, 255, 150)), area(), z(2)]);
        backBtn.add([text("< BACK", { size: 16, font: "bebas" }), anchor("center"), color(255, 255, 255)]);
        const goBack = () => { play("ui_click", { volume: 0.6 }); returnToPrevious("menu"); };
        backBtn.onClick(goBack);
        backBtn.onHover(() => { setCursor("pointer"); backBtn.outline.color = rgb(255, 215, 0); });
        backBtn.onHoverEnd(() => { setCursor("default"); backBtn.outline.color = rgb(0, 255, 150); });
        onKeyPress("escape", goBack);
    });
}
