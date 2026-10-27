import { json, requireAdmin, readJSON, updateJSON, cleanText, newId, HttpError } from "../_lib.js";

// Image of the day. Like the quotes, the site picks today's image itself
// (script.js); the server just keeps the list. The picture files are regular
// uploads in media/ — this only stores which ones are in the rotation.
const KEY = "images.json";

// GET /api/images
export async function list({ env }) {
    return json(await readJSON(env, KEY, []));
}

// POST /api/images — { key, caption } (you only)
export async function add({ request, env }) {
    await requireAdmin(request, env);
    const data = await request.json().catch(() => ({}));
    const key = typeof data.key === "string" && /^[\w.-]+$/.test(data.key) ? data.key : "";
    if (!key) throw new HttpError(400, "Upload an image first");
    const image = { id: newId(), key, caption: cleanText(data.caption, 300), created: new Date().toISOString() };
    await updateJSON(env, KEY, [], (all) => { all.push(image); });
    return json(image, 201);
}

// PUT /api/images/:iid — change the caption (you only)
export async function update({ request, env, params }) {
    await requireAdmin(request, env);
    const data = await request.json().catch(() => ({}));
    const image = await updateJSON(env, KEY, [], (all) => {
        const img = all.find((i) => i.id === params.iid);
        if (!img) throw new HttpError(404, "Image not found");
        img.caption = cleanText(data.caption, 300);
        return img;
    });
    return json(image);
}

// DELETE /api/images/:iid — take it out of the rotation (you only)
export async function remove({ request, env, params }) {
    await requireAdmin(request, env);
    await updateJSON(env, KEY, [], (all) => {
        const i = all.findIndex((img) => img.id === params.iid);
        if (i === -1) throw new HttpError(404, "Image not found");
        all.splice(i, 1);
    });
    return json({ ok: true });
}
