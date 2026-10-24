// POST /api/claim  { name }  ->  { tag }
// Hands out the next free "#NN" tag for a name and RESERVES it, so two people who type the
// same name before either finishes a match no longer end up with the same identity.
// A tag is free when no leaderboard entry uses it and no recent reservation holds it.
// Unused reservations expire after TAG_RESERVATION_MS and the tag becomes available again.
const lib = require("./_lib");

const BATCH = 40; // candidate tags examined per transaction

module.exports = async function handler(req, res) {
    if (!lib.guard(req, res)) return;
    try {
        const body = lib.readBody(req);
        const name = lib.cleanName(body.name);
        if (!name) return lib.send(res, 400, { error: "bad_name" });

        const slug = lib.slugOf(name);
        const { db, serverTimestamp } = lib.getDb();
        const now = Date.now();

        for (let start = 1; start <= lib.MAX_TAG_NUMBER; start += BATCH) {
            const numbers = [];
            for (let n = start; n < start + BATCH && n <= lib.MAX_TAG_NUMBER; n++) numbers.push(n);

            const claimed = await db.runTransaction(async (tx) => {
                const refs = [];
                for (const n of numbers) {
                    const id = lib.buildDocId(name, lib.tagFromNumber(n));
                    refs.push(db.collection("leaderboard").doc(id), db.collection("tag_reservations").doc(id));
                }
                const snaps = await tx.getAll(...refs);
                for (let i = 0; i < numbers.length; i++) {
                    const board = snaps[i * 2], reservation = snaps[i * 2 + 1];
                    if (board.exists) continue;
                    if (reservation.exists) {
                        const at = reservation.data().reservedAt;
                        const ms = at && typeof at.toMillis === "function" ? at.toMillis() : 0;
                        if (now - ms < lib.TAG_RESERVATION_MS) continue;
                    }
                    tx.set(reservation.ref, { slug, reservedAt: serverTimestamp() });
                    return numbers[i];
                }
                return null;
            });

            if (claimed !== null) return lib.send(res, 200, { tag: lib.tagFromNumber(claimed) });
        }
        lib.send(res, 409, { error: "no_free_tag" });
    } catch (e) {
        console.error("claim failed", e);
        lib.send(res, 500, { error: "server_error" });
    }
};