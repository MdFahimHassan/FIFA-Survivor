// ==========================================
// 1. INITIALIZATION & ASSETS
// ==========================================

kaboom({ background: [15, 15, 15] });

loadSprite("coin", "sprites/coin.png");
loadSprite("golden_ball", "sprites/golden_ball.png");
loadSprite("trophy", "sprites/trophy.png");
loadSprite("ball", "sprites/ball.png"); 

const countries = [
    "algeria", "argentina", "australia", "austria", "belgium", "bosnia&herzegovina", "brazil", "cabo_verde",
    "canada", "colombia", "congo_dr", "cote_d'ivoire", "croatia", "curacao", "czechia", "ecuador", "egypt", "england",
    "france", "germany", "ghana", "haiti", "iran", "iraq", "japan", "jordan", "mexico", "morocco", "netherlands",
    "new_zealand", "norway", "panama", "paraguay", "portugal", "qatar", "saudi_arabia", "scotland", "senegal",
    "south_africa", "south_korea", "spain", "sweden", "switzerland", "tunisia", "turkey", "uruguay", "usa", "uzbekistan"
];

countries.forEach(country => {
    loadSprite(country, `sprites/${country}.png`);
});

const BULLET_SPEED = 400; 

let player;
let score = 0; let currentPhase = 1; let currentEnemySpeed = 110; let currentSpawnRate = 0.65; 
let spawnTimer = 0; let goldenBallsCollected = 0;
let upgFireRateLevel = 0; let upgSpeedLevel = 0; let upgMagnetLevel = 0;
let playerSpeed = 180; let fireRate = 0.6; let magnetRadius = 35;
let hasShotgun = false; let hasShield = false; let hasPiercing = false;
let shieldActive = false; let shieldCooldown = 0;
let isMoving = false; let stillTimer = 0;

let myTeamSprite = "argentina"; 

// ==========================================
// 2. MAIN TITLE SCREEN
// ==========================================
scene("menu", () => {
    onDraw(() => {
        const step = 40;
        for (let x = 0; x < width(); x += step) {
            drawLine({ p1: vec2(x, 0), p2: vec2(x, height()), color: rgb(30, 30, 30), width: 1 });
        }
        for (let y = 0; y < height(); y += step) {
            drawLine({ p1: vec2(0, y), p2: vec2(width(), y), color: rgb(30, 30, 30), width: 1 });
        }
    });

    add([
        text("FIFA SURVIVOR", { size: 64 }),
        pos(center().x, center().y - 60),
        anchor("center"),
        color(255, 215, 0)
    ]);

    add([
        text("CLUB FAIR EDITION", { size: 20 }),
        pos(center().x, center().y - 10),
        anchor("center"),
        color(200, 200, 200)
    ]);

    const playBtn = add([
        rect(240, 60, { radius: 12 }),
        pos(center().x, center().y + 80),
        color(0, 150, 255),
        outline(4, rgb(255, 255, 255)),
        anchor("center"),
        area()
    ]);

    add([
        text("KICK OFF", { size: 24 }),
        pos(center().x, center().y + 80),
        anchor("center"),
        color(255, 255, 255)
    ]);

    playBtn.onHover(() => { playBtn.color = rgb(0, 180, 255); setCursor("pointer"); });
    playBtn.onHoverEnd(() => { playBtn.color = rgb(0, 150, 255); setCursor("default"); });
    playBtn.onClick(() => { setCursor("default"); go("start"); });
    onKeyPress("enter", () => { setCursor("default"); go("start"); });
});

// ==========================================
// 3. TEAM SELECTION SCENE
// ==========================================
scene("start", () => {
    add([text("SELECT YOUR NATION", { size: 36 }), pos(center().x, 40), anchor("center"), color(255, 215, 0)]);

    const cols = 8; 
    const spacingX = 85;
    const spacingY = 75;
    const startX = center().x - ((cols - 1) * spacingX) / 2;
    const startY = 130;

    countries.forEach((country, index) => {
        let xPos = startX + (index % cols) * spacingX;
        let yPos = startY + Math.floor(index / cols) * spacingY;

        const btn = add([
            circle(28),
            color(35, 35, 35),
            outline(2, rgb(60, 60, 60)),
            pos(xPos, yPos),
            anchor("center"),
            area(),
            "teamBtn",
            { teamName: country }
        ]);

        btn.add([
            sprite(country),
            scale(0.75), 
            anchor("center")
        ]);

        btn.onHover(() => { 
            btn.color = rgb(55, 55, 55); 
            btn.scale = vec2(1.15); 
            setCursor("pointer"); 
        });
        btn.onHoverEnd(() => { 
            btn.color = rgb(35, 35, 35); 
            btn.scale = vec2(1.0); 
            setCursor("default"); 
        });
        btn.onClick(() => { setCursor("default"); myTeamSprite = btn.teamName; go("game"); });
    });
});

// ==========================================
// 4. GLOBAL HELPER FUNCTIONS
// ==========================================
const deg2rad = (deg) => deg * Math.PI / 180;
const rad2deg = (rad) => rad * 180 / Math.PI;

function spawnParticles(spawnPos, customColor = rgb(255, 255, 255)) {
    for (let i = 0; i < 6; i++) {
        add([
            rect(8, 8), pos(spawnPos), color(customColor), anchor("center"),
            move(rand(0, 360), rand(150, 400)), opacity(1), lifespan(0.3, { fade: 0.3 }) 
        ]);
    }
}

function getNearestEnemy() {
    const enemies = get("enemy"); 
    if (enemies.length === 0) return null;
    let nearest = null; let minDistance = Infinity;
    for (const enemy of enemies) {
        const dist = player.pos.dist(enemy.pos);
        if (dist < minDistance) { minDistance = dist; nearest = enemy; }
    }
    return nearest;
}

function spawnEnemy() {
    let type = "normal";
    if (currentPhase >= 4 && currentPhase < 7) type = choose(["normal", "normal", "winger"]); 
    else if (currentPhase >= 7) type = choose(["normal", "winger", "defender"]); 

    const cam = camPos();
    const edge = choose(["top", "bottom", "left", "right"]);
    const w = width() / 2 + 50; const h = height() / 2 + 50;
    let spawnPoint = vec2(0,0);

    if (edge === "top") spawnPoint = vec2(rand(cam.x - w, cam.x + w), cam.y - h);
    if (edge === "bottom") spawnPoint = vec2(rand(cam.x - w, cam.x + w), cam.y + h);
    if (edge === "left") spawnPoint = vec2(cam.x - w, rand(cam.y - h, cam.y + h));
    if (edge === "right") spawnPoint = vec2(cam.x + w, rand(cam.y - h, cam.y + h));

    let enemyHp = 1; let enemyScale = 0.8;
    if (type === "winger") enemyScale = 0.6; 
    else if (type === "defender") { enemyHp = 2; enemyScale = 1.1; }

    let rivalPool = countries.filter(c => c !== myTeamSprite);
    let rivalTeam = choose(rivalPool);

    // THINNER GLOW: Tighter radial tracking steps (+3px instead of +6px) with higher inner containment
    const enemy = add([
        circle(25), color(255, 0, 0), opacity(0.75), 
        pos(spawnPoint), anchor("center"), area(), "enemy", z(10),
        { bugType: type, hp: enemyHp } 
    ]);

    enemy.add([ circle(28), color(255, 0, 0), opacity(0.40), anchor("center") ]);
    enemy.add([ circle(31), color(255, 0, 0), opacity(0.18), anchor("center") ]);
    enemy.add([ sprite(rivalTeam), scale(enemyScale), anchor("center") ]);
}

function spawnBoss() {
    const cam = camPos();
    const spawnPoint = cam.add(choose([-width()/2, width()/2]), choose([-height()/2, height()/2]));
    
    // THINNER GLOW: Tightened boss tracking rings
    const boss = add([
        circle(35), color(255, 0, 0), opacity(0.70), 
        pos(spawnPoint), anchor("center"), area(), "enemy", z(10),
        { bugType: "boss", hp: 20 } 
    ]);
    
    boss.add([ circle(39), color(255, 0, 0), opacity(0.35), anchor("center") ]);
    boss.add([ circle(43), color(255, 0, 0), opacity(0.15), anchor("center") ]);
    boss.add([ sprite("trophy"), scale(1.5), anchor("center") ]);
}

function spawnCoin(dropPos) {
    // BIGGER COINS: Scaled to 1.1 so they stand out boldly against game objects and particles
    add([ sprite("coin"), pos(dropPos), scale(1.1), anchor("center"), area(), "coin", lifespan(6, { fade: 1.5 }), z(15) ]);
}

function spawnGoldenBall(dropPos) {
    // THINNER GLOW: Tightened golden aura ring tracking
    const gb = add([ 
        circle(22), color(255, 215, 0), opacity(0.55),
        pos(dropPos), anchor("center"), area(), "goldenball", lifespan(6, { fade: 1.5 }), z(15) 
    ]);
    gb.add([ circle(26), color(255, 215, 0), opacity(0.20), anchor("center") ]);
    gb.add([ sprite("golden_ball"), scale(0.8), anchor("center") ]);
}

function rollStandardLoot(dropPos) {
    const roll = rand(0, 100);
    const crystalChance = Math.max(3, 30 - (currentPhase - 1) * 3);
    const coinChance = 60; 

    if (roll < crystalChance) spawnGoldenBall(dropPos);
    else if (roll < crystalChance + coinChance) spawnCoin(dropPos);
}

// ==========================================
// 5. GAME SCENE
// ==========================================
scene("game", () => {
    score = 0; currentPhase = 1; currentEnemySpeed = 110; currentSpawnRate = 0.65; spawnTimer = 0; goldenBallsCollected = 0;
    upgFireRateLevel = 0; upgSpeedLevel = 0; upgMagnetLevel = 0; playerSpeed = 180; fireRate = 0.6; magnetRadius = 35;
    stillTimer = 0; hasShotgun = false; hasShield = false; hasPiercing = false; shieldActive = false; shieldCooldown = 0;

    onDraw(() => {
        const step = 64;
        const cam = camPos();
        const startX = Math.floor((cam.x - width()/2) / step) * step;
        const endX = Math.ceil((cam.x + width()/2) / step) * step;
        const startY = Math.floor((cam.y - height()/2) / step) * step;
        const endY = Math.ceil((cam.y + height()/2) / step) * step;

        for (let x = startX; x < endX; x += step) {
            drawLine({ p1: vec2(x, startY), p2: vec2(x, endY), color: rgb(35, 35, 35), width: 1 });
        }
        for (let y = startY; y < endY; y += step) {
            drawLine({ p1: vec2(startX, y), p2: vec2(endX, y), color: rgb(35, 35, 35), width: 1 });
        }
    });

    // THINNER GLOW: Compressed step rings for clean neon edge density on player character
    player = add([
        circle(25), color(0, 255, 255), opacity(0.75), 
        pos(0, 0), anchor("center"), area(), "player", z(50) 
    ]);

    player.add([ circle(28), color(0, 255, 255), opacity(0.40), anchor("center") ]);
    player.add([ circle(31), color(0, 255, 255), opacity(0.18), anchor("center") ]);
    player.add([ sprite(myTeamSprite), scale(0.8), anchor("center") ]);

    player.onDraw(() => {
        if (shieldActive) drawCircle({ radius: 32, color: rgb(255, 255, 255), fill: false, width: 2.5 });
    });

    const scoreLabel = add([ text("Coins: 0", { size: 24 }), pos(24, 24), fixed(), z(100) ]);
    const crystalLabel = add([ text("Golden Balls: 0 / 5", { size: 24 }), pos(24, 60), color(255, 215, 0), fixed(), z(100) ]);
    const phaseLabel = add([ text("GROUP STAGE"), pos(center()), scale(2), color(255, 255, 255), anchor("center"), fixed(), z(100) ]);

    wait(1.5, () => {
        tween(phaseLabel.pos, vec2(width() / 2, 40), 1, (p) => phaseLabel.pos = p, easings.easeOutQuad);
        tween(2, 1, 1, (s) => phaseLabel.scale = vec2(s), easings.easeOutQuad); 
    });

    // ==========================================
    // 6. CORE ENGINE LOOPS
    // ==========================================
    onUpdate(() => {
        camPos(player.pos); isMoving = false; 
        if (isKeyDown("left") || isKeyDown("a") || isKeyDown("right") || isKeyDown("d") || isKeyDown("up") || isKeyDown("w") || isKeyDown("down") || isKeyDown("s")) isMoving = true;
        stillTimer = isMoving ? 0 : stillTimer + dt();
        if (hasShield && !shieldActive) { shieldCooldown -= dt(); if (shieldCooldown <= 0) shieldActive = true; }
    });

    onKeyDown("left", () => player.move(-playerSpeed, 0)); onKeyDown("a", () => player.move(-playerSpeed, 0));
    onKeyDown("right", () => player.move(playerSpeed, 0)); onKeyDown("d", () => player.move(playerSpeed, 0));
    onKeyDown("up", () => player.move(0, -playerSpeed)); onKeyDown("w", () => player.move(0, -playerSpeed));
    onKeyDown("down", () => player.move(0, playerSpeed)); onKeyDown("s", () => player.move(0, playerSpeed));

    onUpdate(() => { spawnTimer -= dt(); if (spawnTimer <= 0) { spawnEnemy(); spawnTimer = currentSpawnRate; } });
    onUpdate(() => { ["coin", "goldenball"].forEach((tag) => { get(tag).forEach((item) => { if (player.pos.dist(item.pos) <= magnetRadius) item.move(player.pos.sub(item.pos).unit().scale(220)); }); }); });

    function advancePhase() {
        currentEnemySpeed += 22; currentSpawnRate *= 0.80;  
        let phaseText = "MATCH DAY " + currentPhase;
        if (currentPhase === 4) phaseText = "ROUND OF 16";
        if (currentPhase === 7) phaseText = "QUARTER FINALS";
        if (currentPhase === 10) phaseText = "THE WORLD CUP FINAL";

        phaseLabel.text = phaseText; phaseLabel.scale = vec2(2); phaseLabel.pos = center();
        
        wait(1.5, () => { tween(phaseLabel.pos, vec2(width() / 2, 40), 1, (p) => phaseLabel.pos = p, easings.easeOutQuad); tween(2, 1, 1, (s) => phaseLabel.scale = vec2(s), easings.easeOutQuad); });
        if (currentPhase % 5 === 0) spawnBoss();
    }

    let shootTimer = 0;
    onUpdate(() => {
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

    onUpdate("enemy", (enemy) => {
        const direction = player.pos.sub(enemy.pos).unit();
        let speedMultiplier = (stillTimer > 1.5) ? 2.5 : 1.0;
        let typeSpeed = currentEnemySpeed;

        if (enemy.bugType === "winger") typeSpeed *= 1.5; 
        else if (enemy.bugType === "defender") typeSpeed *= 0.75; 
        else if (enemy.bugType === "boss") typeSpeed *= 0.5; 

        enemy.move(direction.scale(typeSpeed * speedMultiplier));
    });

    // ==========================================
    // 7. COLLISIONS
    // ==========================================
    onCollide("bullet", "enemy", (b, e) => {
        b.pierceHp--; if (b.pierceHp <= 0) destroy(b); e.hp--; 
        spawnParticles(e.pos, rgb(255, 255, 255)); 

        if (e.hp <= 0) {
            destroy(e); 
            if (e.bugType === "boss") {
                for (let i = 0; i < 9; i++) spawnCoin(e.pos.add(rand(-40, 40), rand(-40, 40)));
                for (let i = 0; i < 4; i++) spawnGoldenBall(e.pos.add(rand(-40, 40), rand(-40, 40)));
            } else if (e.bugType === "defender") {
                add([ circle(40), pos(e.pos), color(139, 69, 19), opacity(0.3), area(), anchor("center"), z(10), lifespan(3.0, { fade: 0.8 }), "foulZone" ]);
                rollStandardLoot(e.pos);
            } else { rollStandardLoot(e.pos); }
        }
    });

    onCollide("player", "foulZone", (p, t) => {
        if (shieldActive) { shieldActive = false; shieldCooldown = 30; destroy(t); spawnParticles(p.pos, rgb(255, 255, 255)); return; }
        destroy(player); go("lose", score, currentPhase);
    });

    onCollide("player", "coin", (p, c) => { destroy(c); score += 1; scoreLabel.text = "Coins: " + score; });

    onCollide("player", "goldenball", (p, cr) => {
        destroy(cr); goldenBallsCollected++;
        let requiredBalls = currentPhase * 5;
        if (currentPhase < 10) {
            if (goldenBallsCollected >= requiredBalls) { currentPhase++; goldenBallsCollected = 0; advancePhase(); }
            crystalLabel.text = `Golden Balls: ${goldenBallsCollected} / ${currentPhase * 5}`;
        } else { crystalLabel.text = `WORLD CUP SECURED`; }
    });

    onCollide("player", "enemy", (p, e) => {
        if (shieldActive) { shieldActive = false; shieldCooldown = 30; destroy(e); spawnParticles(p.pos, rgb(255, 255, 255)); return; }
        destroy(p); go("lose", score, currentPhase); 
    });
});

scene("lose", (finalScore, finalPhase) => {
    add([text("ELIMINATED!", { size: 48 }), pos(center().x, center().y - 80), anchor("center"), color(255, 50, 50)]);
    add([text("Match Earnings: " + finalScore, { size: 32 }), pos(center().x, center().y - 10), anchor("center")]);
    
    let rankMsg = "Rank: Sunday League";
    if (finalPhase >= 4) rankMsg = "Rank: Academy Player";
    if (finalPhase >= 7) rankMsg = "Rank: First Team Starter";
    if (finalPhase >= 10) rankMsg = "Rank: WORLD CLASS LEGEND";

    add([text(rankMsg, { size: 28 }), pos(center().x, center().y + 40), anchor("center"), color(255, 215, 0)]);
    add([text("Tap to Kick Off Again", { size: 20 }), pos(center().x, center().y + 100), anchor("center"), color(255, 255, 255)]);
    onMousePress(() => go("menu"));
});

go("menu");