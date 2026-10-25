import { json, requireAdmin, readPosts, updateJSON, cleanInput, makeId, POSTS_KEY } from "../../_lib.js";

const MEDIA_LINE = /^\s*\[(photo|video):([\w.-]+)\]\s*$/;

// First photo + first bit of text, for the home page preview.
function summarize(body) {
    const lines = body.split("\n");
    const photo = lines.map((l) => l.match(MEDIA_LINE)).find((m) => m && m[1] === "photo");
    const text = lines.filter((l) => !MEDIA_LINE.test(l)).join(" ").replace(/\s+/g, " ").trim();
    const excerpt = text.length > 240 ? text.slice(0, 240).replace(/\s+\S*$/, "") + "…" : text;
    return { thumb: photo ? photo[2] : null, excerpt };
}

// GET /api/posts — list of posts, newest first, with previews (no full bodies)
export async function onRequestGet({ env }) {
    const posts = await readPosts(env);
    posts.sort((a, b) => b.created.localeCompare(a.created));
    return json(posts.map(({ body, ...rest }) => ({ ...rest, ...summarize(body) })));
}

// POST /api/posts — create a post (you only)
export async function onRequestPost({ request, env }) {
    await requireAdmin(request, env);
    const input = cleanInput(await request.json().catch(() => null));
    const now = new Date().toISOString();
    const post = { id: makeId(input.title), ...input, created: now, updated: now };
    await updateJSON(env, POSTS_KEY, [], (posts) => { posts.push(post); });
    return json(post, 201);
}
