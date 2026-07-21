// --- CENTRALIZED STATE ENGINE & CLOUD SERVICES ---
//
// `session` is grouped into a few clearly-owned slices rather than one flat bag of
// properties, so it's obvious at a glance what touches what:
//   player       - who's playing and their current stats (persists in spirit across runs)
//   run          - state for the match currently in progress, reset at the top of every match
//   upgrades     - what's been bought in the strategy shop this run
//   audio        - playback handles + user audio preferences
//   achievements - session-only "Match Milestones" unlock state (see src/achievements.js).
//                  Deliberately NOT persisted to localStorage/Firestore - there's no account
//                  system yet, so these are per-browser-tab only: they survive "Try Again"/
//                  "Play Again" loops (same page load = same session object) but reset the
//                  moment RESET SAVED PROFILE is pressed in Settings, same as a fresh profile.
export const session = {
    player: {
        name: "",
        tag: "#01",
        teamSprite: "argentina",
        speed: 180,
        fireRate: 0.6,
        magnetRadius: 35,
        isMoving: false,
        stillTimer: 0
    },

    run: {
        score: 0,
        // Cumulative coins collected this run - never decreases (unlike `score`, which is
        // the spendable shop balance and drops every time an upgrade is bought). This is
        // the figure that should represent the player's actual performance, so it's what
        // gets shown as the final score and submitted to the leaderboard.
        totalCoinsEarned: 0,
        phase: 1,
        enemySpeed: 110,
        spawnRate: 0.65,
        spawnTimer: 0,
        goldenBalls: 0,
        matchStartTime: 0,
        isUpgrading: false,
        bicycleCooldown: 0,

        // Mobile touch input (mutated live by mobile_controls.js, read by the main
        // scene's movement update). x/y each clamped to [-1, 1]; (0,0) means "no input".
        touchVec: { x: 0, y: 0 }
    },

    upgrades: {
        fireRateLevel: 0,
        speedLevel: 0,
        magnetLevel: 0,
        hasShotgun: false,
        hasShield: false,
        hasPiercing: false,
        shieldActive: false,
        shieldCooldown: 0
    },

    audio: {
        bgm: null,
        gameAmbience: null,
        // Persisted to localStorage, applied through the play() wrapper installed in
        // main.js (keyed off whether a given play() call is a loop or a one-shot), so no
        // individual play() call site needs to know about this.
        muted: false,
        musicVolume: 1,
        sfxVolume: 1
    },

    achievements: {
        unlocked: {} // { [achievementId]: true }
    },

    // Small pieces of session-only discovery state that achievements.js needs to check
    // across multiple scene visits (e.g. "found all 7 player eggs" - the menu scene's own
    // closure gets torn down and rebuilt every time the player leaves and returns to it,
    // so this can't just live as a local variable inside menu.js). Same lifetime/reset
    // rules as session.achievements above.
    progress: {
        eggsFound: {} // { [eggId]: true }
    }
};

// ==========================================
// LOCAL PROFILE / SETTINGS PERSISTENCE
// ==========================================
// Small, best-effort localStorage layer. Never throws into the caller - a private
// browsing tab or storage-disabled browser should degrade to "nothing is remembered",
// not crash the game.
const STORAGE_KEY = "fifaSurvivor.profile.v1";

export function loadSavedProfile() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (saved.playerName) session.player.name = saved.playerName;
        if (saved.teamSprite) session.player.teamSprite = saved.teamSprite;
        if (typeof saved.audioMuted === "boolean") session.audio.muted = saved.audioMuted;
        if (typeof saved.musicVolume === "number") session.audio.musicVolume = saved.musicVolume;
        if (typeof saved.sfxVolume === "number") session.audio.sfxVolume = saved.sfxVolume;
    } catch (e) {
        console.warn("Could not read saved profile, starting fresh.", e);
    }
}

function persist(partial) {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const current = raw ? JSON.parse(raw) : {};
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...partial }));
    } catch (e) {
        console.warn("Could not save profile - progress will not be remembered next visit.", e);
    }
}

export function savePlayerProfile() {
    persist({ playerName: session.player.name, teamSprite: session.player.teamSprite });
}

export function saveAudioSettings() {
    persist({ audioMuted: session.audio.muted, musicVolume: session.audio.musicVolume, sfxVolume: session.audio.sfxVolume });
}

// Firebase Configuration Setup
const firebaseConfig = {
    apiKey: "AIzaSyCyd3jbU1m_Zshl63C1NBHN_AJgLxUCQxs",
    authDomain: "fifa-survivor.firebaseapp.com",
    projectId: "fifa-survivor",
    storageBucket: "fifa-survivor.firebasestorage.app",
    messagingSenderId: "687618423281",
    appId: "1:687618423281:web:444317f725a63726986c50"
};

// If the Firebase scripts fail to load (CDN hiccup, blocked at a venue's wifi, ad-blocker,
// fully offline device, etc.) `firebase` may be undefined or initializeApp may throw. That
// used to be a hard crash at import time - since config.js is imported by nearly every
// scene, it would take the *entire game* down to a blank screen over a leaderboard problem.
// Guard it instead: fall back to a null collection, and every function below already treats
// a failed read/write as non-fatal (see the try/catch + fallback data in each one).
export let db = null;
export let scoresCollection = null;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    scoresCollection = db.collection("leaderboard");
} catch (e) {
    console.error("Firebase failed to initialize - playing in offline mode (no leaderboard).", e);
}

// Wraps a Firestore call with a hard timeout so a stalled/flaky connection can't leave the
// player staring at "CONNECTING TO STADIUM SERVERS..." forever - it just falls back after
// a few seconds like any other offline failure.
function withTimeout(promise, ms = 6000) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Leaderboard request timed out.")), ms))
    ]);
}

// Unique Tag Generator Engine
export async function generateUniqueTag(enteredName) {
    try {
        const snapshot = await withTimeout(scoresCollection.where("name_lowercase", "==", enteredName.toLowerCase()).get());
        let nextNum = snapshot.size + 1;
        return "#" + (nextNum < 10 ? "0" + nextNum : nextNum);
    } catch (e) {
        console.error("Database connection delayed, setting fallback tag.", e);
        return "#01";
    }
}

// Global Leaderboard Seed Benchmarks
// NOTE: uses fixed doc IDs + set(merge:true) instead of a where()-then-add() check,
// since that pattern races when multiple people load the game at the same time
// (each load sees "not found yet" and adds its own duplicate copy).
// Writing to a fixed ID makes this safe to run on every page load, from any number of clients at once.
export async function seedInitialBenchmarks() {
    const benchmarks = [
        { id: "seed_fahim_dev", name: "Fahim (Dev)", tag: "#14", name_lowercase: "fahim (dev)", score: 1233 },
        { id: "seed_raphy", name: "Raphy", tag: "#05", name_lowercase: "raphy", score: 724 },
        { id: "seed_abir", name: "Abir", tag: "#03", name_lowercase: "abir", score: 425 },
        { id: "seed_ren", name: "Ren", tag: "#07", name_lowercase: "ren", score: 250 },
        { id: "seed_sloth", name: "Sloth", tag: "#12", name_lowercase: "sloth", score: 78 }
    ];
    try {
        for (const { id, ...data } of benchmarks) {
            await withTimeout(scoresCollection.doc(id).set({
                ...data,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }));
        }
    } catch (e) {
        console.error("Cloud seeding error:", e);
    }
}

// Upload Score Engine
//
// NOTE ON CHEATING: this is a client-side plausibility check ONLY. Anyone can still open
// devtools and call this function directly with whatever numbers they want - a determined
// cheater will always get past client code. The actual fix is server-side: add Firestore
// Security Rules that validate the write (see firestore.rules in the project root, which
// you'll need to paste into the Firebase console yourself since it's a backend-only change
// no local file edit can make for you). This check just stops the most naive case (someone
// tampering with the score before the normal win/lose flow calls this) from quietly polluting
// the public leaderboard.
const MAX_PLAUSIBLE_SCORE_PER_SECOND = 12;
const PLAUSIBILITY_BUFFER = 60; // flat allowance for bursts (magnet pulls, boss loot drops, etc.)

export function isPlausibleScore(score, elapsedSeconds) {
    const numericScore = Number(score);
    const numericElapsed = Math.max(1, Number(elapsedSeconds) || 1);
    if (!Number.isFinite(numericScore) || numericScore < 0) return false;
    const cap = numericElapsed * MAX_PLAUSIBLE_SCORE_PER_SECOND + PLAUSIBILITY_BUFFER;
    return numericScore <= cap;
}

// One leaderboard document per player identity (name + assigned tag), instead of a new
// row every single match. This is what makes "Try Again" from the win/lose screen safe to
// spam without flooding the board with duplicate entries for the same person - each retry
// just re-writes the SAME doc, and only when the new score actually beats their old one.
function buildPlayerDocId(name, tag) {
    const slug = (name || "player").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "player";
    const tagNum = (tag || "#00").replace("#", "");
    return `player_${slug}_${tagNum}`;
}

export async function saveScoreToLeaderboard(finalScore, elapsedSeconds = 0) {
    if (elapsedSeconds > 0 && !isPlausibleScore(finalScore, elapsedSeconds)) {
        console.warn("Score rejected locally as implausible for match duration; not uploaded.", { finalScore, elapsedSeconds });
        return;
    }
    try {
        const docRef = scoresCollection.doc(buildPlayerDocId(session.player.name, session.player.tag));
        const existing = await withTimeout(docRef.get());
        if (existing.exists && Number(existing.data().score) >= Number(finalScore)) {
            return; // this player's existing score already beats (or ties) the new one - leave it
        }
        await withTimeout(docRef.set({
            name: session.player.name,
            tag: session.player.tag,
            name_lowercase: session.player.name.toLowerCase(),
            score: Number(finalScore),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }));
    } catch (e) {
        console.error("Failed to upload match record.", e);
    }
}

// Pull Full Standings To Compute The Player's Own Rank
//
// Uses "competition ranking" (aka "1224" ranking): a player's rank is 1 + the number of
// entries strictly ahead of their score, so a tie is shared - e.g. 5 players tied on the
// same score all sit at rank #7 together (because 6 entries beat them), and whoever's next
// drops straight to #12, not #8. Pulls the full board rather than a single count query so
// it can also report how many people share that rank.
export async function getPlayerStanding(finalScore) {
    try {
        const snapshot = await withTimeout(scoresCollection.orderBy("score", "desc").get());
        const numericScore = Number(finalScore);
        let scores = [];
        snapshot.forEach(doc => scores.push(Number(doc.data().score)));

        const rank = scores.filter(s => s > numericScore).length + 1;
        const tieCount = scores.filter(s => s === numericScore).length;
        return { rank, tieCount, totalPlayers: scores.length };
    } catch (e) {
        console.error("Failed to compute player standing.", e);
        return null;
    }
}

// Pull Live Standings
export async function getGlobalTopFive() {
    try {
        const snapshot = await withTimeout(scoresCollection.orderBy("score", "desc").limit(5).get());
        let list = [];
        snapshot.forEach(doc => list.push(doc.data()));
        return list;
    } catch (e) {
        return [
            { name: "Fahim (Dev)", tag: "#14", score: 1233 },
            { name: "Raphy", tag: "#05", score: 724 },
            { name: "Abir", tag: "#03", score: 425 },
            { name: "Ren", tag: "#07", score: 250 },
            { name: "Sloth", tag: "#12", score: 78 }
        ];
    }
}