import { json, requireAdmin, readJSON, updateJSON, cleanText, newId, HttpError } from "../_lib.js";

// Quotes of the day. The site picks today's quote itself (see script.js),
// so the server just keeps the list.
const KEY = "quotes.json";

// GET /api/quotes — every quote, oldest first
export async function list({ env }) {
    return json(await readJSON(env, KEY, []));
}

// POST /api/quotes — add one (you only)
export async function add({ request, env }) {
    await requireAdmin(request, env);
    const data = await request.json().catch(() => ({}));
    const text = cleanText(data.text, 500);
    if (!text) throw new HttpError(400, "Quote is empty");
    const quote = { id: newId(), text, by: cleanText(data.by, 100), created: new Date().toISOString() };
    await updateJSON(env, KEY, [], (quotes) => { quotes.push(quote); });
    return json(quote, 201);
}

// DELETE /api/quotes/:qid — remove one (you only)
export async function remove({ request, env, params }) {
    await requireAdmin(request, env);
    await updateJSON(env, KEY, [], (quotes) => {
        const i = quotes.findIndex((q) => q.id === params.qid);
        if (i === -1) throw new HttpError(404, "Quote not found");
        quotes.splice(i, 1);
    });
    return json({ ok: true });
}
