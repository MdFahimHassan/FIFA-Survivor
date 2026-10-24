// Shared helpers for the leaderboard API (api/start.js, api/submit.js, api/claim.js).
// Files starting with "_" are not exposed as routes by Vercel.
//
// Environment variables (set in Vercel -> Project -> Settings -> Environment Variables):
//   RUN_TOKEN_SECRET          long random string (32+ chars) used to sign run tokens
//   FIREBASE_SERVICE_ACCOUNT  the service-account JSON from Firebase Console -> Project
//                             settings -> Service accounts -> Generate new private key
//                             (paste the raw JSON, or the same JSON base64-encoded)
//
// The server keeps its own clock: a score is only accepted if it is plausible for the time
// that really passed between /api/start and /api/submit, so the browser can no longer
// claim "4900 points in 3 seconds".

const crypto = require("crypto");

// ---- Rules shared with firestore.rules and src/config.js. Keep them in sync. ----
const MAX_SCORE = 5000;                   // hard ceiling, also enforced by the client check
const MAX_SCORE_PER_SECOND = 12;          // same plausibility rate the client uses
const PLAUSIBILITY_BUFFER = 60;           // flat allowance for bursts (magnet pulls, boss loot)
const MIN_RUN_SECONDS = 3;                // shorter than this cannot be a real run
const MAX_TOKEN_AGE_MS = 3 * 60 * 60 * 1000;   // a run token is valid for 3 hours
const TAG_RESERVATION_MS = 2 * 60 * 60 * 1000; // an unused tag is held for 2 hours
const MAX_TAG_NUMBER = 999;

const NAME_MAX = 12;

function cleanName(raw) {
    if (typeof raw !== "string") return null;
    // Same sanitising as the game: no [ ] (Kaboom markup) and no control characters.
    const name = raw.replace(/[\[\]\u0000-\u001f\u007f]/g, "").trim().substring(0, NAME_MAX);
    return name.length > 0 ? name : null;
}

function slugOf(name) {
    return (name || "player").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "player";
}

function isValidTag(tag) {
    return typeof tag === "string" && /^#[0-9]{2,3}$/.test(tag);
}

function tagFromNumber(n) {
    return "#" + (n < 10 ? "0" + n : String(n));
}

// Must match buildPlayerDocId() in src/config.js and the ID check in firestore.rules.
function buildDocId(name, tag) {
    return `player_${slugOf(name)}_${tag.replace("#", "")}`;
}

function isPlausibleScore(score, elapsedSeconds) {
    if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) return false;
    if (!(elapsedSeconds >= MIN_RUN_SECONDS)) return false;
    return score <= elapsedSeconds * MAX_SCORE_PER_SECOND + PLAUSIBILITY_BUFFER;
}

// ---- Signed run tokens (stateless: payload.signature, HMAC-SHA256) ----
function b64url(buf) {
    return Buffer.from(buf).toString("base64url");
}

function getSecret() {
    const secret = process.env.RUN_TOKEN_SECRET;
    if (!secret || secret.length < 16) throw new Error("RUN_TOKEN_SECRET is missing or too short");
    return secret;
}

function sign(payloadB64) {
    return crypto.createHmac("sha256", getSecret()).update(payloadB64).digest("base64url");
}

function createToken({ docId, now = Date.now() }) {
    const payload = b64url(JSON.stringify({ n: crypto.randomBytes(12).toString("hex"), t: now, d: docId }));
    return `${payload}.${sign(payload)}`;
}

// Returns { nonce, startedAt, docId } or null when the token is forged, malformed or expired.
function verifyToken(token, now = Date.now()) {
    if (typeof token !== "string" || token.length > 600) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    const expected = sign(payload);
    const a = Buffer.from(sig), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    let data;
    try { data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { return null; }
    if (!data || typeof data.n !== "string" || typeof data.d !== "string" || !Number.isFinite(data.t)) return null;
    if (data.t > now + 5000 || now - data.t > MAX_TOKEN_AGE_MS) return null;
    return { nonce: data.n, startedAt: data.t, docId: data.d };
}

// ---- Firestore (Admin SDK, bypasses the security rules) ----
let cached = null;
function getDb() {
    if (cached) return cached;
    const { initializeApp, getApps, cert } = require("firebase-admin/app");
    const { getFirestore, FieldValue } = require("firebase-admin/firestore");
    if (!getApps().length) {
        let raw = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");
        raw = raw.trim();
        if (!raw.startsWith("{")) raw = Buffer.from(raw, "base64").toString("utf8");
        initializeApp({ credential: cert(JSON.parse(raw)) });
    }
    cached = { db: getFirestore(), serverTimestamp: () => FieldValue.serverTimestamp() };
    return cached;
}

// ---- HTTP helpers ----
function readBody(req) {
    const b = req.body;
    if (b && typeof b === "object") return b;
    if (typeof b === "string") { try { return JSON.parse(b); } catch { return {}; } }
    return {};
}

function send(res, status, body) {
    res.setHeader("Cache-Control", "no-store");
    res.status(status).json(body);
}

// Rejects non-POST requests and browser requests coming from another website.
// (Scripts outside a browser can fake headers; this only stops other sites from using
// your endpoints on their visitors' behalf. The real protection is the server-side checks.)
function guard(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        send(res, 405, { error: "method_not_allowed" });
        return false;
    }
    const origin = req.headers && req.headers.origin;
    if (origin) {
        let host = null;
        try { host = new URL(origin).host; } catch { /* malformed origin */ }
        if (host !== req.headers.host) {
            send(res, 403, { error: "bad_origin" });
            return false;
        }
    }
    return true;
}

module.exports = {
    MAX_SCORE, MAX_SCORE_PER_SECOND, PLAUSIBILITY_BUFFER, MIN_RUN_SECONDS, MAX_TOKEN_AGE_MS,
    TAG_RESERVATION_MS, MAX_TAG_NUMBER, NAME_MAX,
    cleanName, slugOf, isValidTag, tagFromNumber, buildDocId, isPlausibleScore,
    createToken, verifyToken, getDb, readBody, send, guard
};