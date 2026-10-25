import { json, isAdmin, readPosts, writePosts, cleanInput } from "../../_lib.js";

// GET /api/posts/:id — one full post
export async function onRequestGet({ env, params }) {
    const post = (await readPosts(env)).find((p) => p.id === params.id);
    return post ? json(post) : json({ error: "Post not found" }, 404);
}

// PUT /api/posts/:id — edit a post (you only)
export async function onRequestPut({ request, env, params }) {
    if (!(await isAdmin(request, env))) return json({ error: "Not allowed" }, 401);
    const input = cleanInput(await request.json().catch(() => null));
    if (input.error) return json({ error: input.error }, 400);

    const posts = await readPosts(env);
    const post = posts.find((p) => p.id === params.id);
    if (!post) return json({ error: "Post not found" }, 404);
    post.title = input.title;
    post.body = input.body;
    post.updated = new Date().toISOString();
    await writePosts(env, posts);
    return json(post);
}

// DELETE /api/posts/:id — delete a post (you only)
export async function onRequestDelete({ request, env, params }) {
    if (!(await isAdmin(request, env))) return json({ error: "Not allowed" }, 401);
    const posts = await readPosts(env);
    const remaining = posts.filter((p) => p.id !== params.id);
    if (remaining.length === posts.length) return json({ error: "Post not found" }, 404);
    await writePosts(env, remaining);
    return json({ ok: true });
}
