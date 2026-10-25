// Shared helpers for the server code. Not a route (it exports no onRequest).

export function json(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
    });
}

// ---------- login ----------
// The login cookie holds a hash of your password, so nobody can fake it
// without knowing the password. Change the password = everyone logged out.
const enc = new TextEncoder();

async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sameString(a, b) {
    const A = enc.encode(a);
    const B = enc.encode(b);
    return A.length === B.length && crypto.subtle.timingSafeEqual(A, B);
}

export const COOKIE = "smoog_admin";

export function adminToken(env) {
    return sha256("smoognet-admin:" + env.ADMIN_PASSWORD);
}

export async function passwordMatches(password, env) {
    if (!env.ADMIN_PASSWORD || typeof password !== "string") return false;
    return sameString(await sha256(password), await sha256(env.ADMIN_PASSWORD));
}

export async function isAdmin(request, env) {
    if (!env.ADMIN_PASSWORD) return false;
    const cookie = request.headers.get("cookie") || "";
    const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]+)`));
    return !!match && sameString(match[1], await adminToken(env));
}

// ---------- posts (all kept in one posts.json file in R2) ----------
const POSTS_KEY = "posts.json";

export async function readPosts(env) {
    const obj = await env.BUCKET.get(POSTS_KEY);
    return obj ? await obj.json() : [];
}

export async function writePosts(env, posts) {
    await env.BUCKET.put(POSTS_KEY, JSON.stringify(posts), {
        httpMetadata: { contentType: "application/json" },
    });
}

export function cleanInput(data) {
    const title = typeof data?.title === "string" ? data.title.trim().slice(0, 200) : "";
    const body = typeof data?.body === "string" ? data.body.slice(0, 200000) : "";
    if (!title) return { error: "Title is required" };
    return { title, body };
}

export function makeId(title) {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
    return (slug || "post") + "-" + Date.now().toString(36);
}
