import { json, readJSON, updateJSON } from "../_lib.js";

// The odometer. The page only adds 1 the first time a browser visits
// (it remembers it counted you), and bots that don't run JavaScript
// never count at all.
const KEY = "hits.json";

// GET /api/hits
export async function onRequestGet({ env }) {
    const { count } = await readJSON(env, KEY, { count: 0 });
    return json({ count });
}

// POST /api/hits — count a new visitor
export async function onRequestPost({ env }) {
    const count = await updateJSON(env, KEY, { count: 0 }, (data) => ++data.count);
    return json({ count });
}
