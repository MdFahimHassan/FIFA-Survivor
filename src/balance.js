// Every number in this file is a design/balance knob, not game logic. Pulled out of
// main.js so tuning difficulty, upgrade costs, or ability cooldowns doesn't require
// hunting through gameplay code - change a number here, nothing else needs to move.
export const BALANCE = {
    // Starting difficulty curve
    startingEnemySpeed: 110,
    startingSpawnRate: 0.65,       // seconds between spawns
    enemySpeedIncreasePerPhase: 22,
    spawnRateDecayPerPhase: 0.80,  // multiplier - spawns get more frequent each phase

    // Player baseline stats
    startingPlayerSpeed: 180,
    startingFireRate: 0.6,         // seconds between shots
    startingMagnetRadius: 35,

    // Upgrade cost curves (cost scales with current level)
    fireRateCostPerLevel: 10,
    fireRateGainPerLevel: 0.07,
    fireRateFloor: 0.15,
    speedCostPerLevel: 10,
    speedGainPerLevel: 25,
    magnetCostPerLevel: 5,
    magnetGainPerLevel: 22,

    // One-time tactic costs
    shotgunCost: 40,
    shieldCost: 60,
    piercingCost: 75,

    // Abilities
    dashCooldownMax: 20,
    dashSpeedMultiplier: 3.5,
    dashDuration: 0.35,
    bulletSpeed: 400,
    bicycleCooldownMax: 15,
    bicycleAoeRadius: 160,

    // Kill-streak (cosmetic - see spawnTieredKillImpact / registerKill)
    comboWindowSeconds: 1.6
};
