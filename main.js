// ==========================================
// 1. INITIALIZATION & ASSETS
// ==========================================

kaboom({
    background: [20, 20, 20], 
});

loadSprite("myPlayer", "sprites/player.png");
loadSprite("myBug", "sprites/bug.png");

const BULLET_SPEED = 400; 

// Global Gameplay Variables
let player;
let score = 0;
let currentPhase = 1;
let currentEnemySpeed = 110; 
let currentSpawnRate = 0.65; 
let spawnTimer = 0;
let crystalsCollected = 0;

// Upgrade System State Variables (Max Level 3)
let upgFireRateLevel = 0;
let upgSpeedLevel = 0;
let upgMagnetLevel = 0;

// Core Performance Variables
let playerSpeed = 180; 
let fireRate = 0.6;    
let magnetRadius = 35;

// NEW: Endgame Power Modules
let hasShotgun = false;
let hasShield = false;
let hasPiercing = false;

// Shield Mechanics Tracker
let shieldActive = false;
let shieldCooldown = 0;

// Anti-AFK Tracker Variables
let isMoving = false;
let stillTimer = 0;

// ==========================================
// 2. GLOBAL HELPER FUNCTIONS
// ==========================================

function spawnParticles(spawnPos, customColor = rgb(255, 50, 50)) {
    for (let i = 0; i < 6; i++) {
        add([
            rect(8, 8),
            pos(spawnPos),
            color(customColor), 
            anchor("center"),
            move(rand(0, 360), rand(150, 400)),
            opacity(1),
            lifespan(0.3, { fade: 0.3 }) 
        ]);
    }
}

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

function spawnEnemy() {
    let type = "normal";
    if (currentPhase >= 4 && currentPhase < 7) {
        type = choose(["normal", "normal", "runtime"]); 
    } else if (currentPhase >= 7) {
        type = choose(["normal", "runtime", "memory"]); 
    }

    const cam = camPos();
    let spawnPoint = vec2(0, 0);
    const edge = choose(["top", "bottom", "left", "right"]);
    const w = width() / 2 + 50;
    const h = height() / 2 + 50;

    if (edge === "top") spawnPoint = vec2(rand(cam.x - w, cam.x + w), cam.y - h);
    if (edge === "bottom") spawnPoint = vec2(rand(cam.x - w, cam.x + w), cam.y + h);
    if (edge === "left") spawnPoint = vec2(cam.x - w, rand(cam.y - h, cam.y + h));
    if (edge === "right") spawnPoint = vec2(cam.x + w, rand(cam.y - h, cam.y + h));

    let enemyHp = 1;
    let enemyScale = 1;
    
    if (type === "runtime") {
        enemyScale = 0.7; 
    } else if (type === "memory") {
        enemyHp = 2;       
        enemyScale = 1.35; 
    }

    add([
        sprite("myBug"),
        pos(spawnPoint),
        scale(enemyScale),
        anchor("center"),
        area(),
        "enemy",
        { bugType: type, hp: enemyHp } 
    ]);
}

function spawnBoss() {
    const cam = camPos();
    const spawnPoint = cam.add(choose([-width()/2, width()/2]), choose([-height()/2, height()/2]));
    
    add([
        sprite("myBug"),
        pos(spawnPoint),
        scale(2.6), 
        anchor("center"),
        area(),
        "enemy",
        { bugType: "boss", hp: 20 } 
    ]);
    
    add([
        text("!!! CRITICAL EXCEPTION: TLE BOSS !!!", { size: 26 }),
        pos(width() / 2, height() / 3),
        color(255, 0, 180),
        anchor("center"),
        fixed(),
        z(150),
        lifespan(2, { fade: 0.5 })
    ]);
}

function spawnCoin(dropPos) {
    add([ circle(6), pos(dropPos), color(255, 215, 0), anchor("center"), area(), "coin", lifespan(6, { fade: 1.5 }) ]);
}

function spawnCrystal(dropPos) {
    add([ rect(16, 16), rotate(45), pos(dropPos), color(255, 0, 127), anchor("center"), area(), "crystal", lifespan(6, { fade: 1.5 }) ]);
}

function rollStandardLoot(dropPos) {
    const roll = rand(0, 100);
    const crystalChance = Math.max(3, 30 - (currentPhase - 1) * 3);
    const coinChance = 60; 

    if (roll < crystalChance) spawnCrystal(dropPos);
    else if (roll < crystalChance + coinChance) spawnCoin(dropPos);
}

// ==========================================
// 3. GAME SCENES
// ==========================================

scene("start", () => {
    add([text("BUCC SURVIVOR", { size: 48 }), pos(center().x, center().y - 40), anchor("center"), color(0, 150, 255)]);
    add([text("Tap or Click to Start", { size: 24 }), pos(center().x, center().y + 40), anchor("center")]);
    onMousePress(() => go("game"));
});

scene("game", () => {
    score = 0;
    currentPhase = 1;
    currentEnemySpeed = 110; 
    currentSpawnRate = 0.65; 
    spawnTimer = 0;
    crystalsCollected = 0;
    
    upgFireRateLevel = 0;
    upgSpeedLevel = 0;
    upgMagnetLevel = 0;
    playerSpeed = 180;
    fireRate = 0.6;
    magnetRadius = 35;
    stillTimer = 0;
    
    hasShotgun = false;
    hasShield = false;
    hasPiercing = false;
    shieldActive = false;
    shieldCooldown = 0;

    player = add([
        sprite("myPlayer"),  
        pos(center()),       
        anchor("center"),    
        area(),              
        "player",
        z(50) 
    ]);

    // NEW: Draw physical shield ring if active
    player.onDraw(() => {
        if (shieldActive) {
            drawCircle({ radius: 26, color: rgb(0, 255, 255), fill: false, width: 3 });
        }
    });

    const scoreLabel = add([ text("Coins: 0", { size: 24 }), pos(24, 24), fixed(), z(100) ]);
    const crystalLabel = add([ text("Crystals: 0 / 5", { size: 24 }), pos(24, 60), color(255, 0, 127), fixed(), z(100) ]);
    const phaseLabel = add([ text("PHASE 1"), pos(center()), scale(2), color(0, 255, 150), anchor("center"), fixed(), z(100) ]);

    function minimizePhaseText() {
        tween(phaseLabel.pos, vec2(width() / 2, 40), 1, (p) => phaseLabel.pos = p, easings.easeOutQuad);
        tween(2, 1, 1, (s) => phaseLabel.scale = vec2(s), easings.easeOutQuad); 
    }
    wait(1.5, () => { minimizePhaseText(); });

    // ==========================================
    // SHOP INTERFACE SYSTEM (RIGHT SIDE)
    // ==========================================
    const SHOP_WIDTH = 260;
    let shopOpen = true; 
    let openX = width() - SHOP_WIDTH;
    let closedX = width();

    const shopContainer = add([
        rect(SHOP_WIDTH, height()), pos(openX, 0), color(30, 30, 35), outline(3, rgb(60, 60, 70)), fixed(), z(200), "shopUI"
    ]);

    add([ text("RECOMPILE MODULES", { size: 16 }), pos(openX + 20, 30), color(0, 150, 255), fixed(), z(201), "shopUI" ]);

    const standardCosts = [50, 120, 250]; // NEW: Expensive economy scaling

    function createShopItem(name, yPos, getLevel, onUpgrade) {
        const baseText = add([ text("", { size: 13 }), pos(openX + 20, yPos), fixed(), z(201), "shopUI" ]);
        const btn = add([ rect(110, 25, { radius: 4 }), pos(openX + 130, yPos - 3), color(50, 50, 60), area(), fixed(), z(201), "shopUI", "shopBtn" ]);
        const btnText = add([ text("", { size: 11 }), pos(openX + 140, yPos + 4), fixed(), z(202), "shopUI" ]);

        onUpdate(() => {
            const lv = getLevel();
            baseText.text = `${name}\nLv: ${lv}/3`;
            if (lv >= 3) {
                btnText.text = "MAXED";
                btn.color = rgb(35, 35, 40);
            } else {
                const cost = standardCosts[lv];
                btnText.text = `BUY: $${cost}`;
                btn.color = (score >= cost) ? rgb(0, 180, 100) : rgb(80, 50, 50);
            }
        });

        btn.onClick(() => {
            if (!shopOpen) return; 
            const lv = getLevel();
            if (lv < 3 && score >= standardCosts[lv]) {
                score -= standardCosts[lv];
                scoreLabel.text = "Coins: " + score;
                onUpgrade();
            }
        });
    }

    function createPowerItem(name, cost, yPos, checkOwned, onUpgrade) {
        const baseText = add([ text(name, { size: 13 }), pos(openX + 20, yPos), fixed(), z(201), "shopUI" ]);
        const btn = add([ rect(110, 25, { radius: 4 }), pos(openX + 130, yPos - 3), color(50, 50, 60), area(), fixed(), z(201), "shopUI", "shopBtn" ]);
        const btnText = add([ text("", { size: 11 }), pos(openX + 140, yPos + 4), fixed(), z(202), "shopUI" ]);

        onUpdate(() => {
            if (checkOwned()) {
                btnText.text = "EQUIPPED";
                btn.color = rgb(255, 150, 0);
            } else {
                btnText.text = `BUY: $${cost}`;
                btn.color = (score >= cost) ? rgb(180, 0, 180) : rgb(80, 50, 50);
            }
        });

        btn.onClick(() => {
            if (!shopOpen) return; 
            if (!checkOwned() && score >= cost) {
                score -= cost;
                scoreLabel.text = "Coins: " + score;
                onUpgrade();
            }
        });
    }

    // Standard Upgrades
    createShopItem("CPU Overclock\n(Fire Rate)", 70, () => upgFireRateLevel, () => {
        upgFireRateLevel++;
        fireRate = 0.6 - (upgFireRateLevel * 0.13); 
    });

    createShopItem("SSD Swap\n(Movement)", 130, () => upgSpeedLevel, () => {
        upgSpeedLevel++;
        playerSpeed = 180 + (upgSpeedLevel * 45); 
    });

    createShopItem("Data Vacuum\n(Magnet)", 190, () => upgMagnetLevel, () => {
        upgMagnetLevel++;
        magnetRadius = 35 + (upgMagnetLevel * 65); 
    });

    // NEW: Power Modules Header
    add([ text("ENDGAME POWER", { size: 16 }), pos(openX + 20, 250), color(180, 0, 255), fixed(), z(201), "shopUI" ]);

    // Endgame Upgrades
    createPowerItem("Syntax Sweeper\n(Shotgun)", 350, 290, () => hasShotgun, () => hasShotgun = true);
    createPowerItem("Try/Catch Block\n(Shield)", 500, 350, () => hasShield, () => {
        hasShield = true;
        shieldActive = true; 
    });
    createPowerItem("Pen Testing\n(Piercing)", 800, 410, () => hasPiercing, () => hasPiercing = true);

    const toggleBtn = add([ rect(35, 40, { radius: 4 }), pos(openX - 35, height() / 2), color(40, 40, 45), outline(2, rgb(60, 60, 70)), area(), fixed(), z(200) ]);
    const toggleText = add([ text(">", { size: 18 }), pos(openX - 23, height() / 2 + 10), fixed(), z(201) ]);

    toggleBtn.onClick(() => {
        shopOpen = !shopOpen;
        let targetX = shopOpen ? openX : closedX;
        toggleText.text = shopOpen ? ">" : "<";

        get("shopUI").forEach((obj) => {
            let offset = obj.pos.x - shopContainer.pos.x; 
            tween(obj.pos.x, targetX + offset, 0.4, (nx) => obj.pos.x = nx, easings.easeOutQuad);
        });
        tween(toggleBtn.pos.x, targetX - 35, 0.4, (nx) => toggleBtn.pos.x = nx, easings.easeOutQuad);
        tween(toggleText.pos.x, targetX - 23, 0.4, (nx) => toggleText.pos.x = nx, easings.easeOutQuad);
    });

    // ==========================================
    // 4. CORE ENGINE LOOPS & LOGIC
    // ==========================================

    onDraw(() => {
        const cam = camPos();
        const gw = 100; 
        const sx = Math.floor((cam.x - width()/2) / gw) * gw;
        const sy = Math.floor((cam.y - height()/2) / gw) * gw;
        for (let i = -1; i <= width()/gw + 1; i++) drawLine({ p1: vec2(sx + i*gw, cam.y - height()/2), p2: vec2(sx + i*gw, cam.y + height()/2), width: 2, color: rgb(40, 40, 40) });
        for (let j = -1; j <= height()/gw + 1; j++) drawLine({ p1: vec2(cam.x - width()/2, sy + j*gw), p2: vec2(cam.x + width()/2, sy + j*gw), width: 2, color: rgb(40, 40, 40) });
    });

    onUpdate(() => {
        camPos(player.pos);
        isMoving = false; 

        if (isMouseDown() && mousePos().x < (shopOpen ? openX : closedX) - 35) {
            player.moveTo(toWorld(mousePos()), playerSpeed);
            isMoving = true;
        }

        if (isKeyDown("left") || isKeyDown("a") || isKeyDown("right") || isKeyDown("d") || isKeyDown("up") || isKeyDown("w") || isKeyDown("down") || isKeyDown("s")) {
            isMoving = true;
        }

        stillTimer = isMoving ? 0 : stillTimer + dt();
        
        // NEW: Shield Recharge Logic
        if (hasShield && !shieldActive) {
            shieldCooldown -= dt();
            if (shieldCooldown <= 0) shieldActive = true; 
        }
    });

    onKeyDown("left", () => player.move(-playerSpeed, 0));
    onKeyDown("a", () => player.move(-playerSpeed, 0));
    onKeyDown("right", () => player.move(playerSpeed, 0));
    onKeyDown("d", () => player.move(playerSpeed, 0));
    onKeyDown("up", () => player.move(0, -playerSpeed));
    onKeyDown("w", () => player.move(0, -playerSpeed));
    onKeyDown("down", () => player.move(0, playerSpeed));
    onKeyDown("s", () => player.move(0, playerSpeed));

    onUpdate(() => {
        spawnTimer -= dt(); 
        if (spawnTimer <= 0) { spawnEnemy(); spawnTimer = currentSpawnRate; }
    });

    onUpdate(() => {
        ["coin", "crystal"].forEach((tag) => {
            get(tag).forEach((item) => {
                if (player.pos.dist(item.pos) <= magnetRadius) item.move(player.pos.sub(item.pos).unit().scale(220)); 
            });
        });
    });

    function advancePhase() {
        currentEnemySpeed += 22;   
        currentSpawnRate *= 0.80;  
        phaseLabel.text = "PHASE " + currentPhase;
        phaseLabel.scale = vec2(2); 
        phaseLabel.pos = center();
        phaseLabel.color = rgb(255, 50, 50); 
        wait(1.5, () => {
            minimizePhaseText();
            tween(phaseLabel.color, rgb(0, 255, 150), 1, (c) => phaseLabel.color = c, easings.linear);
        });
        if (currentPhase % 5 === 0) spawnBoss();
    }

    let shootTimer = 0;
    onUpdate(() => {
        shootTimer += dt();
        if (shootTimer >= fireRate) {
            shootTimer = 0;
            const nearestEnemy = getNearestEnemy();
            if (!nearestEnemy) return;

            const diff = nearestEnemy.pos.sub(player.pos);
            const baseAngle = Math.atan2(diff.y, diff.x); 
            const angleVariance = deg2rad(rand(-14, 14)); 

            // NEW: Shotgun Logic (Spawns 3 bullets if unlocked, otherwise 1)
            const spreadAngles = hasShotgun ? [-15, 0, 15] : [0]; 

            spreadAngles.forEach((spreadOffset) => {
                const finalAngle = baseAngle + angleVariance + deg2rad(spreadOffset);
                const dynamicDirection = Vec2.fromAngle(rad2deg(finalAngle));

                add([
                    circle(7),
                    pos(player.pos),
                    color(hasPiercing ? 255 : 0, 150, 255), // Piercing bullets look slightly purple/pink
                    anchor("center"),
                    area(),
                    move(dynamicDirection, BULLET_SPEED),
                    lifespan(1.8), 
                    "bullet",
                    { pierceHp: hasPiercing ? 2 : 1 } // NEW: Piercing Logic Injection
                ]);
            });
        }
    });

    onUpdate("enemy", (enemy) => {
        const direction = player.pos.sub(enemy.pos).unit();
        let speedMultiplier = (stillTimer > 1.5) ? 2.5 : 1.0;
        let typeSpeed = currentEnemySpeed;

        if (enemy.bugType === "runtime") { typeSpeed *= 1.5; enemy.color = (stillTimer > 1.5) ? rgb(255, 0, 0) : rgb(0, 150, 255); } 
        else if (enemy.bugType === "memory") { typeSpeed *= 0.75; enemy.color = (stillTimer > 1.5) ? rgb(255, 0, 0) : rgb(0, 210, 60); } 
        else if (enemy.bugType === "boss") { typeSpeed *= 0.5; enemy.color = (stillTimer > 1.5) ? rgb(255, 0, 0) : rgb(170, 0, 255); } 
        else { enemy.color = (stillTimer > 1.5) ? rgb(255, 0, 0) : rgb(255, 255, 255); }

        enemy.move(direction.scale(typeSpeed * speedMultiplier));
    });

    // ==========================================
    // 5. COLLISION DISPATCH ROUTINES
    // ==========================================
    
    onCollide("bullet", "enemy", (b, e) => {
        // NEW: Piercing logic deducts bullet HP instead of instant destruction
        b.pierceHp--;
        if (b.pierceHp <= 0) destroy(b); 
        
        e.hp--; 
        let bloodColor = rgb(255, 50, 50);
        if (e.bugType === "runtime") bloodColor = rgb(0, 150, 255);
        if (e.bugType === "memory") bloodColor = rgb(0, 210, 60);
        if (e.bugType === "boss") bloodColor = rgb(170, 0, 255);
        spawnParticles(e.pos, bloodColor); 

        if (e.hp <= 0) {
            destroy(e); 
            if (e.bugType === "boss") {
                for (let i = 0; i < 9; i++) spawnCoin(e.pos.add(rand(-40, 40), rand(-40, 40)));
                for (let i = 0; i < 4; i++) spawnCrystal(e.pos.add(rand(-40, 40), rand(-40, 40)));
            } else if (e.bugType === "memory") {
                add([ circle(40), pos(e.pos), color(0, 180, 50), opacity(0.35), area(), anchor("center"), z(10), lifespan(3.0, { fade: 0.8 }), "toxicHazard" ]);
                rollStandardLoot(e.pos);
            } else { rollStandardLoot(e.pos); }
        }
    });

    onCollide("player", "toxicHazard", (p, t) => {
        // NEW: Shield break logic
        if (shieldActive) {
            shieldActive = false;
            shieldCooldown = 30;
            destroy(t); 
            spawnParticles(p.pos, rgb(0, 255, 255)); 
            return;
        }
        destroy(player);
        go("lose", score, currentPhase);
    });

    onCollide("player", "coin", (p, c) => { destroy(c); score += 1; scoreLabel.text = "Coins: " + score; });

    onCollide("player", "crystal", (p, cr) => {
        destroy(cr); crystalsCollected++;
        let requiredCrystals = currentPhase * 5;
        if (currentPhase < 10) {
            if (crystalsCollected >= requiredCrystals) {
                currentPhase++; crystalsCollected = 0; requiredCrystals = currentPhase * 5; advancePhase();
            }
            crystalLabel.text = `Crystals: ${crystalsCollected} / ${requiredCrystals}`;
        } else { crystalLabel.text = `Crystals: MAX Tier`; }
    });

    onCollide("player", "enemy", (p, e) => {
        // NEW: Shield break logic 
        if (shieldActive) {
            shieldActive = false;
            shieldCooldown = 30;
            destroy(e); 
            spawnParticles(p.pos, rgb(0, 255, 255));
            return;
        }
        destroy(p); 
        go("lose", score, currentPhase); 
    });
});

scene("lose", (finalScore, finalPhase) => {
    add([text("SYSTEM CRASHED!", { size: 48 }), pos(center().x, center().y - 80), anchor("center"), color(255, 50, 50)]);
    add([text("Coins Saved: " + finalScore, { size: 32 }), pos(center().x, center().y - 10), anchor("center")]);
    let rankMsg = "";
    if (finalPhase < 4) rankMsg = "Rank: Freshman Coder";
    else if (finalPhase < 8) rankMsg = "Rank: Senior Dev";
    else if (finalPhase < 10) rankMsg = "Rank: Lead Architect";
    else rankMsg = "Rank: BUCC LEGEND";
    add([text(rankMsg, { size: 28 }), pos(center().x, center().y + 40), anchor("center"), color(0, 255, 150)]);
    add([text("Tap to Recompile", { size: 20 }), pos(center().x, center().y + 100), anchor("center"), color(150, 150, 150)]);
    onMousePress(() => go("game"));
});

go("start");