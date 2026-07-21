import { session } from "../config.js";
import { countriesList } from "../assets.js";
import { BALANCE } from "../balance.js";
import {
    deg2rad, rad2deg, spawnParticles, dropEnemyLoot, advancePhase, getPhaseName,
    fadeInScene, punch, spawnImpactRing, spawnMuzzleFlash, ENEMY_VISUALS, rollEnemyType,
    hitStop, screenFlash, spawnTieredKillImpact, crossfadeTo, riseIn, rainbowColor
} from "../helpers.js";
import { unlockAchievement } from "../achievements.js";

export default function loadMainGameScene() {
    scene("main", () => {
        window.gameInputActive = true;
        debug.paused = false;
        session.audio.gameAmbience = crossfadeTo("stadium_ambience", 0.18, session.audio.bgm, 0.8);
        session.audio.bgm = null;
        play("kickoff_whistle", { volume: 1.0 });
        fadeInScene(0.5);

        session.run.score = 0;
        session.run.totalCoinsEarned = 0;
        session.run.phase = 1;
        session.run.enemySpeed = BALANCE.startingEnemySpeed;
        session.run.spawnRate = BALANCE.startingSpawnRate;
        session.run.spawnTimer = 0;
        session.run.goldenBalls = 0;
        session.upgrades.fireRateLevel = 0;
        session.upgrades.speedLevel = 0;
        session.upgrades.magnetLevel = 0;
        session.player.speed = BALANCE.startingPlayerSpeed;
        session.player.fireRate = BALANCE.startingFireRate;
        session.player.magnetRadius = BALANCE.startingMagnetRadius;
        session.player.stillTimer = 0;
        session.upgrades.hasShotgun = false;
        session.upgrades.hasShield = false;
        session.upgrades.hasPiercing = false;
        session.upgrades.shieldActive = false;
        session.upgrades.shieldCooldown = 0;
        session.run.isUpgrading = false;
        session.run.bicycleCooldown = 0;
        session.run.matchStartTime = time();

        let isDashing = false;
        let shopOpenedOnce = false;
        let shopHintToastShown = false;
        let dashCooldown = 0;
        const DASH_MAX_COOLDOWN = BALANCE.dashCooldownMax;
        let shopNotified = false;
        let shootTimer = 0;
        let shopUIComponents = [];
        // Guards every buy button in the shop against firing more than once per
        // physical press. Without this, a touchscreen tap that the browser/OS reports
        // as more than one press event (or an accidental rapid double-click) chain-buys
        // several levels of the same stat instead of the intended one level per press -
        // which is what was happening with Ball Magnet's cheap per-level cost eating a
        // big chunk of score in one tap. Lives outside shopUIComponents deliberately:
        // refreshShop() destroys/rebuilds that array on every single purchase, so
        // anything tracking "has this press been used yet" has to live above that reset.
        let shopInputLocked = false;
        let unlockOnRelease = null;

        // ==========================================
        // PITCH RENDERING (stripes + white centre lines)
        // ==========================================

        onDraw(() => {
            const stripeWidth = 110;
            const cam = camPos();
            const startX = Math.floor((cam.x - width() / 2) / stripeWidth) * stripeWidth;
            const endX = Math.ceil((cam.x + width() / 2) / stripeWidth) * stripeWidth;

            drawRect({ pos: vec2(cam.x - width() / 2, cam.y - height() / 2), width: width(), height: height(), color: rgb(34, 82, 48) });
            for (let x = startX; x <= endX; x += stripeWidth) {
                const isDark = Math.round(x / stripeWidth) % 2 === 0;
                if (isDark) {
                    drawRect({ pos: vec2(x, cam.y - height() / 2), width: stripeWidth, height: height(), color: rgb(30, 75, 43) });
                }
            }

            // Halfway line + center circle, anchored to the world origin like a real pitch.
            drawLine({ p1: vec2(0, cam.y - height() / 2 - 50), p2: vec2(0, cam.y + height() / 2 + 50), color: rgb(255, 255, 255), width: 3, opacity: 0.35 });
            drawCircle({ pos: vec2(0, 0), radius: 200, fill: false, outline: { color: rgb(255, 255, 255), width: 3 }, opacity: 0.35 });
            drawCircle({ pos: vec2(0, 0), radius: 5, color: rgb(255, 255, 255), opacity: 0.35 });
        });

        // Camera starts locked onto the pitch's true kickoff spot (world origin) so it
        // already matches where the player spawns below - no opening pan/jump.
        camPos(vec2(0, 0));

        const player = add([
            rect(50, 50),
            pos(vec2(0, 0)),
            anchor("center"),
            area(),
            opacity(0),
            "player",
            z(50)
        ]);
        const playerAura = player.add([circle(32), color(0, 230, 255), opacity(0.25), anchor("center")]);
        const playerSprite = player.add([sprite(session.player.teamSprite), scale(0.8), anchor("center")]);

        // Subtle idle breathing + facing flip on the player's own sprite (never touches player.pos/area, so collisions are untouched)
        let facingRight = true;
        let squashUntil = 0;
        function squash(sx, sy, dur = 0.15) {
            squashUntil = time() + dur;
            playerSprite.scale = vec2(sx, sy);
            tween(playerSprite.scale, vec2(0.8, 0.8), dur, (v) => playerSprite.scale = v, easings.easeOutQuad);
        }
        playerSprite.onUpdate(() => {
            if (time() < squashUntil) {
                playerSprite.flipX = !facingRight;
                return;
            }
            if (!session.player.isMoving) {
                playerSprite.scale = vec2(0.8 + Math.sin(time() * 3) * 0.02);
            } else {
                playerSprite.scale = vec2(0.8);
            }
            playerSprite.flipX = !facingRight;
        });

        const shieldVisual = add([
            circle(34),
            pos(player.pos),
            anchor("center"),
            color(0, 215, 255),
            opacity(0),
            z(51)
        ]);

        add([rect(130, 40, { radius: 4 }), pos(20, 15), color(10, 16, 14, 0.75), outline(1, rgb(45, 55, 50)), fixed(), z(100)]);
        const coinIcon = add([sprite("coin"), pos(38, 35), scale(0.65), anchor("center"), fixed(), z(101)]);
        const scoreLabel = add([text("0", { size: 26, font: "bebas" }), pos(72, 23), color(255, 255, 255), outline(1, rgb(15, 15, 15)), fixed(), z(101)]);

        add([rect(130, 40, { radius: 4 }), pos(20, 65), color(10, 16, 14, 0.75), outline(1, rgb(45, 55, 50)), fixed(), z(100)]);
        const goldenIcon = add([sprite("golden_ball"), pos(38, 86), scale(0.55), anchor("center"), fixed(), z(101)]);
        const crystalLabel = add([text(`0 / ${session.run.phase * 5}`, { size: 24, font: "bebas" }), pos(72, 74), color(255, 215, 0), outline(1, rgb(20, 15, 0)), fixed(), z(101)]);

        const phaseLabelShadow = add([text(getPhaseName(1), { font: "bebas" }), pos(center().x + 3, center().y + 3), scale(2), color(15, 15, 15), opacity(0.65), anchor("center"), fixed(), z(99)]);
        const phaseLabel = add([text(getPhaseName(1), { font: "bebas" }), pos(center()), scale(2), color(255, 255, 255), outline(2, rgb(10, 10, 10)), anchor("center"), fixed(), z(100)]);
        // Outer halo sits behind the box itself and is how the "upgrades available"
        // glow reads at a glance - the box outline pulses too, but the halo is what
        // catches peripheral vision while the player is focused on the pitch.
        const shopHintGlow = add([
            rect(196 + 16, 36 + 16, { radius: 10 }), pos(width() - 8, 8), anchor("topright"),
            color(255, 215, 0), opacity(0), fixed(), z(97)
        ]);
        const shopHintBg = add([
            rect(196, 36, { radius: 6 }), pos(width() - 16, 16), anchor("topright"),
            color(0, 40, 55), opacity(0.5), outline(1.5, rgb(0, 190, 255)), fixed(), z(98)
        ]);
        const shopHintShadow = add([text("[E] STRATEGY SHOP", { size: 16, font: "bebas" }), pos(width() - 26, 34), anchor("right"), color(10, 10, 10), opacity(0.65), fixed(), z(99)]);
        const shopHintFace = add([text("[E] STRATEGY SHOP", { size: 16, font: "bebas" }), pos(width() - 24, 34), anchor("right"), color(0, 225, 255), outline(1, rgb(10, 20, 25)), fixed(), z(100)]);

        // Small reminder line that only appears once an upgrade is actually affordable -
        // sits just under the box so it doesn't compete with it for attention.
        const shopReminderShadow = add([text("", { size: 12, font: "teko" }), pos(width() - 15, 61), anchor("right"), color(10, 10, 10), opacity(0), fixed(), z(99)]);
        const shopReminderFace = add([text("", { size: 12, font: "teko" }), pos(width() - 16, 60), anchor("right"), color(255, 215, 0), opacity(0), fixed(), z(100)]);

        // Fit the box (and its halo) snugly around the text instead of a hardcoded
        // width, so the pill never clips or floats around the label.
        const SHOP_HINT_PAD_X = 26;
        const fitShopHintBox = () => {
            const w = shopHintFace.width + SHOP_HINT_PAD_X;
            shopHintBg.width = w;
            shopHintGlow.width = w + 16;
        };
        fitShopHintBox();
        wait(0, fitShopHintBox); // safety re-measure a frame later, in case width isn't final synchronously

        // Rainbow cycle for the endgame-tier glow now lives in helpers.js (rainbowColor) -
        // shared with the rare-achievement toast glow so both cycle identically.

        function getShopAvailability() {
            const rateCost = (session.upgrades.fireRateLevel + 1) * BALANCE.fireRateCostPerLevel;
            const speedCost = (session.upgrades.speedLevel + 1) * BALANCE.speedCostPerLevel;
            const magnetCost = (session.upgrades.magnetLevel + 1) * BALANCE.magnetCostPerLevel;
            const normalAffordable = session.run.score >= rateCost || session.run.score >= speedCost || session.run.score >= magnetCost;

            const endgameAffordable =
                (!session.upgrades.hasShotgun && session.run.score >= BALANCE.shotgunCost) ||
                (!session.upgrades.hasShield && session.run.score >= BALANCE.shieldCost) ||
                (!session.upgrades.hasPiercing && session.run.score >= BALANCE.piercingCost);

            return { normalAffordable, endgameAffordable };
        }

        shopHintBg.onUpdate(() => {
            const pulse = wave(0.35, 1, time() * 2.2);
            const { normalAffordable, endgameAffordable } = getShopAvailability();

            if (endgameAffordable) {
                // RGB / rainbow pulse - endgame tactics are the highest-value thing in the shop.
                const glowColor = rainbowColor(time() * 3);
                shopHintBg.outline.color = glowColor;
                shopHintBg.opacity = 0.4 + pulse * 0.45;
                shopHintGlow.color = glowColor;
                shopHintGlow.opacity = 0.18 + pulse * 0.3;
                shopReminderFace.text = "ENDGAME TIERS AVAILABLE IN SHOP!";
                shopReminderFace.color = glowColor;
                shopReminderFace.opacity = 1;
                shopReminderShadow.text = shopReminderFace.text;
                shopReminderShadow.opacity = 0.6;
            } else if (normalAffordable) {
                // Golden pulse - a normal stat upgrade is affordable.
                shopHintBg.outline.color = rgb(255, 195 + pulse * 20, 0);
                shopHintBg.opacity = 0.38 + pulse * 0.42;
                shopHintGlow.color = rgb(255, 205, 0);
                shopHintGlow.opacity = 0.14 + pulse * 0.24;
                shopReminderFace.text = "NEW UPGRADES AVAILABLE IN SHOP";
                shopReminderFace.color = rgb(255, 215, 0);
                shopReminderFace.opacity = 1;
                shopReminderShadow.text = shopReminderFace.text;
                shopReminderShadow.opacity = 0.6;
            } else {
                shopHintBg.opacity = 0.32 + pulse * 0.38;
                shopHintBg.outline.color = rgb(0, 160 + pulse * 90, 255);
                shopHintGlow.opacity = 0;
                shopReminderFace.opacity = 0;
                shopReminderShadow.opacity = 0;
            }
        });

        // Kill-streak readout. Purely a "feel" layer - it does not change score or the
        // shop economy, it just makes chaining kills quickly read as satisfying.
        const COMBO_WINDOW = BALANCE.comboWindowSeconds;
        let comboCount = 0;
        let comboTimer = 0;
        const comboLabel = add([
            text("", { size: 22, font: "bebas" }), scale(1), pos(center().x, 64), anchor("center"),
            color(255, 210, 60), outline(2, rgb(20, 12, 0)), opacity(0), fixed(), z(101)
        ]);

        function registerKill(tier, killPos, tintColor) {
            comboCount++;
            comboTimer = COMBO_WINDOW;
            spawnTieredKillImpact(killPos, tier, tintColor);
            if (comboCount >= 2) {
                comboLabel.text = `STREAK x${comboCount}`;
                comboLabel.opacity = 1;
                punch(comboLabel, 1.35);
            }
            unlockAchievement("first_blood");
            if (tier === "boss") unlockAchievement("boss_down");
        }

        // "Kickoff" - survive the first 30 seconds of a match. Checked once per frame;
        // unlockAchievement() itself is a no-op after the first call, so this is cheap.
        onUpdate(() => {
            if (time() - session.run.matchStartTime >= 30) unlockAchievement("kickoff");
        });

        onUpdate(() => {
            if (comboTimer <= 0) return;
            comboTimer -= dt();
            if (comboTimer <= 0) {
                comboCount = 0;
                tween(comboLabel.opacity, 0, 0.25, (o) => comboLabel.opacity = o, easings.easeOutQuad);
            }
        });

        wait(1.5, () => {
            tween(phaseLabel.pos, vec2(width() / 2, 36), 1, (p) => {
                phaseLabel.pos = p;
                phaseLabelShadow.pos = p.add(3, 3);
            }, easings.easeOutQuad);
            tween(2, 1, 1, (s) => {
                phaseLabel.scale = vec2(s);
                phaseLabelShadow.scale = vec2(s);
            }, easings.easeOutQuad);
        });

        onUpdate(() => {
            if (session.run.score >= 40 && !shopNotified) {
                shopNotified = true;
                add([
                    text("UPGRADES READY!\nPRESS [E] NOW!", { size: 42, font: "bebas", align: "center" }),
                    pos(center().x, center().y - 120),
                    anchor("center"),
                    color(0, 255, 150),
                    outline(3, rgb(10, 10, 10)),
                    fixed(),
                    z(200),
                    lifespan(3, { fade: 0.5 }),
                    move(UP, 20)
                ]);
            }
        });

        const slotY = height() - 52;
        const slotSize = 56;
        const bikeSlotX = center().x + 72;
        const dashSlotX = center().x - 72;

        add([circle(slotSize / 2), pos(bikeSlotX, slotY), anchor("center"), color(20, 25, 22), outline(2, rgb(255, 215, 0)), fixed(), z(150)]);
        add([sprite("bicycle_kick"), pos(bikeSlotX, slotY), scale(0.16), anchor("center"), fixed(), z(151)]);
        const bicycleIconOverlay = add([circle(slotSize / 2 - 1), pos(bikeSlotX, slotY), anchor("center"), color(10, 15, 12), opacity(0), fixed(), z(152)]);
        const bicycleCooldownCounter = add([text("", { size: 22, font: "bebas" }), pos(bikeSlotX, slotY), anchor("center"), color(255, 255, 255), outline(2, rgb(0, 0, 0)), fixed(), z(153)]);
        add([rect(42, 14, { radius: 3 }), pos(bikeSlotX, slotY - 34), anchor("center"), color(0, 0, 0), outline(1, rgb(255, 255, 255)), fixed(), z(154)]);
        add([text("SPACE", { size: 9, font: "bebas" }), pos(bikeSlotX, slotY - 34), anchor("center"), color(255, 255, 255), fixed(), z(155)]);

        add([circle(30), pos(dashSlotX, slotY), anchor("center"), color(20, 25, 22), outline(2, rgb(0, 215, 255)), fixed(), z(150)]);
        add([sprite("slide_icon"), pos(dashSlotX, slotY), scale(0.10), anchor("center"), fixed(), z(151)]);
        const dashIconOverlay = add([circle(29), pos(dashSlotX, slotY), anchor("center"), color(10, 15, 12), opacity(0), fixed(), z(152)]);
        const dashCooldownCounter = add([text("", { size: 22, font: "bebas" }), pos(dashSlotX, slotY), anchor("center"), color(255, 255, 255), outline(2, rgb(0, 0, 0)), fixed(), z(153)]);
        add([rect(40, 14, { radius: 3 }), pos(dashSlotX, slotY - 34), anchor("center"), color(0, 0, 0), outline(1, rgb(255, 255, 255)), fixed(), z(154)]);
        add([text("SHIFT", { size: 9, font: "bebas" }), pos(dashSlotX, slotY - 34), anchor("center"), color(255, 255, 255), fixed(), z(155)]);

        // ==========================================
        // MOVEMENT + SMOOTH CAMERA FOLLOW
        // ==========================================
        const CAM_SMOOTH = 9; // higher = camera catches up to player faster
        onUpdate(() => {
            if (session.run.isUpgrading) return;
            let moveX = 0, moveY = 0;
            if (isKeyDown("left") || isKeyDown("a")) moveX = -1;
            if (isKeyDown("right") || isKeyDown("d")) moveX = 1;
            if (isKeyDown("up") || isKeyDown("w")) moveY = -1;
            if (isKeyDown("down") || isKeyDown("s")) moveY = 1;

            // Virtual joystick (mobile_controls.js) reports a normalized vector into
            // session.run.touchVec. Keyboard wins if both happen to be active at once.
            if (moveX === 0 && moveY === 0 && (session.run.touchVec.x !== 0 || session.run.touchVec.y !== 0)) {
                moveX = session.run.touchVec.x;
                moveY = session.run.touchVec.y;
            }

            if (moveX !== 0 || moveY !== 0) {
                const moveDir = vec2(moveX, moveY).unit();
                player.move(moveDir.scale(session.player.speed));
                session.player.isMoving = true;
                session.player.stillTimer = 0;
                if (moveX !== 0) facingRight = moveX > 0;
            } else {
                session.player.isMoving = false;
                session.player.stillTimer += dt();
            }

            const camCurrent = camPos();
            const t = Math.min(1, dt() * CAM_SMOOTH);
            camPos(vec2(
                camCurrent.x + (player.pos.x - camCurrent.x) * t,
                camCurrent.y + (player.pos.y - camCurrent.y) * t
            ));
            shieldVisual.pos = player.pos;
            shieldVisual.opacity = session.upgrades.shieldActive ? wave(0.2, 0.6, time() * 6) : 0;
        });

        function triggerDash() {
            if (dashCooldown > 0 || session.run.isUpgrading || debug.paused) return;
            isDashing = true;
            dashCooldown = DASH_MAX_COOLDOWN;
            play("heavy_whoosh", { volume: 0.6, detune: -200 });
            shake(3);
            squash(1.3, 0.72, 0.18);
            const originalSpeed = session.player.speed;
            session.player.speed = originalSpeed * BALANCE.dashSpeedMultiplier;

            // Fading ghost trail along the dash path - six quick snapshots of the
            // player's current sprite, tinted and left to fade out behind them.
            for (let i = 0; i < 6; i++) {
                wait(i * 0.045, () => {
                    if (!isDashing) return;
                    add([
                        sprite(session.player.teamSprite), pos(player.pos), scale(playerSprite.scale),
                        anchor("center"), color(0, 220, 255), opacity(0.35), z(44),
                        lifespan(0.16, { fade: 0.16 })
                    ]);
                });
            }

            wait(BALANCE.dashDuration, () => {
                isDashing = false;
                session.player.speed = originalSpeed;
            });
        }
        onKeyPress("shift", triggerDash);

        onUpdate(() => {
            if (dashCooldown > 0) {
                dashCooldown -= dt();
                dashIconOverlay.opacity = 0.75;
                dashCooldownCounter.text = Math.ceil(dashCooldown);
            } else {
                dashCooldown = 0;
                dashIconOverlay.opacity = 0;
                dashCooldownCounter.text = "";
            }
            if (session.run.bicycleCooldown > 0) {
                session.run.bicycleCooldown -= dt();
                bicycleIconOverlay.opacity = 0.75;
                bicycleCooldownCounter.text = Math.ceil(session.run.bicycleCooldown);
            } else {
                session.run.bicycleCooldown = 0;
                bicycleIconOverlay.opacity = 0;
                bicycleCooldownCounter.text = "";
            }
        });

        function getNearestEnemy() {
            const enemies = get("enemy");
            if (enemies.length === 0) return null;
            let nearest = null;
            let minDistance = Infinity;
            for (const enemy of enemies) {
                const dist = player.pos.dist(enemy.pos);
                if (dist < minDistance) {
                    minDistance = dist;
                    nearest = enemy;
                }
            }
            return nearest;
        }

        // ==========================================
        // ENEMY SPAWNING (phase-gated types, per-type scale, health bars for tanky types)
        // ==========================================
        // Per-tier visual identity - danger should read instantly from silhouette, not
        // just from how big the sprite is scaled.
        const TIER_STYLE = {
            normal:   { haloColor: rgb(220, 40, 40),  haloOpacity: 0.30, pulse: false, ring: false },
            winger:   { haloColor: rgb(0, 210, 255),  haloOpacity: 0.30, pulse: true,  ring: false },
            defender: { haloColor: rgb(190, 190, 200),haloOpacity: 0.32, pulse: false, ring: true  },
            boss:     { haloColor: rgb(255, 195, 0),  haloOpacity: 0.42, pulse: true,  ring: true  }
        };

        function spawnEnemy(type = "normal") {
            if (session.run.isUpgrading) return;
            const cam = camPos();
            const edge = choose(["top", "bottom", "left", "right"]);
            const w = width() / 2 + 50;
            const h = height() / 2 + 50;
            let spawnPoint = vec2(0, 0);

            if (edge === "top") spawnPoint = vec2(rand(cam.x - w, cam.x + w), cam.y - h);
            if (edge === "bottom") spawnPoint = vec2(rand(cam.x - w, cam.x + w), cam.y + h);
            if (edge === "left") spawnPoint = vec2(cam.x - w, rand(cam.y - h, cam.y + h));
            if (edge === "right") spawnPoint = vec2(cam.x + w, rand(cam.y - h, cam.y + h));

            const visuals = ENEMY_VISUALS[type] || ENEMY_VISUALS.normal;
            const style = TIER_STYLE[type] || TIER_STYLE.normal;
            const enemyScale = visuals.scale;
            const enemyHp = visuals.hp;

            const rivalPool = countriesList.filter((c) => c !== session.player.teamSprite);
            const rivalTeam = choose(rivalPool);

            const enemy = add([
                rect(50, 50),
                pos(spawnPoint),
                anchor("center"),
                area(),
                opacity(0),
                "enemy",
                z(10),
                { bugType: type, hp: enemyHp, maxHp: enemyHp }
            ]);

            const halo = enemy.add([circle(32 * enemyScale), color(style.haloColor), opacity(style.haloOpacity), anchor("center"), z(9)]);
            if (style.ring) {
                // Armor ring for defenders/bosses - a rotating diamond outline reads as
                // "reinforced" at a glance, distinct from the plain halo everything else gets.
                const armorRing = enemy.add([
                    rect(30 * enemyScale, 30 * enemyScale, { radius: 3 }), anchor("center"),
                    color(style.haloColor), opacity(0.22), outline(2, style.haloColor), rotate(45), z(9)
                ]);
                armorRing.onUpdate(() => { armorRing.angle += dt() * (type === "boss" ? 35 : 18); });
            }
            if (style.pulse) {
                halo.onUpdate(() => { halo.opacity = style.haloOpacity * (0.6 + Math.sin(time() * (type === "boss" ? 5 : 8)) * 0.4); });
            }
            const enemySprite = enemy.add([sprite(rivalTeam), scale(enemyScale), anchor("center"), z(11)]);

            // Tanky enemies (Defender/Boss) get a readable health bar above them
            if (enemyHp > 1) {
                const barWidth = 44;
                const barBg = enemy.add([rect(barWidth, 6, { radius: 2 }), pos(0, -34 * enemyScale - 12), anchor("center"), color(10, 10, 10), opacity(0.7), z(15)]);
                const barFill = enemy.add([rect(barWidth, 6, { radius: 2 }), pos(-barWidth / 2, -34 * enemyScale - 12), anchor("left"), color(220, 40, 40), z(16)]);
                enemy.hpBarFill = barFill;
                enemy.hpBarWidth = barWidth;
            }

            enemy.onUpdate(() => {
                if (session.run.isUpgrading) return;
                const direction = player.pos.sub(enemy.pos).unit();
                let speedMultiplier = (session.player.stillTimer > 1.5) ? 2.5 : 1.0;
                let typeSpeed = session.run.enemySpeed;
                if (enemy.bugType === "winger") typeSpeed *= 1.5;
                else if (enemy.bugType === "defender") typeSpeed *= 0.75;
                else if (enemy.bugType === "boss") typeSpeed *= 0.5;

                enemy.move(direction.scale(typeSpeed * speedMultiplier));
                enemySprite.flipX = direction.x < 0;
            });

            enemy.onDraw(() => {
                if (session.player.stillTimer > 1.5) {
                    drawCircle({ pos: vec2(0, 0), radius: 36, color: rgb(255, 50, 50), opacity: 0.18, fill: true });
                    drawCircle({ pos: vec2(0, 0), radius: 38, color: rgb(255, 0, 0), outline: { width: 3, color: rgb(255, 80, 80) } });
                }
            });
        }

        onUpdate(() => {
            if (session.run.isUpgrading) return;
            session.run.spawnTimer += dt();
            if (session.run.spawnTimer >= session.run.spawnRate) {
                session.run.spawnTimer = 0;
                spawnEnemy(rollEnemyType(session.run.phase));
            }
            if (session.upgrades.shieldCooldown > 0) {
                session.upgrades.shieldCooldown -= dt();
                if (session.upgrades.shieldCooldown <= 0 && session.upgrades.hasShield) {
                    session.upgrades.shieldActive = true;
                }
            }
            get("coin").forEach((item) => {
                if (player.pos.dist(item.pos) <= session.player.magnetRadius) {
                    item.move(player.pos.sub(item.pos).unit().scale(240));
                }
            });
            get("goldenball").forEach((item) => {
                if (player.pos.dist(item.pos) <= session.player.magnetRadius) {
                    item.move(player.pos.sub(item.pos).unit().scale(240));
                }
            });
        });

        onUpdate(() => {
            if (session.run.isUpgrading) return;
            shootTimer += dt();
            if (shootTimer >= session.player.fireRate) {
                shootTimer = 0;
                const nearestEnemy = getNearestEnemy();
                if (!nearestEnemy) return;

                play("ball_kick", { volume: 0.14, detune: rand(-90, 90) });
                spawnMuzzleFlash(player.pos);
                const diff = nearestEnemy.pos.sub(player.pos);
                const baseAngle = Math.atan2(diff.y, diff.x);
                const spreadAngles = session.upgrades.hasShotgun ? [-15, 0, 15] : [0];

                spreadAngles.forEach((spreadOffset) => {
                    const finalAngle = baseAngle + deg2rad(rand(-14, 14)) + deg2rad(spreadOffset);
                    add([
                        sprite("ball"), pos(player.pos), scale(0.5), anchor("center"), area(),
                        move(Vec2.fromAngle(rad2deg(finalAngle)), BALANCE.bulletSpeed), lifespan(1.8), "bullet", { pierceHp: session.upgrades.hasPiercing ? 2 : 1 }, z(30)
                    ]);
                });
            }
        });

        function triggerBicycleKick() {
            if (session.run.isUpgrading || session.run.bicycleCooldown > 0 || debug.paused) return;
            session.run.bicycleCooldown = BALANCE.bicycleCooldownMax;
            play("heavy_whoosh", { volume: 0.55 });
            shake(6);

            const kickWave = add([
                circle(10), pos(player.pos), color(255, 255, 255), opacity(0.52), anchor("center"), z(65)
            ]);

            tween(10, BALANCE.bicycleAoeRadius, 0.32, (r) => kickWave.radius = r, easings.easeOutQuad);
            tween(0.52, 0, 0.32, (o) => kickWave.opacity = o, easings.easeOutQuad);
            wait(0.32, () => destroy(kickWave));

            get("enemy").forEach((enemy) => {
                if (player.pos.dist(enemy.pos) <= BALANCE.bicycleAoeRadius) {
                    dropEnemyLoot(enemy.pos, enemy.bugType);
                    registerKill(enemy.bugType, enemy.pos, rgb(0, 215, 140));
                    destroy(enemy);
                }
            });
        }
        onKeyPress("space", triggerBicycleKick);

        function toggleShop() {
            if (debug.paused) return;
            shopOpenedOnce = true;
            unlockAchievement("shop_smart");
            session.run.isUpgrading = !session.run.isUpgrading;
            if (session.run.isUpgrading) {
                const backdrop = add([rect(600, 560, { radius: 10 }), pos(center()), anchor("center"), color(14, 18, 16), opacity(0), outline(3, rgb(0, 215, 140)), fixed(), z(200)]);
                tween(0, 1, 0.2, (o) => backdrop.opacity = o, easings.easeOutQuad);
                const titleShadow = add([text("TEAM STRATEGY ROOM", { size: 30, font: "bebas" }), pos(center().x + 2, center().y - 248), anchor("center"), color(10, 10, 10), opacity(0.6), fixed(), z(200)]);
                const title = add([text("TEAM STRATEGY ROOM", { size: 30, font: "bebas" }), pos(center().x, center().y - 250), anchor("center"), color(255, 215, 0), outline(2, rgb(12, 8, 0)), fixed(), z(201)]);
                shopUIComponents.push(backdrop, titleShadow, title);

                shopInputLocked = false;
                unlockOnRelease = onMouseRelease(() => { shopInputLocked = false; });

                const CARD_WIDTH = 500;
                const CARD_HEIGHT = 46;
                const PIP_MAX = 5;

                // A leveled upgrade card: icon, name, up to 5 level-pips, and a buy pill.
                // `level` renders as filled pips (capped visually at 5; the level number
                // itself is uncapped and still shown once it runs past that).
                const createLeveledCard = (icon, labelName, level, cost, yOffset, onUpgradeClick) => {
                    const card = add([rect(CARD_WIDTH, CARD_HEIGHT, { radius: 6 }), pos(center().x, center().y + yOffset), anchor("center"), color(22, 28, 25), outline(1, rgb(0, 130, 90)), fixed(), z(201)]);
                    const iconLabel = add([text(icon, { size: 20 }), pos(center().x - CARD_WIDTH / 2 + 26, center().y + yOffset), anchor("center"), fixed(), z(202)]);
                    const nameLabel = add([text(labelName, { size: 15, font: "bebas" }), pos(center().x - CARD_WIDTH / 2 + 52, center().y + yOffset - 8), anchor("left"), color(235, 235, 235), fixed(), z(202)]);

                    const pips = [];
                    const pipStartX = center().x - CARD_WIDTH / 2 + 52;
                    for (let i = 0; i < PIP_MAX; i++) {
                        const filled = i < level;
                        const pip = add([
                            circle(4), pos(pipStartX + i * 13, center().y + yOffset + 11), anchor("center"),
                            color(filled ? rgb(0, 215, 140) : rgb(60, 65, 62)), fixed(), z(202)
                        ]);
                        pips.push(pip);
                    }
                    const overflowText = level > PIP_MAX
                        ? add([text(`+${level - PIP_MAX}`, { size: 11, font: "teko" }), pos(pipStartX + PIP_MAX * 13 + 4, center().y + yOffset + 11), anchor("left"), color(0, 215, 140), fixed(), z(202)])
                        : null;

                    const btnColor = session.run.score >= cost ? rgb(0, 180, 120) : rgb(60, 65, 62);
                    const buyBtn = add([rect(130, 32, { radius: 5 }), pos(center().x + CARD_WIDTH / 2 - 72, center().y + yOffset), color(btnColor), anchor("center"), area(), fixed(), z(202)]);
                    const buyText = add([text(`$${cost}`, { size: 15, font: "bebas" }), pos(center().x + CARD_WIDTH / 2 - 72, center().y + yOffset), anchor("center"), color(255, 255, 255), outline(1, rgb(10, 10, 10)), fixed(), z(203)]);

                    buyBtn.onHover(() => { setCursor("pointer"); buyBtn.scale = vec2(1.05); });
                    buyBtn.onHoverEnd(() => { setCursor("default"); buyBtn.scale = vec2(1.0); });
                    buyBtn.onClick(() => {
                        if (shopInputLocked) return; // already spent this press on another card
                        if (session.run.score >= cost) {
                            shopInputLocked = true;
                            play("ui_click", { volume: 0.6 });
                            session.run.score -= cost;
                            scoreLabel.text = session.run.score;
                            onUpgradeClick();
                            refreshShop();
                        }
                    });
                    shopUIComponents.push(card, iconLabel, nameLabel, buyBtn, buyText, ...pips);
                    if (overflowText) shopUIComponents.push(overflowText);
                };

                // A one-time "tactic" card: icon, name, and either a buy pill or an OWNED badge.
                const createTacticCard = (icon, labelName, cost, yOffset, isOwned, onUpgradeClick) => {
                    const card = add([rect(CARD_WIDTH, CARD_HEIGHT, { radius: 6 }), pos(center().x, center().y + yOffset), anchor("center"), color(isOwned ? rgb(26, 30, 22) : rgb(22, 28, 25)), outline(1, isOwned ? rgb(180, 150, 0) : rgb(0, 130, 90)), fixed(), z(201)]);
                    const iconLabel = add([text(icon, { size: 20 }), pos(center().x - CARD_WIDTH / 2 + 26, center().y + yOffset), anchor("center"), fixed(), z(202)]);
                    const nameLabel = add([text(labelName, { size: 15, font: "bebas" }), pos(center().x - CARD_WIDTH / 2 + 52, center().y + yOffset), anchor("left"), color(235, 235, 235), fixed(), z(202)]);

                    const btnColor = isOwned ? rgb(45, 42, 20) : (session.run.score >= cost ? rgb(0, 180, 120) : rgb(60, 65, 62));
                    const buyBtn = add([rect(130, 32, { radius: 5 }), pos(center().x + CARD_WIDTH / 2 - 72, center().y + yOffset), color(btnColor), anchor("center"), area(), fixed(), z(202)]);
                    const buyText = add([text(isOwned ? "★ OWNED" : `$${cost}`, { size: 14, font: "bebas" }), pos(center().x + CARD_WIDTH / 2 - 72, center().y + yOffset), anchor("center"), color(isOwned ? rgb(255, 215, 0) : rgb(255, 255, 255)), outline(1, rgb(10, 10, 10)), fixed(), z(203)]);

                    if (!isOwned) {
                        buyBtn.onHover(() => { setCursor("pointer"); buyBtn.scale = vec2(1.05); });
                        buyBtn.onHoverEnd(() => { setCursor("default"); buyBtn.scale = vec2(1.0); });
                        buyBtn.onClick(() => {
                            if (shopInputLocked) return; // already spent this press on another card
                            if (session.run.score >= cost) {
                                shopInputLocked = true;
                                play("ui_click", { volume: 0.6 });
                                session.run.score -= cost;
                                scoreLabel.text = session.run.score;
                                onUpgradeClick();
                                refreshShop();
                            }
                        });
                    }
                    shopUIComponents.push(card, iconLabel, nameLabel, buyBtn, buyText);
                };

                const refreshShop = () => {
                    shopUIComponents.forEach((comp) => { if (comp !== backdrop && comp !== title && comp !== titleShadow) comp.destroy(); });
                    shopUIComponents = [backdrop, titleShadow, title];

                    let rateCost = (session.upgrades.fireRateLevel + 1) * BALANCE.fireRateCostPerLevel;
                    let speedCost = (session.upgrades.speedLevel + 1) * BALANCE.speedCostPerLevel;
                    let magnetCost = (session.upgrades.magnetLevel + 1) * BALANCE.magnetCostPerLevel;

                    createLeveledCard("⚡", "Striking Speed", session.upgrades.fireRateLevel, rateCost, -190, () => { session.upgrades.fireRateLevel++; session.player.fireRate = Math.max(BALANCE.fireRateFloor, BALANCE.startingFireRate - (session.upgrades.fireRateLevel * BALANCE.fireRateGainPerLevel)); });
                    createLeveledCard("👟", "Running Speed", session.upgrades.speedLevel, speedCost, -135, () => { session.upgrades.speedLevel++; session.player.speed = BALANCE.startingPlayerSpeed + (session.upgrades.speedLevel * BALANCE.speedGainPerLevel); });
                    createLeveledCard("🧲", "Ball Magnet", session.upgrades.magnetLevel, magnetCost, -80, () => { session.upgrades.magnetLevel++; session.player.magnetRadius = BALANCE.startingMagnetRadius + (session.upgrades.magnetLevel * BALANCE.magnetGainPerLevel); });

                    const separator = add([text("— ENDGAME TALENT TIER —", { size: 13, font: "bebas" }), pos(center().x, center().y - 30), anchor("center"), color(255, 215, 0), outline(1, rgb(12, 10, 5)), fixed(), z(201)]);
                    shopUIComponents.push(separator);

                    createTacticCard("🔫", "Shotgun Tactic (3-Way)", BALANCE.shotgunCost, 20, session.upgrades.hasShotgun, () => { session.upgrades.hasShotgun = true; });
                    createTacticCard("🛡️", "Energy Shield (1 Hit)", BALANCE.shieldCost, 75, session.upgrades.hasShield, () => { session.upgrades.hasShield = true; session.upgrades.shieldActive = true; });
                    createTacticCard("🎯", "Piercing Ball (Drill)", BALANCE.piercingCost, 130, session.upgrades.hasPiercing, () => { session.upgrades.hasPiercing = true; });
                };

                refreshShop();

                const exitShadow = add([text("PRESS [E] TO RESUME MATCH", { size: 14, font: "bebas" }), pos(center().x + 1.5, center().y + 251.5), anchor("center"), color(10, 10, 10), opacity(0.6), fixed(), z(200)]);
                const exitTip = add([text("PRESS [E] TO RESUME MATCH", { size: 14, font: "bebas" }), pos(center().x, center().y + 250), anchor("center"), color(190, 215, 235), outline(1, rgb(15, 18, 20)), fixed(), z(201)]);
                shopUIComponents.push(exitShadow, exitTip);
            } else {
                shopUIComponents.forEach((comp) => comp.destroy());
                shopUIComponents = [];
                unlockOnRelease?.cancel();
                unlockOnRelease = null;
            }
        }
        onKeyPress("e", toggleShop);

        // Let the mobile touch-button overlay (mobile_controls.js) trigger the exact same
        // actions as their keyboard equivalents, without that module needing to know
        // anything about how dash/kick/shop are implemented internally.
        function togglePause() {
            if (session.run.isUpgrading) return; // close the shop first - one overlay at a time
            if (debug.paused) return; // the DOM Resume/ESC path handles un-pausing
            debug.paused = true;
            window.pauseMenuAPI?.show(() => { debug.paused = false; });
        }
        onKeyPress("escape", togglePause);

        window.gameInput = { dash: triggerDash, bicycleKick: triggerBicycleKick, toggleShop: toggleShop, togglePause: togglePause };

        onCollide("bullet", "enemy", (b, e) => {
            if (e.hp > 1) {
                e.hp--;
                spawnParticles(e.pos, rgb(255, 155, 50));
                if (e.hpBarFill) e.hpBarFill.width = e.hpBarWidth * Math.max(0, e.hp / e.maxHp);
                if (b.pierceHp && b.pierceHp > 1) {
                    b.pierceHp--;
                } else {
                    destroy(b);
                }
                return;
            }
            dropEnemyLoot(e.pos, e.bugType);
            registerKill(e.bugType, e.pos, rgb(255, 155, 50));
            destroy(e);
            if (b.pierceHp && b.pierceHp > 1) {
                b.pierceHp--;
            } else {
                destroy(b);
            }
        });

        onCollide("player", "goldenball", (p, cr) => {
            destroy(cr);
            play("chime", { volume: 0.5 });
            session.run.goldenBalls++;
            unlockAchievement("golden_touch");
            const requiredBalls = session.run.phase * 5;
            punch(goldenIcon, 1.4);

            if (session.run.phase < 10) {
                if (session.run.goldenBalls >= requiredBalls) {
                    session.run.phase++;
                    session.run.goldenBalls = 0;
                    advancePhase();
                    phaseLabel.text = getPhaseName(session.run.phase);
                    phaseLabelShadow.text = getPhaseName(session.run.phase);
                    punch(phaseLabel, 1.3);
                    screenFlash(rgb(255, 210, 60), 0.22, 0.5);
                    shake(6);
                    if (session.audio.gameAmbience) {
                        const rawTarget = Math.min(0.34, 0.18 + session.run.phase * 0.016);
                        const effectiveTarget = session.audio.muted ? 0 : rawTarget * session.audio.musicVolume;
                        tween(session.audio.gameAmbience.volume, effectiveTarget, 0.8, (v) => session.audio.gameAmbience.volume = v, easings.easeOutQuad);
                        session.audio.gameAmbience.detune = Math.min(250, session.run.phase * 22);
                    }
                    add([
                        text(`NEW STAGE: ${getPhaseName(session.run.phase)}`, { size: 32, font: "bebas" }),
                        pos(center().x, center().y - 100),
                        anchor("center"),
                        color(255, 215, 0),
                        lifespan(2, { fade: 0.5 }),
                        fixed(),
                        z(200)
                    ]);
                }
                crystalLabel.text = `${session.run.goldenBalls} / ${requiredBalls}`;
            } else {
                if (session.run.goldenBalls >= 50) {
                    if (session.audio.gameAmbience) session.audio.gameAmbience.stop();
                    window.gameInputActive = false;
                    go("win", session.run.totalCoinsEarned, time() - session.run.matchStartTime);
                }
            }
        });

        onCollide("player", "coin", (p, c) => {
            destroy(c);
            play("coin", { volume: 0.28, detune: rand(-40, 40) });
            session.run.score += 1;
            session.run.totalCoinsEarned += 1;
            scoreLabel.text = session.run.score;
            punch(coinIcon, 1.4);

            // First-time contextual nudge: once the player can actually afford the
            // cheapest upgrade but has never opened the shop, tell them where it is -
            // the corner hint alone is too easy to miss while focused on the pitch.
            if (!shopOpenedOnce && !shopHintToastShown && session.run.score >= 10) {
                shopHintToastShown = true;
                const toastShadow = add([
                    text("TIP: PRESS [E] TO OPEN THE STRATEGY SHOP", { size: 20, font: "bebas" }),
                    pos(center().x + 2, height() * 0.16 + 2), anchor("center"), color(0, 0, 0), opacity(0), fixed(), z(150)
                ]);
                const toastFace = add([
                    text("TIP: PRESS [E] TO OPEN THE STRATEGY SHOP", { size: 20, font: "bebas" }),
                    pos(center().x, height() * 0.16), anchor("center"), color(0, 225, 255), outline(2, rgb(5, 10, 12)), opacity(0), scale(1), fixed(), z(151)
                ]);
                riseIn(toastShadow, 0, 10, 0.3);
                riseIn(toastFace, 0, 10, 0.3);
                punch(toastFace, 1.15);
                wait(3.5, () => {
                    tween(1, 0, 0.4, (o) => { toastShadow.opacity = o; toastFace.opacity = o; }, easings.easeOutQuad);
                    wait(0.4, () => { destroy(toastShadow); destroy(toastFace); });
                });
            }
        });

        onCollide("player", "enemy", (p, e) => {
            if (isDashing) {
                registerKill(e.bugType, e.pos, rgb(255, 50, 50));
                destroy(e);
                play("ball_kick", { volume: 0.5 });
                return;
            }
            if (session.upgrades.shieldActive) {
                session.upgrades.shieldActive = false;
                session.upgrades.shieldCooldown = 30;
                screenFlash(rgb(0, 215, 255), 0.3, 0.25);
                shake(5);
                spawnImpactRing(p.pos, rgb(0, 215, 255), 44);
                destroy(e);
                spawnParticles(p.pos, rgb(255, 255, 255));
                return;
            }
            const elapsedSeconds = time() - session.run.matchStartTime;
            destroy(p);
            if (session.audio.gameAmbience) session.audio.gameAmbience.stop();
            window.gameInputActive = false;
            screenFlash(rgb(255, 40, 40), 0.55, 0.4);
            hitStop(0.12, 0.04);
            shake(14);
            wait(0.18, () => {
                go("lose", session.run.totalCoinsEarned, session.run.phase, elapsedSeconds);
            });
        });
    });
}