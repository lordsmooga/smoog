import { json, isAdmin, readPosts, writePosts, cleanInput, makeId } from "../../_lib.js";

// GET /api/posts — list of posts, newest first (no bodies, keeps it light)
export async function onRequestGet({ env }) {
    const posts = await readPosts(env);
    posts.sort((a, b) => b.created.localeCompare(a.created));
    return json(posts.map(({ body, ...rest }) => rest));
}

// POST /api/posts — create a post (you only)
export async function onRequestPost({ request, env }) {
    if (!(await isAdmin(request, env))) return json({ error: "Not allowed" }, 401);
    const input = cleanInput(await request.json().catch(() => null));
    if (input.error) return json({ error: input.error }, 400);

    const now = new Date().toISOString();
    const post = { id: makeId(input.title), title: input.title, body: input.body, created: now, updated: now };
    const posts = await readPosts(env);
    posts.push(post);
    await writePosts(env, posts);
    return json(post, 201);
}
