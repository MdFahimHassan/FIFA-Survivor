import { session, generateUniqueTag, savePlayerProfile } from "../config.js";
import { addBranding, fadeInScene, riseIn, crossfadeTo } from "../helpers.js";
import { PLAYER_EGGS, SOURCE_IMG_WIDTH, SOURCE_IMG_HEIGHT, screenPointToImageFraction, imageFractionToScreen, findEggAtFraction } from "../player_eggs.js";
import { unlockAchievement } from "../achievements.js";

export default function loadMenuScene() {
    scene("menu", () => {
        window.gameInputActive = false;
        debug.paused = false;
        fadeInScene(0.5);
        addBranding();
        if (!session.audio.bgm) {
            session.audio.bgm = crossfadeTo("menu_theme", 0.35, null, 0.8);
        } else if (session.audio.bgm.paused) {
            session.audio.bgm.paused = false;
        }

        const bg = add([sprite("players"), pos(center()), anchor("center"), scale(1), z(0)]);
        let bgBreatheT = 0;
        bg.onUpdate(() => {
            if (bg.width && bg.height) {
                const scaleFactor = Math.max(width() / bg.width, height() / bg.height);
                bgBreatheT += dt();
                const breathe = 1 + Math.sin(bgBreatheT * 0.4) * 0.015;
                bg.scale = vec2(scaleFactor * breathe, scaleFactor * breathe);
            }
        });

        const titleShadow = add([
            text("FIFA SURVIVOR", { size: 68, font: "bebas" }),
            pos(center().x + 3, height() * 0.20 + 3),
            anchor("center"),
            color(0, 0, 0),
            opacity(0.9),
            z(99)
        ]);
        const titleFace = add([
            text("FIFA SURVIVOR", { size: 68, font: "bebas" }),
            pos(center().x, height() * 0.20),
            anchor("center"),
            color(255, 228, 160),
            outline(3, rgb(15, 15, 15)),
            opacity(1),
            z(100)
        ]);
        titleFace.onUpdate(() => {
            titleFace.color = rgb(255, 228 + Math.sin(time() * 2) * 12, 160 + Math.sin(time() * 2) * 20);
        });

        const subShadow = add([
            text("FIFA 26: LAST TEAM STANDING", { size: 18, font: "bebas", letterSpacing: 2 }),
            pos(center().x + 2, height() * 0.27 + 2),
            anchor("center"),
            color(0, 0, 0),
            opacity(0.85),
            z(99)
        ]);
        const subFace = add([
            text("FIFA 26: LAST TEAM STANDING", { size: 18, font: "bebas", letterSpacing: 2 }),
            pos(center().x, height() * 0.27),
            anchor("center"),
            color(230, 240, 245),
            outline(2, rgb(15, 15, 15)),
            opacity(1),
            z(100)
        ]);

        riseIn(titleShadow, 0.05);
        riseIn(titleFace, 0.05);
        riseIn(subShadow, 0.18);
        riseIn(subFace, 0.18);

        const playBtn = add([
            rect(240, 54, { radius: 4 }),
            pos(center().x, height() * 0.45),
            anchor("center"),
            scale(1),
            opacity(1),
            color(10, 16, 14),
            outline(1.5, rgb(0, 255, 150)),
            area()
        ]);

        const playText = playBtn.add([
            text("KICK OFF", { size: 24, font: "bebas" }),
            anchor("center"),
            color(255, 255, 255),
            opacity(1)
        ]);

        riseIn(playBtn, 0.32, 14, 0.4);
        riseIn(playText, 0.32, 0, 0.4);

        // Gentle idle glow pulse to draw the eye to the primary CTA
        let hovering = false;
        playBtn.onUpdate(() => {
            if (!hovering) {
                const pulse = wave(0.55, 1, time() * 2.4);
                playBtn.outline.color = rgb(0, 255 * pulse, 150 * pulse + 40);
            }
        });

        // Secondary menu options
        const secondaryY = height() * 0.45 + 78;
        const settingsBtn = add([
            rect(115, 40, { radius: 4 }), pos(center().x - 63, secondaryY), anchor("center"),
            color(10, 16, 14), opacity(1), outline(1.2, rgb(0, 180, 130)), area()
        ]);
        const settingsText = settingsBtn.add([text("SETTINGS", { size: 13, font: "bebas" }), anchor("center"), color(220, 230, 225), opacity(1)]);
        settingsBtn.onHover(() => { hoveringUIButton = true; setCursor("pointer"); play("ui_hover", { volume: 0.3 }); settingsBtn.outline.color = rgb(255, 215, 0); });
        settingsBtn.onHoverEnd(() => { hoveringUIButton = false; setCursor("default"); settingsBtn.outline.color = rgb(0, 180, 130); });
        settingsBtn.onClick(() => { stopActiveEgg(true); play("ui_click", { volume: 0.7 }); go("settings"); });

        const creditsBtn = add([
            rect(115, 40, { radius: 4 }), pos(center().x + 63, secondaryY), anchor("center"),
            color(10, 16, 14), opacity(1), outline(1.2, rgb(0, 180, 130)), area()
        ]);
        const creditsText = creditsBtn.add([text("CREDITS", { size: 13, font: "bebas" }), anchor("center"), color(220, 230, 225), opacity(1)]);
        creditsBtn.onHover(() => { hoveringUIButton = true; setCursor("pointer"); play("ui_hover", { volume: 0.3 }); creditsBtn.outline.color = rgb(255, 215, 0); });
        creditsBtn.onHoverEnd(() => { hoveringUIButton = false; setCursor("default"); creditsBtn.outline.color = rgb(0, 180, 130); });
        creditsBtn.onClick(() => { stopActiveEgg(true); play("ui_click", { volume: 0.7 }); go("credits"); });

        riseIn(settingsBtn, 0.42, 12, 0.35);
        riseIn(settingsText, 0.42, 0, 0.35);
        riseIn(creditsBtn, 0.42, 12, 0.35);
        riseIn(creditsText, 0.42, 0, 0.35);

        let activePrompt = null;

        const showNamePrompt = () => {
            if (activePrompt) return;

            const overlay = document.createElement("div");
            overlay.style.position = "fixed";
            overlay.style.inset = "0";
            overlay.style.background = "rgba(3, 8, 12, 0.86)";
            overlay.style.display = "flex";
            overlay.style.alignItems = "center";
            overlay.style.justifyContent = "center";
            overlay.style.zIndex = "99999";
            overlay.style.fontFamily = "Arial, sans-serif";

            const card = document.createElement("div");
            card.style.width = "min(92vw, 360px)";
            card.style.padding = "24px";
            card.style.borderRadius = "14px";
            card.style.background = "linear-gradient(135deg, #0d1713, #1d2d24)";
            card.style.border = "2px solid #00ff96";
            card.style.boxShadow = "0 16px 40px rgba(0,0,0,0.45)";
            card.style.textAlign = "center";

            const title = document.createElement("div");
            title.textContent = "ENTER YOUR NAME, MANAGER!";
            title.style.color = "#ffe8a3";
            title.style.fontSize = "22px";
            title.style.fontWeight = "700";
            title.style.marginBottom = "12px";

            const subtitle = document.createElement("div");
            subtitle.textContent = "This will be used for the global leaderboard.";
            subtitle.style.color = "#dce8e2";
            subtitle.style.fontSize = "13px";
            subtitle.style.marginBottom = "16px";

            const input = document.createElement("input");
            input.type = "text";
            input.value = "";
            input.maxLength = 12;
            input.placeholder = "Type your name";
            input.style.width = "100%";
            input.style.padding = "10px 12px";
            input.style.borderRadius = "8px";
            input.style.border = "1px solid #6ad4a7";
            input.style.marginBottom = "12px";
            input.style.fontSize = "16px";
            input.style.outline = "none";
            input.style.boxSizing = "border-box";

            const errorLabel = document.createElement("div");
            errorLabel.style.color = "#ff7a7a";
            errorLabel.style.fontSize = "13px";
            errorLabel.style.minHeight = "18px";
            errorLabel.style.marginBottom = "12px";

            const backBtn = document.createElement("button");
            backBtn.textContent = "< BACK";
            backBtn.style.padding = "10px 16px";
            backBtn.style.borderRadius = "8px";
            backBtn.style.border = "1px solid #6ad4a7";
            backBtn.style.background = "transparent";
            backBtn.style.color = "#dce8e2";
            backBtn.style.cursor = "pointer";
            backBtn.style.fontWeight = "700";

            const confirmBtn = document.createElement("button");
            confirmBtn.textContent = "START MATCH";
            confirmBtn.style.padding = "10px 16px";
            confirmBtn.style.border = "none";
            confirmBtn.style.borderRadius = "8px";
            confirmBtn.style.background = "#00ff96";
            confirmBtn.style.color = "#07110b";
            confirmBtn.style.cursor = "pointer";
            confirmBtn.style.fontWeight = "700";

            const btnRow = document.createElement("div");
            btnRow.style.display = "flex";
            btnRow.style.gap = "10px";
            btnRow.style.justifyContent = "center";

            const cleanup = () => {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                activePrompt = null;
            };

            const submitName = async () => {
                const rawName = input.value.trim();
                if (!rawName) {
                    errorLabel.textContent = "A manager name is required for the scoreboard.";
                    return;
                }

                session.player.name = rawName.substring(0, 12);
                savePlayerProfile();
                playText.text = "LOADING ID...";
                confirmBtn.disabled = true;
                confirmBtn.textContent = "LOADING...";
                backBtn.disabled = true;
                input.disabled = true;
                session.player.tag = await generateUniqueTag(session.player.name);
                cleanup();
                stopActiveEgg(true);
                go("start");
            };

            backBtn.addEventListener("click", () => { play("ui_click", { volume: 0.6 }); cleanup(); });
            confirmBtn.addEventListener("click", submitName);
            input.addEventListener("keydown", (event) => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    submitName();
                } else if (event.key === "Escape") {
                    event.preventDefault();
                    play("ui_click", { volume: 0.6 });
                    cleanup();
                }
            });
            overlay.addEventListener("click", (event) => {
                if (event.target === overlay) cleanup();
            });

            btnRow.appendChild(backBtn);
            btnRow.appendChild(confirmBtn);
            card.appendChild(title);
            card.appendChild(subtitle);
            card.appendChild(input);
            card.appendChild(errorLabel);
            card.appendChild(btnRow);
            overlay.appendChild(card);
            document.body.appendChild(overlay);
            activePrompt = overlay;
            input.focus();
        };


        // ==========================================
        // EASTER EGG: CLICK A PLAYER'S FACE
        // ==========================================
        // See src/player_eggs.js for the hitbox config + calibration notes.
        let hoveringUIButton = false;
        let activeEgg = null; // { soundHandle, textObjs }

        const uiButtonZones = [
            { cx: center().x, cy: height() * 0.45, w: 240, h: 54 },       // playBtn
            { cx: center().x - 63, cy: secondaryY, w: 115, h: 40 },       // settingsBtn
            { cx: center().x + 63, cy: secondaryY, w: 115, h: 40 }        // creditsBtn
        ];
        const isPointInButtonZone = (pt) => {
            const pad = 14; // generous safety margin so an edge click never double-fires
            return uiButtonZones.some(z => Math.abs(pt.x - z.cx) <= z.w / 2 + pad && Math.abs(pt.y - z.cy) <= z.h / 2 + pad);
        };

        // Matches the baseline formula in helpers.js's applyAudioSettingsToLoops (bgm
        // sits at 35% of the music-volume setting) so ducking/restoring always lands on
        // whatever the "normal" volume actually is right now, even if the player changes
        // the music slider mid-celebration.
        const fullBgmTarget = () => (session.audio.muted ? 0 : session.audio.musicVolume * 0.35);
        const duckedBgmTarget = () => fullBgmTarget() * 0.22;
        const restoreBgmVolume = () => {
            if (!session.audio.bgm) return;
            tween(session.audio.bgm.volume, fullBgmTarget(), 0.5, (v) => { session.audio.bgm.volume = v; }, easings.easeOutQuad);
        };

        const stopActiveEgg = (restoreBgm) => {
            if (activeEgg) {
                if (activeEgg.soundHandle) { try { activeEgg.soundHandle.stop(); } catch (e) { /* already finished */ } }
                activeEgg.textObjs.forEach(o => { if (o && o.exists && o.exists()) destroy(o); });
                activeEgg = null;
            }
            if (restoreBgm) restoreBgmVolume();
        };

        const triggerEgg = (egg) => {
            stopActiveEgg(false); // interrupt whatever was already celebrating - we're about to duck again anyway
            play("ui_click", { volume: 0.35 });

            unlockAchievement("star_struck");
            session.progress.eggsFound[egg.id] = true;
            if (Object.keys(session.progress.eggsFound).length >= PLAYER_EGGS.length) unlockAchievement("full_squad");

            if (session.audio.bgm) {
                tween(session.audio.bgm.volume, duckedBgmTarget(), 0.25, (v) => { session.audio.bgm.volume = v; }, easings.easeOutQuad);
            }
            const soundHandle = play(egg.sound, { volume: 1 });

            // Land the callout under whoever was actually clicked instead of always dead
            // center - horizontally follows that player's box, vertically stays in the
            // same safe low band every time (their box runs close to the bottom of the
            // frame already, so there's rarely real room to go any lower on screen).
            const boxTopLeft = imageFractionToScreen(egg.box.xFrac, egg.box.yFrac, bg);
            const boxBottomRight = imageFractionToScreen(egg.box.xFrac + egg.box.wFrac, egg.box.yFrac + egg.box.hFrac, bg);
            const rawX = (boxTopLeft.x + boxBottomRight.x) / 2;
            const quoteWidth = Math.min(width() * 0.6, 460);
            const halfSafe = quoteWidth / 2 + 24;
            const calloutX = Math.min(Math.max(rawX, halfSafe), width() - halfSafe);
            const calloutY = height() * 0.86;

            // Glow "aura" layers - kaboom has no native blur/shadow-blur, so the glow is
            // faked with an oversized, low-opacity, pulsing outline sitting directly behind
            // the crisp text. Same trick used twice: a wide gold halo behind the name, a
            // tighter green halo behind the quote.
            const glowLabel = add([text(egg.label + "!", { size: 44, font: "bebas" }), pos(calloutX, calloutY), anchor("center"), color(255, 235, 140), outline(12, rgb(255, 215, 0)), scale(0.3), z(299)]);
            const glowQuote = add([text(egg.quote, { size: 13, font: "teko", width: quoteWidth }), pos(calloutX, calloutY + 32), anchor("center"), color(170, 255, 215), outline(8, rgb(0, 255, 150)), scale(0.3), z(299)]);
            const shadow = add([text(egg.label + "!", { size: 44, font: "bebas" }), pos(calloutX + 3, calloutY + 3), anchor("center"), color(0, 0, 0), scale(0.3), z(300)]);
            const face = add([text(egg.label + "!", { size: 44, font: "bebas" }), pos(calloutX, calloutY), anchor("center"), color(255, 215, 0), outline(3, rgb(10, 10, 10)), scale(0.3), z(301)]);
            const quoteShadow = add([text(egg.quote, { size: 13, font: "teko", width: quoteWidth }), pos(calloutX + 2, calloutY + 34), anchor("center"), color(0, 0, 0), scale(0.3), z(300)]);
            const quoteFace = add([text(egg.quote, { size: 13, font: "teko", width: quoteWidth }), pos(calloutX, calloutY + 32), anchor("center"), color(225, 235, 230), scale(0.3), z(301)]);
            const textObjs = [glowLabel, glowQuote, shadow, face, quoteShadow, quoteFace];
            textObjs.forEach(o => { o.opacity = 0; });

            // "Surprise" pop: snap in past full size, then settle - not a gentle fade.
            const popIn = (obj, overshoot, delay = 0) => {
                obj.opacity = 0;
                obj.scale = vec2(0.3);
                wait(delay, () => {
                    if (!obj.exists()) return;
                    obj.opacity = 1;
                    tween(obj.scale, vec2(overshoot), 0.16, (v) => obj.scale = v, easings.easeOutQuad);
                    wait(0.16, () => {
                        if (obj.exists()) tween(obj.scale, vec2(1), 0.12, (v) => obj.scale = v, easings.easeOutQuad);
                    });
                });
            };
            popIn(glowLabel, 1.22, 0);
            popIn(glowQuote, 1.08, 0.08);
            popIn(shadow, 1.22, 0);
            popIn(face, 1.22, 0);
            popIn(quoteShadow, 1.08, 0.08);
            popIn(quoteFace, 1.08, 0.08);

            // Once each glow layer has popped in, hand its opacity over to a slow pulse
            // instead of leaving it flat - that pulse (plus the oversized outline behind
            // crisp text) is what actually reads as "glowing" rather than just outlined.
            const glowPulseControllers = [];
            const startGlowPulse = (obj, delay, ampMin, ampMax, speed) => {
                wait(delay + 0.16, () => {
                    if (!obj.exists()) return;
                    glowPulseControllers.push(obj.onUpdate(() => { obj.opacity = ampMin + wave(0, ampMax - ampMin, time() * speed); }));
                });
            };
            startGlowPulse(glowLabel, 0, 0.35, 0.85, 3.4);
            startGlowPulse(glowQuote, 0.08, 0.25, 0.65, 3.8);

            const holdTime = Math.max(egg.duration - 0.55, 1.0);
            wait(holdTime, () => {
                glowPulseControllers.forEach(c => { if (c && c.cancel) c.cancel(); }); // hand opacity back before fading, or the pulse fights the fade-out tween
                textObjs.forEach(o => {
                    if (!o.exists()) return;
                    tween(o.opacity, 0, 0.3, (v) => o.opacity = v, easings.easeInQuad);
                    tween(o.scale, vec2(0.8), 0.3, (v) => o.scale = v, easings.easeInQuad);
                });
            });

            activeEgg = { soundHandle, textObjs };

            // Only this exact celebration is allowed to restore bgm/cleanup when its timer
            // fires - if the player clicked someone else in the meantime, stopActiveEgg(false)
            // above already swapped activeEgg out from under this closure, so it's a no-op.
            wait(egg.duration + 0.2, () => {
                if (activeEgg && activeEgg.soundHandle === soundHandle) stopActiveEgg(true);
            });
        };

        // Easter eggs only fire from taps/clicks on the BOTTOM half of the screen -
        // the top half (title, menu buttons) never triggers them, even though the
        // underlying face hitboxes stretch up that far in image-space.
        const isInLowerHalf = (mp) => mp.y >= height() / 2;

        onMousePress("left", () => {
            if (activePrompt) return; // name-entry overlay is open, ignore canvas clicks
            const mp = mousePos();
            if (isPointInButtonZone(mp)) return; // let the button's own onClick handle it
            if (!isInLowerHalf(mp)) return; // top half never triggers an egg
            const frac = screenPointToImageFraction(mp, bg);
            const egg = frac ? findEggAtFraction(frac.fx, frac.fy) : null;
            if (egg) triggerEgg(egg);
        });

        bg.onUpdate(() => {
            if (activePrompt || hoveringUIButton) return;
            const mp = mousePos();
            if (isPointInButtonZone(mp)) return;
            if (!isInLowerHalf(mp)) { setCursor("default"); return; }
            const frac = screenPointToImageFraction(mp, bg);
            const egg = frac ? findEggAtFraction(frac.fx, frac.fy) : null;
            setCursor(egg ? "pointer" : "default");
        });

        // DEV TOOL: press G on the menu to toggle hitbox outlines over the players'
        // faces, for lining up src/player_eggs.js's box fractions with the actual art.
        let debugGridObjs = [];
        onKeyPress("g", () => {
            if (debugGridObjs.length) {
                debugGridObjs.forEach(o => { if (o.exists()) destroy(o); });
                debugGridObjs = [];
                return;
            }
            PLAYER_EGGS.forEach((egg) => {
                const box = add([rect(1, 1), pos(0, 0), anchor("topleft"), color(255, 0, 200), opacity(0.22), outline(2, rgb(255, 0, 200)), z(998)]);
                const label = add([text(egg.label, { size: 14, font: "bebas" }), pos(0, 0), anchor("topleft"), color(255, 255, 255), outline(2, rgb(0, 0, 0)), z(999)]);
                box.onUpdate(() => {
                    const topLeft = imageFractionToScreen(egg.box.xFrac, egg.box.yFrac, bg);
                    box.pos = topLeft;
                    box.width = egg.box.wFrac * SOURCE_IMG_WIDTH * bg.scale.x;
                    box.height = egg.box.hFrac * SOURCE_IMG_HEIGHT * bg.scale.y;
                    label.pos = vec2(topLeft.x + 4, topLeft.y + 4);
                });
                debugGridObjs.push(box, label);
            });
        });

        playBtn.onHover(() => {
            hovering = true;
            hoveringUIButton = true;
            play("ui_hover", { volume: 0.5 });
            setCursor("pointer");
            playBtn.outline.color = rgb(255, 215, 0);
            playBtn.scale = vec2(1.06, 1.06);
        });

        playBtn.onHoverEnd(() => {
            hovering = false;
            hoveringUIButton = false;
            setCursor("default");
            playBtn.outline.color = rgb(0, 255, 150);
            playBtn.scale = vec2(1.0, 1.0);
        });

        playBtn.onClick(() => {
            play("ui_click", { volume: 1.0 });
            setCursor("default");
            showNamePrompt();
        });
    });
}
