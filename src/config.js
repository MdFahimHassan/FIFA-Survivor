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
        touchVec: { x: 0, y: 0 },

        // Promise for the signed run token requested at match start (see startRun() below).
        tokenPromise: null
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
        // Clamp + ignore NaN/garbage so a corrupted or hand-edited save can never leave the
        // game silently stuck at volume 0 / NaN with no obvious cause.
        const vol = (v) => (typeof v === "number" && Number.isFinite(v)) ? Math.min(1, Math.max(0, v)) : null;
        const mv = vol(saved.musicVolume), sv = vol(saved.sfxVolume);
        if (mv !== null) session.audio.musicVolume = mv;
        if (sv !== null) session.audio.sfxVolume = sv;
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
// (These values are public by design - they identify the project, they are not secrets.
// The browser only READS the leaderboard with them; every write goes through api/submit.js,
// and firestore.rules denies client writes. Still worth restricting the API key to your
// domain in Google Cloud Console -> APIs & Services -> Credentials.)
const firebaseConfig = {
    apiKey: "AIzaSyCyd3jbU1m_Zshl63C1NBHN_AJgLxUCQxs",
    authDomain: "fifa-survivor.firebaseapp.com",
    projectId: "fifa-survivor",
    storageBucket: "fifa-survivor.firebasestorage.app",
    messagingSenderId: "687618423281",
    appId: "1:687618423281:web:444317f725a63726986c50"
};

// Firebase is loaded as a lazily-imported ES module (modular SDK) instead of two blocking
// <script> tags in <head>. That keeps ~200KB of JS off the critical path - the game boots
// first, and the SDK is only fetched when something actually touches the leaderboard.
//
// If the import fails (CDN hiccup, venue wifi blocks gstatic, ad-blocker, offline) every
// caller below already treats a failed read/write as non-fatal and falls back, so a
// leaderboard problem can never take the whole game down.
const FIREBASE_VERSION = "10.14.1";
let fbPromise = null;
function getFirebase() {
    if (!fbPromise) {
        fbPromise = (async () => {
            const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
            const [{ initializeApp }, fs] = await Promise.all([
                import(`${base}/firebase-app.js`),
                import(`${base}/firebase-firestore.js`)
            ]);
            const app = initializeApp(firebaseConfig);
            const db = fs.getFirestore(app);
            return { fs, db, col: fs.collection(db, "leaderboard") };
        })().catch((e) => {
            console.error("Firebase failed to load - playing in offline mode (no leaderboard).", e);
            fbPromise = null; // allow a later retry
            throw e;
        });
    }
    return fbPromise;
}

// Warm the SDK up once the browser is idle (the menu is showing), so the first real
// leaderboard call - the name prompt's tag lookup - doesn't pay the download cost.
export function preloadFirebase() {
    const kick = () => { getFirebase().catch(() => { }); };
    if (typeof requestIdleCallback === "function") requestIdleCallback(kick, { timeout: 4000 });
    else setTimeout(kick, 1500);
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

// Small POST helper for the game's own API (api/*.js on Vercel). Same-origin, JSON in/out,
// hard timeout. Throws on network failure, timeout or a non-2xx response (err.status set).
async function postApi(path, body, ms = 6000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        const res = await fetch(path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(data.error || `HTTP ${res.status}`);
            err.status = res.status;
            throw err;
        }
        return data;
    } finally {
        clearTimeout(timer);
    }
}

// Unique Tag Generator Engine
//
// The server hands out the next free "#NN" for this name AND reserves it (api/claim.js), so
// two people typing the same name at the same moment can't both get "#01" any more. The
// previous version counted existing leaderboard entries, which only changes after somebody
// FINISHES a match, so a crowd of players with the same name all got the same tag.
//
// If the server can't be reached we fall back to a random tag (10-999) so the game stays
// playable; a random pick collides with another same-name player roughly 1 time in 1000.
// Asking again for the same name within a session reuses the tag instead of burning a new one.
const claimedTags = new Map(); // lowercased name -> tag
export async function generateUniqueTag(enteredName) {
    const key = enteredName.toLowerCase();
    if (claimedTags.has(key)) return claimedTags.get(key);
    let tag;
    try {
        ({ tag } = await postApi("/api/claim", { name: enteredName }, 8000));
        if (!/^#[0-9]{2,3}$/.test(tag)) throw new Error("Unexpected tag format.");
    } catch (e) {
        console.error("Tag reservation failed, using a random fallback tag.", e);
        tag = "#" + (10 + Math.floor(Math.random() * 990));
    }
    claimedTags.set(key, tag);
    return tag;
}

// Upload Score Engine
//
// SECURITY MODEL: the browser can no longer write to Firestore (firestore.rules denies every
// client write). Instead:
//   1. startRun()  - when a match begins, asks /api/start for a signed run token. The SERVER
//      stamps it with its own clock.
//   2. saveScoreToLeaderboard() - when the match ends, sends the token + score to /api/submit.
//      The server checks the signature, that the token belongs to this player, that the score
//      is plausible for the time that REALLY passed, and that the token was not used before,
//      then writes with the Admin SDK.
// A cheater can no longer post an arbitrary number; the best they can do is play for real
// time at the maximum plausible rate (see MAX_SCORE_PER_SECOND in api/_lib.js).
// Keep the plausibility numbers below in sync with api/_lib.js.
const MAX_PLAUSIBLE_SCORE_PER_SECOND = 12;
const PLAUSIBILITY_BUFFER = 60; // flat allowance for bursts (magnet pulls, boss loot drops, etc.)

export function isPlausibleScore(score, elapsedSeconds) {
    const numericScore = Number(score);
    const numericElapsed = Math.max(1, Number(elapsedSeconds) || 1);
    if (!Number.isFinite(numericScore) || numericScore < 0) return false;
    const cap = numericElapsed * MAX_PLAUSIBLE_SCORE_PER_SECOND + PLAUSIBILITY_BUFFER;
    return numericScore <= cap;
}

// Call once at the start of every match. The request runs in the background; the result is
// awaited when the score is submitted.
export function startRun() {
    const { name, tag } = session.player;
    session.run.tokenPromise = postApi("/api/start", { name, tag })
        .then((data) => (typeof data.token === "string" ? data.token : null))
        .catch((e) => {
            console.error("Could not start a verified run; this score will not be uploaded.", e);
            return null;
        });
}

// One leaderboard document per player identity (name + assigned tag), instead of a new
// row every single match. Retries re-write the SAME doc, and only when the new score beats
// the old one (the server enforces that).
// NOTE: api/_lib.js buildDocId() and firestore.rules must keep this exact format.
// Resolves to one of:
//   "saved"     a new personal best was written
//   "unchanged" the player already has an equal or better score
//   "rejected"  the server judged the score implausible
//   "failed"    the score could not be uploaded (offline, API down, no token)
export async function saveScoreToLeaderboard(finalScore, elapsedSeconds = 0) {
    const score = Math.floor(Number(finalScore));
    if (!(elapsedSeconds > 0) || !isPlausibleScore(score, elapsedSeconds)) {
        console.warn("Score rejected locally as implausible for match duration; not uploaded.", { finalScore, elapsedSeconds });
        return "rejected";
    }
    try {
        const token = await withTimeout(session.run.tokenPromise || Promise.resolve(null), 6000);
        if (!token) return "failed";
        const data = await postApi("/api/submit", {
            token,
            name: session.player.name,
            tag: session.player.tag,
            score
        }, 10000);
        return data.status === "saved" ? "saved" : "unchanged";
    } catch (e) {
        console.error("Failed to upload match record.", e);
        return (e.status === 422 || e.status === 409) ? "rejected" : "failed";
    }
}

// Pull Player Standing
//
// Uses "competition ranking" (aka "1224" ranking): a player's rank is 1 + the number of
// entries strictly ahead of their score, so a tie is shared - e.g. 5 players tied on the
// same score all sit at rank #7 together (because 6 entries beat them), and whoever's next
// drops straight to #12, not #8.
//
// Uses server-side COUNT queries (3 tiny reads) instead of downloading every document on
// the board, so it stays fast and cheap however many entries exist.
export async function getPlayerStanding(finalScore) {
    try {
        const { fs, col } = await withTimeout(getFirebase(), 8000);
        const numericScore = Number(finalScore);
        const [ahead, tied, total] = await withTimeout(Promise.all([
            fs.getCountFromServer(fs.query(col, fs.where("score", ">", numericScore))),
            fs.getCountFromServer(fs.query(col, fs.where("score", "==", numericScore))),
            fs.getCountFromServer(col)
        ]));
        return {
            rank: ahead.data().count + 1,
            tieCount: tied.data().count,
            totalPlayers: total.data().count
        };
    } catch (e) {
        console.error("Failed to compute player standing.", e);
        return null;
    }
}

// Pull Live Standings
// Returns the Top 5 as an array (possibly empty if nobody has played yet), or null when the
// leaderboard can't be reached. It no longer invents sample scores when offline: callers
// show an honest "leaderboard offline" message instead of fake players.
export async function getGlobalTopFive() {
    try {
        const { fs, col } = await withTimeout(getFirebase(), 8000);
        const snapshot = await withTimeout(fs.getDocs(fs.query(col, fs.orderBy("score", "desc"), fs.limit(5))));
        const list = [];
        snapshot.forEach(doc => list.push(doc.data()));
        return list;
    } catch (e) {
        console.error("Failed to load the global Top 5.", e);
        return null;
    }
}