// POST /api/submit  { token, name, tag, score }  ->  { status }
// status: "saved" (new best written), "unchanged" (player already has an equal/better score)
// The only place that writes to the leaderboard. Firestore rules deny all browser writes.
const lib = require("./_lib");

module.exports = async function handler(req, res) {
    if (!lib.guard(req, res)) return;
    try {
        const body = lib.readBody(req);
        const name = lib.cleanName(body.name);
        const score = body.score;
        if (!name || !lib.isValidTag(body.tag) || !Number.isInteger(score)) {
            return lib.send(res, 400, { error: "bad_request" });
        }

        const run = lib.verifyToken(body.token);
        if (!run) return lib.send(res, 401, { error: "bad_token" });

        const docId = lib.buildDocId(name, body.tag);
        if (docId !== run.docId) return lib.send(res, 403, { error: "token_mismatch" });

        const elapsedSeconds = (Date.now() - run.startedAt) / 1000;
        if (!lib.isPlausibleScore(score, elapsedSeconds)) {
            console.warn("rejected implausible score", { docId, score, elapsedSeconds });
            return lib.send(res, 422, { error: "implausible_score" });
        }

        const { db, serverTimestamp } = lib.getDb();
        const runRef = db.collection("runs").doc(run.nonce);
        const boardRef = db.collection("leaderboard").doc(docId);

        const status = await db.runTransaction(async (tx) => {
            const [runSnap, boardSnap] = await Promise.all([tx.get(runRef), tx.get(boardRef)]);

            // One token = one result. Re-sending the identical result (for example when the
            // end screen is re-opened) is harmless; anything different is a replay attempt.
            if (runSnap.exists) {
                const prev = runSnap.data();
                if (prev.score === score && prev.docId === docId) return "unchanged";
                const err = new Error("token_replayed");
                err.code = "replay";
                throw err;
            }

            tx.create(runRef, { docId, score, startedAt: new Date(run.startedAt), submittedAt: serverTimestamp() });

            if (!boardSnap.exists) {
                tx.create(boardRef, { name, tag: body.tag, name_lowercase: name.toLowerCase(), score, timestamp: serverTimestamp() });
                return "saved";
            }
            const current = boardSnap.data();
            if (typeof current.score === "number" && score > current.score) {
                tx.update(boardRef, { score, timestamp: serverTimestamp() });
                return "saved";
            }
            return "unchanged";
        });

        lib.send(res, 200, { status });
    } catch (e) {
        if (e && e.code === "replay") return lib.send(res, 409, { error: "token_replayed" });
        console.error("submit failed", e);
        lib.send(res, 500, { error: "server_error" });
    }
};