// Run with: npm test   (Node 18+, no extra dependencies, no network, no Firebase needed)
process.env.RUN_TOKEN_SECRET = "test-secret-test-secret-test-secret-1234";

const test = require("node:test");
const assert = require("node:assert/strict");
const lib = require("../api/_lib");

// ---------- Tiny in-memory stand-in for the parts of Firestore the API uses ----------
function makeFakeDb() {
    const store = new Map(); // "collection/id" -> data
    const ref = (col, id) => ({ col, id, key: `${col}/${id}` });
    const snap = (r) => {
        const data = store.get(r.key);
        return { exists: data !== undefined, data: () => data, ref: r };
    };
    const db = {
        store,
        collection: (col) => ({ doc: (id) => ref(col, id) }),
        async runTransaction(fn) {
            const writes = [];
            const tx = {
                get: async (r) => snap(r),
                getAll: async (...refs) => refs.map(snap),
                create: (r, data) => { if (store.has(r.key)) throw new Error("ALREADY_EXISTS"); writes.push(() => store.set(r.key, data)); },
                set: (r, data) => writes.push(() => store.set(r.key, data)),
                update: (r, data) => writes.push(() => store.set(r.key, { ...store.get(r.key), ...data }))
            };
            const result = await fn(tx);
            writes.forEach((w) => w());
            return result;
        }
    };
    return db;
}

let fake;
function installFakeDb() {
    fake = makeFakeDb();
    lib.getDb = () => ({ db: fake, serverTimestamp: () => ({ toMillis: () => Date.now() }) });
}

function call(handler, body, { method = "POST", headers = {} } = {}) {
    return new Promise((resolve) => {
        const res = {
            headers: {},
            setHeader(k, v) { this.headers[k] = v; },
            status(code) { this.code = code; return this; },
            json(payload) { resolve({ code: this.code, body: payload }); }
        };
        handler({ method, body, headers }, res);
    });
}

const start = require("../api/start");
const submit = require("../api/submit");
const claim = require("../api/claim");

// Mint a token as if /api/start had been called `ageSeconds` ago.
function tokenFor(name, tag, ageSeconds) {
    return lib.createToken({ docId: lib.buildDocId(name, tag), now: Date.now() - ageSeconds * 1000 });
}

// ---------- Pure helpers ----------
test("doc id format matches what firestore.rules and the client expect", () => {
    assert.equal(lib.buildDocId("Ahmed", "#01"), "player_ahmed_01");
    assert.equal(lib.buildDocId("Mr. X Y", "#123"), "player_mr_x_y_123");
    assert.equal(lib.buildDocId("!!!", "#07"), "player_player_07");
    assert.match(lib.buildDocId("a".repeat(12), "#99"), /^player_[a-z0-9_]{1,24}_[0-9]{2,3}$/);
});

test("names are sanitised like the game does", () => {
    assert.equal(lib.cleanName("  [b]Bob[/b]\n"), "bBob/b");
    assert.equal(lib.cleanName("abcdefghijklmnop"), "abcdefghijkl");
    assert.equal(lib.cleanName("[]"), null);
    assert.equal(lib.cleanName(42), null);
});

test("plausibility is tied to elapsed time", () => {
    assert.equal(lib.isPlausibleScore(100, 60), true);
    assert.equal(lib.isPlausibleScore(4900, 10), false);
    assert.equal(lib.isPlausibleScore(100, 1), false);        // under the minimum run length
    assert.equal(lib.isPlausibleScore(5001, 99999), false);   // over the hard cap
    assert.equal(lib.isPlausibleScore(10.5, 60), false);      // not a whole number
    assert.equal(lib.isPlausibleScore(-1, 60), false);
});

test("tokens: valid, tampered, expired and future-dated", () => {
    const t = tokenFor("Ahmed", "#01", 10);
    assert.equal(lib.verifyToken(t).docId, "player_ahmed_01");
    const [p, s] = t.split(".");
    assert.equal(lib.verifyToken(`${p}.${s.slice(0, -2)}xx`), null);
    const forgedPayload = Buffer.from(JSON.stringify({ n: "x", t: Date.now() - 100000, d: "player_ahmed_01" })).toString("base64url");
    assert.equal(lib.verifyToken(`${forgedPayload}.${s}`), null);
    assert.equal(lib.verifyToken(tokenFor("Ahmed", "#01", 4 * 3600)), null);
    assert.equal(lib.verifyToken(tokenFor("Ahmed", "#01", -3600)), null);
    assert.equal(lib.verifyToken("garbage"), null);
    assert.equal(lib.verifyToken(undefined), null);
});

// ---------- /api/start ----------
test("start issues a token bound to the player", async () => {
    const r = await call(start, { name: "Ahmed", tag: "#01" });
    assert.equal(r.code, 200);
    assert.equal(lib.verifyToken(r.body.token).docId, "player_ahmed_01");
});

test("start rejects bad input, wrong methods and foreign origins", async () => {
    assert.equal((await call(start, { name: "", tag: "#01" })).code, 400);
    assert.equal((await call(start, { name: "Ahmed", tag: "01" })).code, 400);
    assert.equal((await call(start, {}, { method: "GET" })).code, 405);
    const foreign = await call(start, { name: "Ahmed", tag: "#01" }, { headers: { origin: "https://evil.example", host: "game.example" } });
    assert.equal(foreign.code, 403);
    const same = await call(start, { name: "Ahmed", tag: "#01" }, { headers: { origin: "https://game.example", host: "game.example" } });
    assert.equal(same.code, 200);
});

// ---------- /api/submit ----------
test("submit saves a plausible score and writes the exact document shape", async () => {
    installFakeDb();
    const token = tokenFor("Ahmed", "#01", 60);
    const r = await call(submit, { token, name: "Ahmed", tag: "#01", score: 300 });
    assert.deepEqual(r, { code: 200, body: { status: "saved" } });
    const doc = fake.store.get("leaderboard/player_ahmed_01");
    assert.deepEqual(Object.keys(doc).sort(), ["name", "name_lowercase", "score", "tag", "timestamp"]);
    assert.equal(doc.score, 300);
    assert.equal(doc.name_lowercase, "ahmed");
});

test("submit rejects scores that are impossible for the elapsed time", async () => {
    installFakeDb();
    const token = tokenFor("Ahmed", "#01", 8);
    const r = await call(submit, { token, name: "Ahmed", tag: "#01", score: 4900 });
    assert.equal(r.code, 422);
    assert.equal(fake.store.size, 0);
});

test("submit rejects a missing, forged or mismatched token", async () => {
    installFakeDb();
    assert.equal((await call(submit, { name: "Ahmed", tag: "#01", score: 10 })).code, 401);
    assert.equal((await call(submit, { token: "a.b", name: "Ahmed", tag: "#01", score: 10 })).code, 401);
    const token = tokenFor("Ahmed", "#01", 60);
    assert.equal((await call(submit, { token, name: "Someone", tag: "#01", score: 10 })).code, 403);
    assert.equal((await call(submit, { token, name: "Ahmed", tag: "#02", score: 10 })).code, 403);
    assert.equal(fake.store.size, 0);
});

test("submit rejects non-integer and out-of-range scores", async () => {
    installFakeDb();
    const token = tokenFor("Ahmed", "#01", 600);
    assert.equal((await call(submit, { token, name: "Ahmed", tag: "#01", score: 12.5 })).code, 400);
    assert.equal((await call(submit, { token, name: "Ahmed", tag: "#01", score: "300" })).code, 400);
    assert.equal((await call(submit, { token, name: "Ahmed", tag: "#01", score: 5001 })).code, 422);
});

test("a token cannot be replayed to push a different score, but an identical resend is fine", async () => {
    installFakeDb();
    const token = tokenFor("Ahmed", "#01", 600);
    assert.equal((await call(submit, { token, name: "Ahmed", tag: "#01", score: 200 })).body.status, "saved");
    assert.equal((await call(submit, { token, name: "Ahmed", tag: "#01", score: 200 })).body.status, "unchanged");
    assert.equal((await call(submit, { token, name: "Ahmed", tag: "#01", score: 900 })).code, 409);
    assert.equal(fake.store.get("leaderboard/player_ahmed_01").score, 200);
});

test("a lower or equal score never overwrites a better one; a better one does", async () => {
    installFakeDb();
    const t1 = tokenFor("Ahmed", "#01", 600), t2 = tokenFor("Ahmed", "#01", 600), t3 = tokenFor("Ahmed", "#01", 600);
    await call(submit, { token: t1, name: "Ahmed", tag: "#01", score: 500 });
    assert.equal((await call(submit, { token: t2, name: "Ahmed", tag: "#01", score: 400 })).body.status, "unchanged");
    assert.equal(fake.store.get("leaderboard/player_ahmed_01").score, 500);
    assert.equal((await call(submit, { token: t3, name: "Ahmed", tag: "#01", score: 650 })).body.status, "saved");
    assert.equal(fake.store.get("leaderboard/player_ahmed_01").score, 650);
});

// ---------- /api/claim ----------
test("claim hands out #01, #02, ... for the same name even before anyone has played", async () => {
    installFakeDb();
    const tags = [];
    for (let i = 0; i < 3; i++) tags.push((await call(claim, { name: "Ahmed" })).body.tag);
    assert.deepEqual(tags, ["#01", "#02", "#03"]);
    assert.equal((await call(claim, { name: "Sara" })).body.tag, "#01");
});

test("claim skips tags already used on the leaderboard and reuses expired reservations", async () => {
    installFakeDb();
    fake.store.set("leaderboard/player_ahmed_01", { score: 1 });
    assert.equal((await call(claim, { name: "Ahmed" })).body.tag, "#02");
    // Age the #02 reservation past the TTL: it becomes available again.
    fake.store.set("tag_reservations/player_ahmed_02", { reservedAt: { toMillis: () => Date.now() - 3 * 3600 * 1000 } });
    assert.equal((await call(claim, { name: "Ahmed" })).body.tag, "#02");
});

test("claim treats differently-cased names as the same player slot", async () => {
    installFakeDb();
    assert.equal((await call(claim, { name: "ahmed" })).body.tag, "#01");
    assert.equal((await call(claim, { name: "AHMED" })).body.tag, "#02");
});

test("claim rejects an empty name", async () => {
    installFakeDb();
    assert.equal((await call(claim, { name: "[]" })).code, 400);
});