import { json, requireAdmin, readPosts, readJSON, updateJSON, cleanInput, commentsKey, HttpError, POSTS_KEY } from "../../_lib.js";

// GET /api/posts/:id — one full post
export async function onRequestGet({ env, params }) {
    const post = (await readPosts(env)).find((p) => p.id === params.id);
    if (!post) throw new HttpError(404, "Post not found");
    return json(post);
}

// PUT /api/posts/:id — edit a post (you only)
export async function onRequestPut({ request, env, params }) {
    await requireAdmin(request, env);
    const input = cleanInput(await request.json().catch(() => null));
    const post = await updateJSON(env, POSTS_KEY, [], (posts) => {
        const post = posts.find((p) => p.id === params.id);
        if (!post) throw new HttpError(404, "Post not found");
        Object.assign(post, input, { updated: new Date().toISOString() });
        return post;
    });
    return json(post);
}

// DELETE /api/posts/:id — delete a post and its comments (you only)
export async function onRequestDelete({ request, env, params }) {
    await requireAdmin(request, env);
    await updateJSON(env, POSTS_KEY, [], (posts) => {
        const i = posts.findIndex((p) => p.id === params.id);
        if (i === -1) throw new HttpError(404, "Post not found");
        posts.splice(i, 1);
    });
    await env.BUCKET.delete(commentsKey(params.id));
    // take it out of any series it was in
    const series = await readJSON(env, "collections.json", []);
    if (series.some((s) => s.postIds.includes(params.id))) {
        await updateJSON(env, "collections.json", [], (all) => {
            all.forEach((s) => { s.postIds = s.postIds.filter((id) => id !== params.id); });
        });
    }
    return json({ ok: true });
}
