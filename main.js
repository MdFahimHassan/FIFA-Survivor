// ==========================================
// 1. INITIALIZATION & ASSETS
// ==========================================

kaboom({
    background: [20, 20, 20], // Darker grey for a better contrast with the neon
});

loadSprite("myPlayer", "sprites/player.png");
loadSprite("myBug", "sprites/bug.png");

// Core Constants
const PLAYER_SPEED = 200;
const BULLET_SPEED = 400;

// Global State Variables
let player;
let score = 0;

// Phase System Variables
let currentPhase = 1;
let currentEnemySpeed = 100;
let currentSpawnRate = 1.0; 
let spawnTimer = 0;

// ==========================================
// 2. GLOBAL HELPER FUNCTIONS
// ==========================================

function spawnParticles(spawnPos) {
    for (let i = 0; i < 6; i++) {
        add([
            rect(8, 8),
            pos(spawnPos),
            color(255, 50, 50), 
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

// UPDATED: Spawns enemies just outside the CAMERA view, not the screen bounds
function spawnEnemy() {
    const cam = camPos();
    let spawnPoint = vec2(0, 0);
    const edge = choose(["top", "bottom", "left", "right"]);

    // Calculate the outer edges of the current camera view
    const w = width() / 2 + 50;
    const h = height() / 2 + 50;

    if (edge === "top") spawnPoint = vec2(rand(cam.x - w, cam.x + w), cam.y - h);
    if (edge === "bottom") spawnPoint = vec2(rand(cam.x - w, cam.x + w), cam.y + h);
    if (edge === "left") spawnPoint = vec2(cam.x - w, rand(cam.y - h, cam.y + h));
    if (edge === "right") spawnPoint = vec2(cam.x + w, rand(cam.y - h, cam.y + h));

    add([
        sprite("myBug"),
        pos(spawnPoint),
        anchor("center"),
        area(),
        "enemy" 
    ]);
}

// NEW: Spawn a coin when an enemy dies
function spawnCoin(dropPos) {
    add([
        circle(6), // A little gold coin
        pos(dropPos),
        color(255, 215, 0), // Gold color
        anchor("center"),
        area(),
        "coin",
        // Crucial: The coin lasts 6 seconds, and fades out over the last 1.5 seconds
        lifespan(6, { fade: 1.5 }) 
    ]);
}

// ==========================================
// 3. GAME SCENES
// ==========================================

// --- SCENE: START MENU ---
scene("start", () => {
    add([text("BUCC SURVIVOR", { size: 48 }), pos(center().x, center().y - 40), anchor("center"), color(0, 150, 255)]);
    add([text("Tap or Click to Start", { size: 24 }), pos(center().x, center().y + 40), anchor("center")]);
    onMousePress(() => go("game"));
});

// --- SCENE: ACTIVE GAMEPLAY ---
scene("game", () => {
    // Reset core metrics on launch
    score = 0;
    currentPhase = 1;
    currentEnemySpeed = 80; // Start slightly slower
    currentSpawnRate = 1.0; 
    spawnTimer = 0;

    // Create Player
    player = add([
        sprite("myPlayer"),  
        pos(center()),       
        anchor("center"),    
        area(),              
        "player",
        z(50) // Ensures player is drawn on top of coins
    ]);

    // UI: Coins Collected (Using fixed() to glue it to the screen while camera moves)
    const scoreLabel = add([
        text("Data Collected: 0", { size: 24 }),
        pos(24, 24),
        fixed(), 
        z(100)   
    ]);

    // UI: Current Phase
    const phaseLabel = add([
        text("Phase: 1", { size: 24 }),
        pos(24, 60),
        color(0, 255, 150),
        fixed(),
        z(100)
    ]);

    // --- INFINITE BACKGROUND GRID ---
    // This draws a cyber-grid behind the player to show camera movement
    onDraw(() => {
        const cam = camPos();
        const gw = 100; // grid size
        const sx = Math.floor((cam.x - width()/2) / gw) * gw;
        const sy = Math.floor((cam.y - height()/2) / gw) * gw;
        
        for (let i = -1; i <= width()/gw + 1; i++) {
            drawLine({ p1: vec2(sx + i*gw, cam.y - height()/2), p2: vec2(sx + i*gw, cam.y + height()/2), width: 2, color: rgb(40, 40, 40) });
        }
        for (let j = -1; j <= height()/gw + 1; j++) {
            drawLine({ p1: vec2(cam.x - width()/2, sy + j*gw), p2: vec2(cam.x + width()/2, sy + j*gw), width: 2, color: rgb(40, 40, 40) });
        }
    });

    // --- INPUT & CAMERA ---

    onUpdate(() => {
        // Camera smoothly follows the player
        camPos(player.pos);

        // Touch/Mouse Tracking (Updated to convert screen pixels to world coordinates!)
        if (isMouseDown()) {
            const worldMousePos = toWorld(mousePos());
            player.moveTo(worldMousePos, PLAYER_SPEED);
        }
    });

    // Keyboard Tracking
    onKeyDown("left", () => player.move(-PLAYER_SPEED, 0));
    onKeyDown("a", () => player.move(-PLAYER_SPEED, 0));
    onKeyDown("right", () => player.move(PLAYER_SPEED, 0));
    onKeyDown("d", () => player.move(PLAYER_SPEED, 0));
    onKeyDown("up", () => player.move(0, -PLAYER_SPEED));
    onKeyDown("w", () => player.move(0, -PLAYER_SPEED));
    onKeyDown("down", () => player.move(0, PLAYER_SPEED));
    onKeyDown("s", () => player.move(0, PLAYER_SPEED));

    // Notice: We removed the "Screen Boundary Guard" code! The map is now infinite.

    // --- GAME LOOPS ---

    // Enemy Spawner: Uses the dynamic spawn rate
    onUpdate(() => {
        spawnTimer -= dt(); // dt() is the time since the last frame
        if (spawnTimer <= 0) {
            spawnEnemy();
            spawnTimer = currentSpawnRate;
        }
    });

    // Phase Manager: Upgrades difficulty every 15 seconds
    loop(15, () => {
        if (currentPhase < 10) {
            currentPhase++;
            currentEnemySpeed += 15;   // Bugs get faster
            currentSpawnRate *= 0.85;  // Bugs spawn more frequently
            
            phaseLabel.text = "Phase: " + currentPhase;

            // Flash a warning text on the screen!
            add([
                text("PHASE " + currentPhase, { size: 50 }),
                pos(center()),
                fixed(),
                anchor("center"),
                color(255, 50, 50),
                lifespan(1.5, { fade: 0.5 }), // Fades out automatically
                z(100)
            ]);
        }
    });

    // Auto-Shooter Loop
    loop(0.5, () => {
        const nearestEnemy = getNearestEnemy();
        if (!nearestEnemy) return;

        const direction = nearestEnemy.pos.sub(player.pos).unit();

        add([
            circle(8),
            pos(player.pos),
            color(0, 150, 255),  
            anchor("center"),
            area(),
            move(direction, BULLET_SPEED),
            lifespan(2), // Destroys bullet after 2 seconds so it doesn't fly forever in infinite space
            "bullet"
        ]);
    });

    // Enemy AI: Pursue player at current phase speed
    onUpdate("enemy", (enemy) => {
        const direction = player.pos.sub(enemy.pos).unit();
        enemy.move(direction.scale(currentEnemySpeed));
    });

    // --- COLLISION LOGIC ---

    // Bullet hits Bug
    onCollide("bullet", "enemy", (b, e) => {
        destroy(b); 
        destroy(e); 
        
        spawnParticles(e.pos); 
        spawnCoin(e.pos); // Drop the coin!
    });

    // Player collects Coin
    onCollide("player", "coin", (p, c) => {
        destroy(c);
        score += 1;
        scoreLabel.text = "Data Collected: " + score;
    });

    // Bug touches Player
    onCollide("player", "enemy", (p, e) => {
        destroy(p); 
        go("lose", score, currentPhase); // Pass score and phase to Game Over
    });
});

// --- SCENE: GAME OVER ---
scene("lose", (finalScore, finalPhase) => {
    add([text("SYSTEM CRASHED!", { size: 48 }), pos(center().x, center().y - 80), anchor("center"), color(255, 50, 50)]);
    add([text("Data Collected: " + finalScore, { size: 32 }), pos(center().x, center().y - 10), anchor("center")]);
    
    // Add a cheeky message based on the phase they reached
    let rankMsg = "";
    if (finalPhase < 4) rankMsg = "Rank: Freshman Coder";
    else if (finalPhase < 8) rankMsg = "Rank: Senior Dev";
    else if (finalPhase < 10) rankMsg = "Rank: Lead Architect";
    else rankMsg = "Rank: BUCC LEGEND";

    add([text(rankMsg, { size: 28 }), pos(center().x, center().y + 40), anchor("center"), color(0, 255, 150)]);
    add([text("Tap to Recompile", { size: 20 }), pos(center().x, center().y + 100), anchor("center"), color(150, 150, 150)]);

    onMousePress(() => go("game"));
});

// ==========================================
// 4. BOOTSTRAP EXECUTOR
// ==========================================
go("start");