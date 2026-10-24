// POST /api/start  { name, tag }  ->  { token }
// Called when a match begins. The token is signed and stamped with the SERVER's clock, so
// /api/submit can later check how long the run really lasted.
const lib = require("./_lib");

module.exports = async function handler(req, res) {
    if (!lib.guard(req, res)) return;
    try {
        const body = lib.readBody(req);
        const name = lib.cleanName(body.name);
        if (!name || !lib.isValidTag(body.tag)) return lib.send(res, 400, { error: "bad_player" });
        const token = lib.createToken({ docId: lib.buildDocId(name, body.tag) });
        lib.send(res, 200, { token });
    } catch (e) {
        console.error("start failed", e);
        lib.send(res, 500, { error: "server_error" });
    }
};