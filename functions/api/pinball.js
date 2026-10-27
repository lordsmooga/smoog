import { json, readJSON, updateJSON, HttpError } from "../_lib.js";

// Pinball high scores. Keeps the best 10, shows the top 3.
const KEY = "pinball.json";

// GET /api/pinball — top 3
export async function onRequestGet({ env }) {
    return json((await readJSON(env, KEY, [])).slice(0, 3));
}

// POST /api/pinball — { initials: "ABC", score }
export async function onRequestPost({ request, env }) {
    const data = await request.json().catch(() => ({}));
    const initials = String(data.initials || "").toUpperCase();
    if (!/^[A-Z]{3}$/.test(initials)) throw new HttpError(400, "Initials must be 3 letters");
    const score = Number(data.score);
    if (!Number.isInteger(score) || score <= 0 || score > 999999999) throw new HttpError(400, "Bad score");

    const top = await updateJSON(env, KEY, [], (list) => {
        list.push({ initials, score, at: new Date().toISOString() });
        list.sort((a, b) => b.score - a.score);
        list.splice(10);
        return list.slice(0, 3);
    });
    return json(top);
}
