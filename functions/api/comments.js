import {
    json, isAdmin, requireAdmin, readJSON, updateJSON, readPosts,
    cleanText, newId, commentsKey, HttpError, OWNER_NAME,
} from "../_lib.js";

// Each post's comments live in their own file: comments/<post id>.json
// The guestbook works exactly the same way, stored in guestbook.json.
// Anyone can comment. Only you can reply or delete.

// Post comments have params.id; the guestbook doesn't.
const fileFor = (params) => (params.id ? commentsKey(params.id) : "guestbook.json");

function findComment(comments, cid) {
    const c = comments.find((c) => c.id === cid);
    if (!c) throw new HttpError(404, "Comment not found");
    return c;
}

// GET /api/posts/:id/comments  (or /api/guestbook)
export async function list({ env, params }) {
    return json(await readJSON(env, fileFor(params), []));
}

// POST /api/posts/:id/comments — { name, text }
export async function add({ request, env, params }) {
    const data = await request.json().catch(() => ({}));

    // "website" is a hidden field real people never see. Spam bots fill
    // in every box they find, so if it's filled, pretend it worked and toss it.
    if (data.website) return json({ ok: true }, 201);

    const name = cleanText(data.name, 32).replace(/\s+/g, " ");
    const text = cleanText(data.text, 2000);
    if (!name || !text) throw new HttpError(400, "Screen name and message are both required");

    const squished = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (squished === OWNER_NAME && !(await isAdmin(request, env))) {
        throw new HttpError(400, "That screen name is taken");
    }

    if (params.id) {
        const posts = await readPosts(env);
        if (!posts.some((p) => p.id === params.id)) throw new HttpError(404, "Post not found");
    }

    const comment = { id: newId(), name, text, created: new Date().toISOString(), replies: [] };
    await updateJSON(env, fileFor(params), [], (comments) => {
        if (comments.length >= 2000) throw new HttpError(429, "This page has hit its comment limit");
        comments.push(comment);
    });
    return json(comment, 201);
}

// DELETE /api/posts/:id/comments/:cid (you only)
export async function remove({ request, env, params }) {
    await requireAdmin(request, env);
    await updateJSON(env, fileFor(params), [], (comments) => {
        comments.splice(comments.indexOf(findComment(comments, params.cid)), 1);
    });
    return json({ ok: true });
}

// POST /api/posts/:id/comments/:cid/replies — { text } (you only)
export async function reply({ request, env, params }) {
    await requireAdmin(request, env);
    const data = await request.json().catch(() => ({}));
    const text = cleanText(data.text, 2000);
    if (!text) throw new HttpError(400, "Reply is empty");
    const r = { id: newId(), text, created: new Date().toISOString() };
    await updateJSON(env, fileFor(params), [], (comments) => {
        findComment(comments, params.cid).replies.push(r);
    });
    return json(r, 201);
}

// DELETE /api/posts/:id/comments/:cid/replies/:rid (you only)
export async function removeReply({ request, env, params }) {
    await requireAdmin(request, env);
    await updateJSON(env, fileFor(params), [], (comments) => {
        const c = findComment(comments, params.cid);
        const i = c.replies.findIndex((r) => r.id === params.rid);
        if (i === -1) throw new HttpError(404, "Reply not found");
        c.replies.splice(i, 1);
    });
    return json({ ok: true });
}
