import { json, requireAdmin, readJSON, writeJSON } from "../_lib.js";

const KEY = "about.json";

// GET /api/about — the About page text
export async function onRequestGet({ env }) {
    return json(await readJSON(env, KEY, { body: "", updated: null }));
}

// PUT /api/about — edit the About page (you only)
export async function onRequestPut({ request, env }) {
    await requireAdmin(request, env);
    const data = await request.json().catch(() => ({}));
    const about = { body: typeof data.body === "string" ? data.body.slice(0, 200000) : "", updated: new Date().toISOString() };
    await writeJSON(env, KEY, about);
    return json(about);
}
