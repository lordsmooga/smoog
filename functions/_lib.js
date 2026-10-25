// Shared helpers for the server code.

export const OWNER_NAME = "smoog"; // name shown on your replies to comments

export class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

export function json(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
    });
}

export function newId() {
    return Date.now().toString(36) + "-" + crypto.randomUUID().slice(0, 6);
}

// Trim, cap the length, strip invisible junk characters.
export function cleanText(value, max) {
    if (typeof value !== "string") return "";
    return value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, max);
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

export async function requireAdmin(request, env) {
    if (!(await isAdmin(request, env))) throw new HttpError(401, "Not allowed");
}

// ---------- JSON files in R2 ----------
export async function readJSON(env, key, fallback) {
    const obj = await env.BUCKET.get(key);
    return obj ? await obj.json() : fallback;
}

export async function writeJSON(env, key, data) {
    await env.BUCKET.put(key, JSON.stringify(data), { httpMetadata: { contentType: "application/json" } });
}

// Read a file, change it, save it — and if someone else saved it in
// between (two people commenting at once), start over instead of
// wiping out their change. `change` edits the data in place.
export async function updateJSON(env, key, fallback, change) {
    for (let attempt = 0; attempt < 8; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, Math.random() * 100 * attempt)); // back off a moment
        const obj = await env.BUCKET.get(key);
        const data = obj ? await obj.json() : structuredClone(fallback);
        const result = await change(data);
        const saved = await env.BUCKET.put(key, JSON.stringify(data), {
            httpMetadata: { contentType: "application/json" },
            ...(obj ? { onlyIf: { etagMatches: obj.etag } } : {}),
        });
        if (saved) return result;
    }
    throw new HttpError(503, "Busy, try again");
}

// ---------- posts (all kept in one posts.json file) ----------
export const POSTS_KEY = "posts.json";

export function readPosts(env) {
    return readJSON(env, POSTS_KEY, []);
}

export function cleanInput(data) {
    const title = cleanText(data?.title, 200);
    const body = typeof data?.body === "string" ? data.body.slice(0, 200000) : "";
    if (!title) throw new HttpError(400, "Title is required");
    return { title, body };
}

export function makeId(title) {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
    return (slug || "post") + "-" + Date.now().toString(36);
}

export function commentsKey(postId) {
    return `comments/${postId}.json`;
}
