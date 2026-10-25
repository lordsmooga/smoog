import { json, isAdmin } from "../_lib.js";

const TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/heic": "heic",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
};

// POST /api/upload — the request body IS the file. Saves it to R2
// and hands back its name so the editor can drop it into the post.
export async function onRequestPost({ request, env }) {
    if (!(await isAdmin(request, env))) return json({ error: "Not allowed" }, 401);

    const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const ext = TYPES[type];
    if (!ext) {
        return json({ error: `Can't upload ${type || "that file type"} — photos (jpg/png/gif/webp) and videos (mp4/mov/webm) only.` }, 415);
    }

    const key = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    await env.BUCKET.put("media/" + key, request.body, { httpMetadata: { contentType: type } });
    return json({ key, kind: type.startsWith("video/") ? "video" : "photo" }, 201);
}
