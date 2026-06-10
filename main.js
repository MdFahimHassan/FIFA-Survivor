// ==========================================
// 1. INITIALIZATION & PREMIUM ASSETS
// ==========================================

kaboom({
    background: [10, 14, 12], // Deep stadium dark green/grey
    clearColor: [0, 0, 0, 1],
    loadingScreen: false, // Disable default loading screen for custom implementation
});

// --- LOAD CUSTOM SPORT FONTS ---
loadFont("bebas", "fonts/OutlastRegular.ttf");
loadFont("teko", "fonts/Teko-Bold.ttf");

// --- CORE GRAPHICS ---
loadSprite("coin", "sprites/coin.png");
loadSprite("golden_ball", "sprites/golden_ball.png");
loadSprite("trophy", "sprites/trophy.png");
loadSprite("ball", "sprites/ball.png");
loadSprite("bicycle_kick", "sprites/bycycle_kick.png");
loadSprite("loading_ball", "sprites/loading_ball.png");

// Ultra-smooth 60FPS 3D looping Star sheet
loadSprite("coin_3d", "sprites/coin_3d.png", {
    sliceX: 9,
    anims: {
        spin: { from: 0, to: 7, loop: true, speed: 45 }
    }
});
// Load the background and players
loadSprite("stadium", "sprites/stadium.png");
loadSprite("players", "sprites/players.png");

const countries = [
    "algeria", "argentina", "australia", "austria", "belgium", "bosnia&herzegovina", "brazil", "cabo_verde",
    "canada", "colombia", "congo_dr", "cote_d'ivoire", "croatia", "curacao", "czechia", "ecuador", "egypt", "england",
    "france", "germany", "ghana", "haiti", "iran", "iraq", "japan", "jordan", "mexico", "morocco", "netherlands",
    "new_zealand", "norway", "panama", "paraguay", "portugal", "qatar", "saudi_arabia", "scotland", "senegal",
    "south_africa", "south_korea", "spain", "sweden", "switzerland", "tunisia", "turkey", "uruguay", "usa", "uzbekistan"
];

countries.forEach(country => {
    loadSprite(country, encodeURI(`sprites/${country}.png`));
});

const BULLET_SPEED = 400;

let player;
let score = 0; let currentPhase = 1; let currentEnemySpeed = 110; let currentSpawnRate = 0.65;
let spawnTimer = 0; let goldenBallsCollected = 0;

// Upgrade System State
let upgFireRateLevel = 0; let upgSpeedLevel = 0; let upgMagnetLevel = 0;
let playerSpeed = 180; let fireRate = 0.6; let magnetRadius = 35;

let hasShotgun = false; let hasShield = false; let hasPiercing = false;
let shieldActive = false; let shieldCooldown = 0;
let isMoving = false; let stillTimer = 0;
let isUpgrading = false;

// Skills
let bicycleCooldown = 0;
const BICYCLE_COOLDOWN_MAX = 15;
const BICYCLE_AOE_RADIUS = 160; // Expanded slightly for better balancing

let myTeamSprite = "argentina";

// ==========================================
// 2. GLOBAL SYSTEM HELPER FUNCTIONS
// ==========================================
const deg2rad = (deg) => deg * Math.PI / 180;
const rad2deg = (rad) => rad * 180 / Math.PI;

function spawnParticles(spawnPos, customColor = rgb(255, 255, 255)) {
    for (let i = 0; i < 6; i++) {
        add([
            rect(6, 6), pos(spawnPos), color(customColor), anchor("center"),
            move(rand(0, 360), rand(150, 350)), opacity(1), lifespan(0.25, { fade: 0.25 })
        ]);
    }
}

function spawnCoin(spawnPos) {
    add([
        sprite("coin"),
        pos(spawnPos),
        scale(1.0),
        area(),
        anchor("center"),
        lifespan(10, { fade: 1.5 }),
        "coin",
        z(20)
    ]);
}

function spawnGoldenBall(spawnPos) {
    const gb = add([
        sprite("golden_ball"),
        pos(spawnPos),
        scale(1.0),
        area(),
        anchor("center"),
        lifespan(5, { fade: 1.0 }),
        "goldenball",
        z(20)
    ]);

    gb.onUpdate(() => { gb.angle += dt() * 60; });

    gb.onDraw(() => {
        drawCircle({
            pos: vec2(0, 0),
            radius: 36 + Math.sin(time() * 10) * 5,
            color: rgb(255, 215, 0),
            opacity: 0.45,
            fill: true
        });
        drawCircle({
            pos: vec2(0, 0),
            radius: 22 + Math.sin(time() * 10) * 2,
            color: rgb(255, 255, 230),
            opacity: 0.3
        });
    });
}

function getGoldenBallChance() {
    if (currentPhase <= 1) return 0.30;
    if (currentPhase >= 10) return 0.03;
    const slope = (0.03 - 0.30) / 9;
    return Math.max(0.03, 0.30 + slope * (currentPhase - 1));
}

function rollStandardLoot(spawnPos) {
    if (chance(getGoldenBallChance())) spawnGoldenBall(spawnPos);
    else spawnCoin(spawnPos);
}

function dropEnemyLoot(enemyPos, enemyType = "normal") {
    if (enemyType === "boss") {
        for (let i = 0; i < 9; i++) spawnCoin(enemyPos.add(rand(-40, 40), rand(-40, 40)));
        for (let i = 0; i < 4; i++) spawnGoldenBall(enemyPos.add(rand(-40, 40), rand(-40, 40)));
        return;
    }
    if (enemyType === "defender") {
        add([circle(40), pos(enemyPos), color(139, 69, 19), opacity(0.25), area(), anchor("center"), z(10), lifespan(3.0, { fade: 0.8 }), "foulZone"]);
        rollStandardLoot(enemyPos.add(rand(-20, 20), rand(-20, 20)));
        rollStandardLoot(enemyPos.add(rand(-20, 20), rand(-20, 20)));
        return;
    }
    rollStandardLoot(enemyPos.add(rand(-20, 20), rand(-20, 20)));
    if (chance(0.25)) rollStandardLoot(enemyPos.add(rand(-20, 20), rand(-20, 20)));
}

// --- LOADING SCENE ---
scene("loading", () => {
    const LOADING_TIME = 2.5;
    let progress = 0;
    const barMaxWidth = 280;

    const loadBg = add([
        sprite("stadium"),
        pos(center()),
        anchor("center"),
        scale(1),
        z(0)
    ]);

    const updateLoadingScale = () => {
        if (loadBg.width && loadBg.height) {
            const scaleFactor = Math.max(width() / loadBg.width, height() / loadBg.height);
            loadBg.scale = vec2(scaleFactor, scaleFactor);
        }
    };

    loadBg.onUpdate(updateLoadingScale);

    const baseX = center().x;
    const baseY = center().y;

    add([
        text("L", { size: 54, font: "bebas" }),
        pos(baseX - 102, baseY - 47), // Offset down and right
        color(0, 0, 0),
        opacity(0.6),
    ]);

    const spinningO = add([
        sprite("loading_ball"),
        pos(baseX - 59, baseY - 28),
        scale(0.1),
        rotate(0),
        anchor("center"),
        z(10)
    ]);

    add([
        text("L", { size: 54, font: "bebas" }),
        pos(baseX - 105, baseY - 50),
        color(255, 255, 255),
        outline(2, rgb(10, 10, 10))
    ]);
    add([
        text("ADING", { size: 54, font: "bebas", letterSpacing: 2 }),
        pos(baseX - 29, baseY - 47), // Offset down and right
        color(0, 0, 0),
        opacity(0.6),
    ]);
    // Main "ADING"
    add([
        text("ADING", { size: 54, font: "bebas", letterSpacing: 2 }),
        pos(baseX - 32, baseY - 50),
        color(255, 255, 255),
        outline(2, rgb(10, 10, 10))
    ]);

    add([
        rect(barMaxWidth + 8, 12, { radius: 6 }),
        pos(baseX, baseY + 40),
        color(20, 26, 23),
        outline(1, rgb(45, 60, 50)),
        anchor("center"),
        z(5)
    ]);

    const progressFill = add([
        rect(0, 6, { radius: 3 }),
        pos(baseX - barMaxWidth / 2, baseY + 40),
        color(0, 215, 140),
        anchor("left"),
        z(6)
    ]);

    let assetsLoaded = false;
    onLoad(() => {
        assetsLoaded = true;
    });

    onUpdate(() => {
        const smoothDt = Math.min(dt(), 0.016);
        spinningO.angle += smoothDt * 160;
        progress += smoothDt / LOADING_TIME;
        if (progress > 1) progress = 1;

        progressFill.width = barMaxWidth * progress;

        if (progress >= 1 && assetsLoaded) {
            go("menu");
        }
    });
});

// ==========================================
// 3. MAIN TITLE SCREEN
// ==========================================
scene("menu", () => {
    const bg = add([
        sprite("players"),
        pos(center()),
        anchor("center"),
        scale(1),
        z(0)
    ]);

    bg.onUpdate(() => {
        if (bg.width && bg.height) {
            const scaleFactor = Math.max(width() / bg.width, height() / bg.height);
            bg.scale = vec2(scaleFactor, scaleFactor);
        }
    });

    // 1. TITLE: HEAVY BLACK DROP SHADOW
    add([
        text("FIFA SURVIVOR", { size: 68, font: "bebas" }),
        pos(center().x + 3, height() * 0.20 + 3), // Solid offset
        anchor("center"),
        color(0, 0, 0),                            // Pure black shadow
        opacity(0.9),                              // High opacity to ground it against the lights
        z(99)
    ]);

    // 2. TITLE: PREMIUM CHAMPAGNE GOLD FRONT
    add([
        text("FIFA SURVIVOR", { size: 68, font: "bebas" }),
        pos(center().x, height() * 0.20),
        anchor("center"),
        color(255, 228, 160),                     // Luxury platinum/champagne gold (less "neon yellow", more metallic)
        outline(3, rgb(15, 15, 15)),               // Sharp, thin black frame to lock it in
        z(100)
    ]);

    // 3. SUBTITLE: BLACK DROP SHADOW
    add([
        text("FIFA 26: LAST TEAM STANDING", { size: 18, font: "bebas", letterSpacing: 2 }),
        pos(center().x + 2, height() * 0.27 + 2),
        anchor("center"),
        color(0, 0, 0),                            // Pure black shadow
        opacity(0.85),
        z(99)
    ]);

    // 4. SUBTITLE: PREMIUM ICE-SILVER FRONT
    add([
        text("FIFA 26: LAST TEAM STANDING", { size: 18, font: "bebas", letterSpacing: 2 }),
        pos(center().x, height() * 0.27),
        anchor("center"),
        color(230, 240, 245),                     // Clean, matte scoreboard silver-white
        outline(2, rgb(15, 15, 15)),               // Sharp black outline
        z(100)
    ]);

    // Variable to track the tween animation
    let menuBtnTween = null;

    // 1. Create the main button container
    const playBtn = add([
        rect(240, 54, { radius: 4 }),
        pos(center().x, height() * 0.45),
        anchor("center"),
        scale(1), // Baseline scale
        color(10, 16, 14),
        outline(1.5, rgb(0, 255, 150)),
        area(),
    ]);

    // 2. Add the text AS A CHILD of the button (so it scales together)
    playBtn.add([
        text("KICK OFF", { size: 24, font: "bebas" }),
        anchor("center"),
        color(255, 255, 255),
    ]);

    // 3. Smooth Hover logic
    playBtn.onHover(() => {
        setCursor("pointer");
        playBtn.outline.color = rgb(255, 215, 0); // Optional: Glows gold on hover

        if (menuBtnTween) menuBtnTween.cancel();
        menuBtnTween = tween(
            playBtn.scale,
            vec2(1.06), // Grow by 6%
            0.15,
            (val) => playBtn.scale = val,
            easings.easeOutQuad
        );
    });

    playBtn.onHoverEnd(() => {
        setCursor("default");
        playBtn.outline.color = rgb(0, 255, 150); // Returns to neon green

        if (menuBtnTween) menuBtnTween.cancel();
        menuBtnTween = tween(
            playBtn.scale,
            vec2(1.0), // Shrink back to normal
            0.15,
            (val) => playBtn.scale = val,
            easings.easeOutQuad
        );
    });

    // Click logic (keep whatever you had inside here)
    playBtn.onClick(() => {
        go("start");
    });
});

// ==========================================
// 4. TEAM SELECT SCREEN
// ==========================================
scene("start", () => {
    const bg = add([
        sprite("stadium"),
        pos(center()),
        anchor("center"),
        scale(1),
        z(0)
    ]);

    bg.onUpdate(() => {
        if (bg.width && bg.height) {
            const scaleFactor = Math.max(width() / bg.width, height() / bg.height);
            bg.scale = vec2(scaleFactor, scaleFactor);
        }
    });

    // --- PREMIUM TITLE: BLACK DROP SHADOW ---
    add([
        text("SELECT YOUR TEAM", { size: 52, font: "bebas" }),
        pos(center().x + 3, height() * 0.14 + 3),
        anchor("center"),
        color(0, 0, 0),
        opacity(0.9)
    ]);
    
    // --- PREMIUM TITLE: CHAMPAGNE GOLD FACE ---
    add([
        text("SELECT YOUR TEAM", { size: 52, font: "bebas" }),
        pos(center().x, height() * 0.14),
        anchor("center"),
        color(255, 228, 160), 
        outline(3, rgb(15, 15, 15))
    ]);

    // --- PREMIUM SUBTITLE: BLACK DROP SHADOW ---
    add([
        text("CLICK A NATION FROM THE GRID TO CHOOSE YOUR SQUAD", { size: 16, font: "bebas", letterSpacing: 2 }),
        pos(center().x + 2, height() * 0.20 + 2),
        anchor("center"),
        color(0, 0, 0),
        opacity(0.85)
    ]);
    
    // --- PREMIUM SUBTITLE: ICE-SILVER FACE ---
    add([
        text("CLICK A NATION FROM THE GRID TO CHOOSE YOUR SQUAD", { size: 16, font: "bebas", letterSpacing: 2 }),
        pos(center().x, height() * 0.20),
        anchor("center"),
        color(230, 240, 245),
        outline(2, rgb(15, 15, 15))
    ]);

    const previewX = width() * 0.73;
    const previewY = height() * 0.48;

    // --- TEAM PREVIEW CARD: GLASSMORPHIC ---
    add([
        rect(280, 280, { radius: 8 }),
        pos(previewX, previewY),
        anchor("center"),
        color(8, 12, 10),
        opacity(0.85), // Darkened slightly for better contrast against stadium
        outline(1, rgb(0, 255, 150)), // Fine neon framing line
        fixed(),
        z(1)
    ]);

    const teamSprite = add([
        sprite(myTeamSprite),
        pos(previewX, previewY - 20),
        anchor("center"),
        scale(1.3),
        z(2),
        fixed()
    ]);

    const teamLabel = add([
        text(myTeamSprite.replace(/_/g, " ").replace(/&/g, " & ").toUpperCase(), { size: 24, font: "bebas" }),
        pos(previewX, previewY + 100),
        anchor("center"),
        color(255, 255, 255),
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
        teamSprite.use(sprite(myTeamSprite));
        teamLabel.text = displayName(myTeamSprite);
        const selected = countryButtons.find((btn) => btn.country === myTeamSprite);
        if (selected) {
            selectionBorder.pos = selected.pos.add(cellW / 2, cellH / 2);
            selectionBorder.opacity = 1;
        }
    };

    // --- TEAM GRID SETUP ---
    countries.forEach((country, idx) => {
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

        // Changes border color on hover for premium selection feel
        btn.onHover(() => { btn.outline.color = rgb(0, 255, 150); setCursor("pointer"); });
        btn.onHoverEnd(() => { btn.outline.color = rgb(255, 255, 255); setCursor("default"); });
        
        add([
            text(displayName(country), { size: 11, font: "bebas" }),
            pos(x + cellW / 2, y + cellH / 2),
            anchor("center"),
            color(240, 240, 240),
            fixed(),
            z(2)
        ]);
        
        btn.onClick(() => {
            myTeamSprite = country;
            updateTeamDisplay();
        });
        countryButtons.push(btn);
    });

    updateTeamDisplay();

    // --- SMOOTH SCALING START MATCH BUTTON ---
    let startBtnTween = null;

    const confirmBtn = add([
        rect(240, 52, { radius: 4 }), // Sharper radius to match glass panels
        pos(previewX, height() * 0.80),
        anchor("center"),
        scale(1), // Critical for tweening
        color(10, 16, 14),
        outline(1.5, rgb(0, 255, 150)),
        area(),
        fixed(),
        z(2)
    ]);

    confirmBtn.add([
        text("START MATCH", { size: 24, font: "bebas" }),
        anchor("center"),
        color(255, 255, 255)
    ]);

    confirmBtn.onHover(() => { 
        setCursor("pointer"); 
        confirmBtn.outline.color = rgb(255, 215, 0); // Gold highlight
        
        if (startBtnTween) startBtnTween.cancel();
        startBtnTween = tween(
            confirmBtn.scale,
            vec2(1.06), 
            0.15,
            (val) => confirmBtn.scale = val,
            easings.easeOutQuad
        );
    });
    
    confirmBtn.onHoverEnd(() => { 
        setCursor("default"); 
        confirmBtn.outline.color = rgb(0, 255, 150); // Reset to neon
        
        if (startBtnTween) startBtnTween.cancel();
        startBtnTween = tween(
            confirmBtn.scale,
            vec2(1.0), 
            0.15,
            (val) => confirmBtn.scale = val,
            easings.easeOutQuad
        );
    });

    confirmBtn.onClick(() => go("game"));
    onKeyPress("enter", () => go("game"));
});

// ==========================================
// 5. MAIN GAME SCENE
// ==========================================
scene("game", () => {
    // Reset tactical state engine values cleanly
    score = 0; currentPhase = 1; currentEnemySpeed = 110; currentSpawnRate = 0.65; spawnTimer = 0; goldenBallsCollected = 0;
    upgFireRateLevel = 0; upgSpeedLevel = 0; upgMagnetLevel = 0; playerSpeed = 180; fireRate = 0.6; magnetRadius = 35;
    stillTimer = 0; hasShotgun = false; hasShield = false; hasPiercing = false; shieldActive = false; shieldCooldown = 0;
    isUpgrading = false; bicycleCooldown = 0;

    // Pitch Background Rendering
    onDraw(() => {
        const stripeWidth = 110; const cam = camPos();
        const startX = Math.floor((cam.x - width() / 2) / stripeWidth) * stripeWidth;
        const endX = Math.ceil((cam.x + width() / 2) / stripeWidth) * stripeWidth;

        drawRect({ pos: vec2(cam.x - width() / 2, cam.y - height() / 2), width: width(), height: height(), color: rgb(34, 82, 48) });

        for (let x = startX; x <= endX; x += stripeWidth) {
            if (Math.round(x / stripeWidth) % 2 === 0) {
                drawRect({ pos: vec2(x, cam.y - height() / 2), width: stripeWidth, height: height(), color: rgb(40, 94, 56) });
            }
        }
        drawLine({ p1: vec2(0, cam.y - height() / 2), p2: vec2(0, cam.y + height() / 2), color: rgb(255, 255, 255), width: 3 });
        drawCircle({ pos: vec2(0, 0), radius: 200, fill: false, outline: { color: rgb(255, 255, 255), width: 3 } });
        drawCircle({ pos: vec2(0, 0), radius: 5, color: rgb(255, 255, 255) });
    });

    player = add([rect(50, 50), pos(0, 0), anchor("center"), area(), opacity(0), "player", z(50)]);
    player.add([circle(32), color(0, 230, 255), opacity(0.25), anchor("center")]);
    player.add([sprite(myTeamSprite), scale(0.8), anchor("center")]);

    player.onDraw(() => {
        if (shieldActive) drawCircle({ radius: 36, fill: false, outline: { color: rgb(0, 235, 255), width: 3 } });
    });

    // ==========================================
    // PREMIUM HUD LAYER (Broadcast Glassmorphism)
    // ==========================================
    const hudContainer = add([fixed(), z(100)]);

    hudContainer.onDraw(() => {
        // Star Metric Backing
        drawRect({ pos: vec2(15, 15), width: 145, height: 42, color: rgb(15, 22, 18), opacity: 0.85, radius: 4, outline: { color: rgb(40, 55, 45), width: 1 } });
        // Ball Metric Backing
        drawRect({ pos: vec2(15, 65), width: 145, height: 42, color: rgb(15, 22, 18), opacity: 0.85, radius: 4, outline: { color: rgb(40, 55, 45), width: 1 } });
    });

    const coinHUD = add([
        sprite("coin"),
        pos(38, 36),
        scale(0.55),
        anchor("center"),
        fixed(),
        z(101)
    ]);
    const scoreLabel = add([text("0", { size: 26, font: "bebas" }), pos(72, 23), color(255, 255, 255), outline(1, rgb(15, 15, 15)), fixed(), z(101)]);

    add([sprite("golden_ball"), pos(38, 86), scale(0.55), anchor("center"), fixed(), z(101)]);

    const crystalLabel = add([text(`0 / ${3 + currentPhase * 2}`, { size: 24, font: "bebas" }), pos(72, 74), color(255, 215, 0), outline(1, rgb(20, 15, 0)), fixed(), z(101)]);

    const phaseLabelShadow = add([text("GROUP STAGE", { font: "bebas" }), pos(center().x + 3, center().y + 3), scale(2), color(15, 15, 15), opacity(0.65), anchor("center"), fixed(), z(99)]);
    const phaseLabel = add([text("GROUP STAGE", { font: "bebas" }), pos(center()), scale(2), color(255, 255, 255), outline(2, rgb(10, 10, 10)), anchor("center"), fixed(), z(100)]);
    add([text("[E] STRATEGY SHOP", { size: 16, font: "bebas" }), pos(width() - 22, 22), anchor("topright"), color(10, 10, 10), opacity(0.65), fixed(), z(99)]);
    add([text("[E] STRATEGY SHOP", { size: 16, font: "bebas" }), pos(width() - 20, 20), anchor("topright"), color(0, 215, 255), outline(1, rgb(10, 20, 25)), fixed(), z(100)]);

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

    // ==========================================
    // BALANCED SINGLE ACTION HUD (Centered Perfectly)
    // ==========================================
    const slotX = center().x;
    const slotY = height() - 50;
    const slotSize = 58;

    add([circle(slotSize / 2), pos(slotX, slotY), anchor("center"), color(20, 25, 22), outline(2, rgb(0, 215, 140)), fixed(), z(150)]);
    add([sprite("bicycle_kick"), pos(slotX, slotY), scale(0.17), anchor("center"), fixed(), z(151)]);
    const bicycleIconOverlay = add([circle(slotSize / 2), pos(slotX, slotY), anchor("center"), color(10, 15, 12), opacity(0), fixed(), z(152)]);
    const bicycleCooldownCounter = add([text("", { size: 22, font: "bebas" }), pos(slotX, slotY), anchor("center"), color(255, 255, 255), outline(2, rgb(0, 0, 0)), fixed(), z(153)]);

    // Key Controller Tag
    add([rect(36, 14, { radius: 3 }), pos(slotX, slotY - 34), anchor("center"), color(0, 0, 0), outline(1, rgb(255, 255, 255)), fixed(), z(154)]);
    add([text("SPACE", { size: 9, font: "bebas" }), pos(slotX, slotY - 34), anchor("center"), color(255, 255, 255), fixed(), z(155)]);

    // ==========================================
    // 6. PLAYER CONTROLS & LOOPS
    // ==========================================
    onUpdate(() => {
        if (isUpgrading) return;
        camPos(player.pos); isMoving = false;
        if (isKeyDown("left") || isKeyDown("a") || isKeyDown("right") || isKeyDown("d") || isKeyDown("up") || isKeyDown("w") || isKeyDown("down") || isKeyDown("s")) isMoving = true;
        stillTimer = isMoving ? 0 : stillTimer + dt();
        if (hasShield && !shieldActive) { shieldCooldown -= dt(); if (shieldCooldown <= 0) shieldActive = true; }
    });

    onKeyDown("left", () => { if (!isUpgrading) player.move(-playerSpeed, 0); });
    onKeyDown("a", () => { if (!isUpgrading) player.move(-playerSpeed, 0); });
    onKeyDown("right", () => { if (!isUpgrading) player.move(playerSpeed, 0); });
    onKeyDown("d", () => { if (!isUpgrading) player.move(playerSpeed, 0); });
    onKeyDown("up", () => { if (!isUpgrading) player.move(0, -playerSpeed); });
    onKeyDown("w", () => { if (!isUpgrading) player.move(0, -playerSpeed); });
    onKeyDown("down", () => { if (!isUpgrading) player.move(0, playerSpeed); });
    onKeyDown("s", () => { if (!isUpgrading) player.move(0, playerSpeed); });

    onUpdate(() => {
        if (isUpgrading) return;
        spawnTimer -= dt(); if (spawnTimer <= 0) { spawnEnemy(); spawnTimer = currentSpawnRate; }

        if (bicycleCooldown > 0) {
            bicycleCooldown -= dt();
            if (bicycleCooldown < 0) bicycleCooldown = 0;
            bicycleIconOverlay.opacity = 0.75;
            bicycleCooldownCounter.text = `${Math.ceil(bicycleCooldown)}`;
        } else {
            bicycleIconOverlay.opacity = 0;
            bicycleCooldownCounter.text = "";
        }
    });

    onUpdate(() => {
        if (isUpgrading) return;
        ["coin", "goldenball"].forEach((tag) => {
            get(tag).forEach((item) => {
                if (player.pos.dist(item.pos) <= magnetRadius) item.move(player.pos.sub(item.pos).unit().scale(240));
            });
        });
    });

    function getNearestEnemy() {
        const enemies = get("enemy"); if (enemies.length === 0) return null;
        let nearest = null; let minDistance = Infinity;
        for (const enemy of enemies) {
            const dist = player.pos.dist(enemy.pos);
            if (dist < minDistance) { minDistance = dist; nearest = enemy; }
        }
        return nearest;
    }

    function spawnEnemy() {
        if (isUpgrading) return;
        let type = "normal";
        if (currentPhase >= 4 && currentPhase < 7) type = choose(["normal", "normal", "winger"]);
        else if (currentPhase >= 7 && currentPhase < 10) type = choose(["normal", "winger", "defender"]);
        else if (currentPhase >= 10) type = choose(["normal", "winger", "defender", "boss"]);

        const cam = camPos(); const edge = choose(["top", "bottom", "left", "right"]);
        const w = width() / 2 + 50; const h = height() / 2 + 50;
        let spawnPoint = vec2(0, 0);

        if (edge === "top") spawnPoint = vec2(rand(cam.x - w, cam.x + w), cam.y - h);
        if (edge === "bottom") spawnPoint = vec2(rand(cam.x - w, cam.x + w), cam.y + h);
        if (edge === "left") spawnPoint = vec2(cam.x - w, rand(cam.y - h, cam.y + h));
        if (edge === "right") spawnPoint = vec2(cam.x + w, rand(cam.y - h, cam.y + h));

        let enemyHp = 1; let enemyScale = 0.8;
        if (type === "winger") enemyScale = 0.6;
        else if (type === "defender") { enemyHp = 2; enemyScale = 1.1; }
        else if (type === "boss") { enemyHp = 15; enemyScale = 2.0; }

        let rivalPool = countries.filter(c => c !== myTeamSprite);
        let rivalTeam = choose(rivalPool);

        const enemy = add([
            rect(50, 50), pos(spawnPoint), anchor("center"), area(), opacity(0), "enemy", z(10),
            { bugType: type, hp: enemyHp }
        ]);

        enemy.add([circle(32), color(220, 40, 40), opacity(0.35), anchor("center")]);
        enemy.add([sprite(rivalTeam), scale(enemyScale), anchor("center")]);

        enemy.onUpdate(() => {
            if (isUpgrading) return;
            const direction = player.pos.sub(enemy.pos).unit();
            let speedMultiplier = (stillTimer > 1.5) ? 2.5 : 1.0;
            let typeSpeed = currentEnemySpeed;

            if (enemy.bugType === "winger") typeSpeed *= 1.5;
            else if (enemy.bugType === "defender") typeSpeed *= 0.75;
            else if (enemy.bugType === "boss") typeSpeed *= 0.5;

            enemy.move(direction.scale(typeSpeed * speedMultiplier));
        });

        enemy.onDraw(() => {
            if (stillTimer > 1.5) {
                drawCircle({ pos: vec2(0, 0), radius: 36, color: rgb(255, 50, 50), opacity: 0.18, fill: true });
                drawCircle({ pos: vec2(0, 0), radius: 38, color: rgb(255, 0, 0), outline: { width: 3, color: rgb(255, 80, 80) } });
            }
        });
    }

    function advancePhase() {
        currentEnemySpeed += 22; currentSpawnRate *= 0.80;
        let phaseText = "MATCH DAY " + currentPhase;
        if (currentPhase === 4) phaseText = "ROUND OF 16";
        if (currentPhase === 7) phaseText = "QUARTER FINALS";
        if (currentPhase === 10) phaseText = "THE WORLD CUP FINAL";

        phaseLabel.text = phaseText; phaseLabel.scale = vec2(2); phaseLabel.pos = center();
        phaseLabelShadow.text = phaseText; phaseLabelShadow.scale = vec2(2); phaseLabelShadow.pos = center().add(3, 3);

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
    }

    let shootTimer = 0;
    onUpdate(() => {
        if (isUpgrading) return;
        shootTimer += dt();
        if (shootTimer >= fireRate) {
            shootTimer = 0; const nearestEnemy = getNearestEnemy(); if (!nearestEnemy) return;
            const diff = nearestEnemy.pos.sub(player.pos); const baseAngle = Math.atan2(diff.y, diff.x);
            const spreadAngles = hasShotgun ? [-15, 0, 15] : [0];

            spreadAngles.forEach((spreadOffset) => {
                const finalAngle = baseAngle + deg2rad(rand(-14, 14)) + deg2rad(spreadOffset);
                add([
                    sprite("ball"), pos(player.pos), scale(0.5), anchor("center"), area(),
                    move(Vec2.fromAngle(rad2deg(finalAngle)), BULLET_SPEED), lifespan(1.8), "bullet", { pierceHp: hasPiercing ? 2 : 1 }, z(30)
                ]);
            });
        }
    });

    // UNIFIED BICYCLE KICK (With Screen Shockwave Shake mechanics merged!)
    onKeyPress("space", () => {
        if (isUpgrading || bicycleCooldown > 0) return;
        bicycleCooldown = BICYCLE_COOLDOWN_MAX;

        // Massive shockwave shake engine integration
        shake(6);

        const kickWave = add([
            circle(10), pos(player.pos), color(255, 255, 255), opacity(0.52), anchor("center"), z(65)
        ]);
        tween(10, BICYCLE_AOE_RADIUS, 0.32, (r) => kickWave.radius = r, easings.easeOutQuad);
        tween(0.52, 0, 0.32, (o) => kickWave.opacity = o, easings.easeOutQuad);
        wait(0.32, () => destroy(kickWave));

        get("enemy").forEach((enemy) => {
            if (player.pos.dist(enemy.pos) <= BICYCLE_AOE_RADIUS) {
                spawnParticles(enemy.pos, rgb(0, 215, 140)); // Dynamic Tournament Green particles
                dropEnemyLoot(enemy.pos, enemy.bugType);
                destroy(enemy);
            }
        });
    });

    // ==========================================
    // 7. STRATEGY ROOM (SHOP INTERFACE)
    // ==========================================
    let shopUIComponents = [];

    onKeyPress("e", () => {
        isUpgrading = !isUpgrading;
        if (isUpgrading) {
            const backdrop = add([rect(580, 530, { radius: 8 }), pos(center()), anchor("center"), color(14, 18, 16), outline(3, rgb(0, 215, 140)), fixed(), z(200)]);
            add([text("TEAM STRATEGY ROOM", { size: 30, font: "bebas" }), pos(center().x + 2, center().y - 223), anchor("center"), color(10, 10, 10), opacity(0.6), fixed(), z(200)]);
            const title = add([text("TEAM STRATEGY ROOM", { size: 30, font: "bebas" }), pos(center().x, center().y - 225), anchor("center"), color(255, 215, 0), outline(2, rgb(12, 8, 0)), fixed(), z(201)]);
            shopUIComponents.push(backdrop, title);

            const createUpgradeRow = (labelName, statusDisplay, cost, yOffset, isOwned, onUpgradeClick) => {
                const textInfo = add([text(`${labelName} (${statusDisplay})`, { size: 16, font: "bebas" }), pos(center().x - 250, center().y + yOffset), anchor("left"), color(235, 235, 235), outline(1, rgb(10, 10, 10)), fixed(), z(201)]);

                const btnColor = isOwned ? rgb(35, 40, 38) : (score >= cost ? rgb(0, 180, 120) : rgb(60, 65, 62));
                const buyBtn = add([rect(140, 34, { radius: 4 }), pos(center().x + 180, center().y + yOffset), color(btnColor), anchor("center"), area(), fixed(), z(201)]);
                const buyText = add([text(isOwned ? "OWNED" : `COST: $${cost}`, { size: 15, font: "bebas" }), pos(center().x + 180, center().y + yOffset), anchor("center"), color(255, 255, 255), outline(1, rgb(10, 10, 10)), fixed(), z(202)]);

                if (!isOwned) {
                    buyBtn.onClick(() => {
                        if (score >= cost) { score -= cost; scoreLabel.text = score; onUpgradeClick(); refreshShop(); }
                    });
                }
                shopUIComponents.push(textInfo, buyBtn, buyText);
            };

            const refreshShop = () => {
                shopUIComponents.forEach(c => { if (c !== backdrop && c !== title) c.destroy(); });
                let rateCost = (upgFireRateLevel + 1) * 25;
                let speedCost = (upgSpeedLevel + 1) * 20;
                let magnetCost = (upgMagnetLevel + 1) * 15;

                createUpgradeRow("Striking Speed", `Lv ${upgFireRateLevel}`, rateCost, -150, false, () => { upgFireRateLevel++; fireRate = Math.max(0.15, 0.6 - (upgFireRateLevel * 0.07)); });
                createUpgradeRow("Running Speed", `Lv ${upgSpeedLevel}`, speedCost, -100, false, () => { upgSpeedLevel++; playerSpeed = 180 + (upgSpeedLevel * 25); });
                createUpgradeRow("Ball Magnet", `Lv ${upgMagnetLevel}`, magnetCost, -50, false, () => { upgMagnetLevel++; magnetRadius = 35 + (upgMagnetLevel * 22); });

                const separator = add([text("--- ENDGAME TALENT TIER ---", { size: 14, font: "bebas" }), pos(center().x, center().y + 10), anchor("center"), color(255, 215, 0), outline(1, rgb(12, 10, 5)), fixed(), z(201)]);
                shopUIComponents.push(separator);

                createUpgradeRow("Shotgun Tactic (3-Way)", hasShotgun ? "OWNED" : "TACTIC", 80, 55, hasShotgun, () => { hasShotgun = true; });
                createUpgradeRow("Energy Shield (1 Hit)", hasShield ? "OWNED" : "TACTIC", 110, 105, hasShield, () => { hasShield = true; shieldActive = true; });
                createUpgradeRow("Piercing Ball (Drill)", hasPiercing ? "OWNED" : "TACTIC", 140, 155, hasPiercing, () => { hasPiercing = true; });
            };

            refreshShop();
            add([text("PRESS [E] TO RESUME MATCH", { size: 14, font: "bebas" }), pos(center().x + 1.5, center().y + 226.5), anchor("center"), color(10, 10, 10), opacity(0.6), fixed(), z(200)]);
            const exitTip = add([text("PRESS [E] TO RESUME MATCH", { size: 14, font: "bebas" }), pos(center().x, center().y + 225), anchor("center"), color(190, 215, 235), outline(1, rgb(15, 18, 20)), fixed(), z(201)]);
            shopUIComponents.push(exitTip);
        } else {
            shopUIComponents.forEach(comp => comp.destroy()); shopUIComponents = [];
        }
    });

    // ==========================================
    // 8. COLLISIONS & LOGIC ENGINE
    // ==========================================
    onCollide("bullet", "enemy", (b, e) => {
        if (e.hp > 1) {
            e.hp--;
            spawnParticles(e.pos, rgb(255, 155, 50));
            if (b.pierceHp && b.pierceHp > 1) {
                b.pierceHp--;
            } else {
                destroy(b);
            }
            return;
        }
        dropEnemyLoot(e.pos, e.bugType);
        destroy(e);
        destroy(b);
        spawnParticles(e.pos, rgb(255, 155, 50));
    });

    onCollide("player", "goldenball", (p, cr) => {
        destroy(cr);
        goldenBallsCollected++;
        let requiredBalls = 3 + currentPhase * 2;

        if (currentPhase < 10) {
            if (goldenBallsCollected >= requiredBalls) {
                currentPhase++;
                goldenBallsCollected = 0;
                advancePhase();
            }
            crystalLabel.text = `${goldenBallsCollected} / ${3 + currentPhase * 2}`;
        } else {
            if (goldenBallsCollected >= requiredBalls) {
                go("win", score);
            }
            crystalLabel.text = `WINNER`;
        }
    });

    onCollide("player", "foulZone", (p, t) => {
        if (shieldActive) { shieldActive = false; shieldCooldown = 30; destroy(t); spawnParticles(p.pos, rgb(255, 255, 255)); return; }
        destroy(player); go("lose", score, currentPhase);
    });

    onCollide("player", "coin", (p, c) => { destroy(c); score += 1; scoreLabel.text = score; });

    onCollide("player", "enemy", (p, e) => {
        if (shieldActive) { shieldActive = false; shieldCooldown = 30; destroy(e); spawnParticles(p.pos, rgb(255, 255, 255)); return; }
        destroy(p); go("lose", score, currentPhase);
    });
});

// ==========================================
// 9. GAME OVER GAME STATE
// ==========================================
scene("lose", (finalScore, finalPhase) => {
    add([text("ELIMINATED!", { size: 54, font: "bebas" }), pos(center().x + 3, center().y - 82), anchor("center"), color(10, 10, 10), opacity(0.55)]);
    add([text("ELIMINATED!", { size: 54, font: "bebas" }), pos(center().x, center().y - 85), anchor("center"), color(255, 65, 65), outline(3, rgb(25, 10, 10))]);
    add([text("MATCH EARNINGS: $" + finalScore, { size: 32, font: "bebas" }), pos(center().x + 2, center().y - 13), anchor("center"), color(10, 10, 10), opacity(0.55)]);
    add([text("MATCH EARNINGS: $" + finalScore, { size: 32, font: "bebas" }), pos(center().x, center().y - 15), anchor("center"), color(240, 240, 240), outline(1, rgb(10, 10, 10))]);

    let rankMsg = "RANK: SUNDAY LEAGUE";
    if (finalPhase >= 4) rankMsg = "RANK: ACADEMY PROSPECT";
    if (finalPhase >= 7) rankMsg = "RANK: FIRST TEAM STARTER";
    if (finalPhase >= 10) rankMsg = "RANK: WORLD CLASS LEGEND";

    add([text(rankMsg, { size: 28, font: "bebas" }), pos(center().x + 2, center().y + 37), anchor("center"), color(10, 10, 10), opacity(0.55)]);
    add([text(rankMsg, { size: 28, font: "bebas" }), pos(center().x, center().y + 35), anchor("center"), color(255, 215, 0), outline(2, rgb(15, 10, 0))]);
    add([text("TAP TO KICK OFF AGAIN", { size: 18, font: "bebas" }), pos(center().x + 2, center().y + 107), anchor("center"), color(10, 10, 10), opacity(0.55)]);
    add([text("TAP TO KICK OFF AGAIN", { size: 18, font: "bebas" }), pos(center().x, center().y + 105), anchor("center"), color(190, 205, 215), outline(1, rgb(10, 10, 10))]);
    onMousePress(() => go("menu"));
});

scene("win", (finalScore) => {
    add([text("WORLD CUP CHAMPIONS!", { size: 54, font: "bebas" }), pos(center().x + 3, center().y + 3), anchor("center"), color(10, 10, 10), opacity(0.55)]);
    add([text("WORLD CUP CHAMPIONS!", { size: 54, font: "bebas" }), pos(center()), anchor("center"), color(255, 215, 0), outline(3, rgb(20, 15, 5))]);
    add([text("FINAL SCORE: $" + finalScore, { size: 32, font: "bebas" }), pos(center().x + 2, center().y + 62), anchor("center"), color(10, 10, 10), opacity(0.55)]);
    add([text("FINAL SCORE: $" + finalScore, { size: 32, font: "bebas" }), pos(center().x, center().y + 60), anchor("center"), color(255, 255, 255), outline(1, rgb(10, 10, 10))]);

    add([text("PRESS ANY KEY TO RESTART", { size: 18, font: "bebas" }), pos(center().x + 2, center().y + 122), anchor("center"), color(10, 10, 10), opacity(0.55)]);
    add([text("PRESS ANY KEY TO RESTART", { size: 18, font: "bebas" }), pos(center().x, center().y + 120), anchor("center"), color(220, 230, 240), outline(1, rgb(12, 12, 12))]);
    onKeyPress(() => go("menu"));
});

go("loading");