import { json, requireAdmin, readJSON, updateJSON, cleanText, newId, HttpError } from "../_lib.js";

// Series: named groups of posts (like every Civic post).
// Stored in collections.json as [{ id, title, blurb, postIds, created }].
export const KEY = "collections.json";

function cleanSeries(data) {
    const title = cleanText(data?.title, 120);
    if (!title) throw new HttpError(400, "Give the series a title");
    const blurb = cleanText(data?.blurb, 1000);
    const postIds = Array.isArray(data?.postIds) ? [...new Set(data.postIds.filter((id) => typeof id === "string"))].slice(0, 1000) : [];
    return { title, blurb, postIds };
}

// GET /api/collections
export async function list({ env }) {
    return json(await readJSON(env, KEY, []));
}

// POST /api/collections — new series (you only)
export async function add({ request, env }) {
    await requireAdmin(request, env);
    const series = { id: newId(), ...cleanSeries(await request.json().catch(() => null)), created: new Date().toISOString() };
    await updateJSON(env, KEY, [], (all) => { all.push(series); });
    return json(series, 201);
}

// PUT /api/collections/:sid — rename / change which posts are in it (you only)
export async function update({ request, env, params }) {
    await requireAdmin(request, env);
    const input = cleanSeries(await request.json().catch(() => null));
    const series = await updateJSON(env, KEY, [], (all) => {
        const s = all.find((s) => s.id === params.sid);
        if (!s) throw new HttpError(404, "Series not found");
        Object.assign(s, input);
        return s;
    });
    return json(series);
}

// DELETE /api/collections/:sid — delete the series (the posts stay) (you only)
export async function remove({ request, env, params }) {
    await requireAdmin(request, env);
    await updateJSON(env, KEY, [], (all) => {
        const i = all.findIndex((s) => s.id === params.sid);
        if (i === -1) throw new HttpError(404, "Series not found");
        all.splice(i, 1);
    });
    return json({ ok: true });
}
