import { json } from "../_lib.js";

// Runs before every /api/ request: catches setup mistakes and errors
// so the site shows a readable message instead of a blank page.
export async function onRequest({ env, next }) {
    if (!env.BUCKET) {
        return json({ error: "No R2 bucket bound as BUCKET — see README setup steps." }, 500);
    }
    try {
        return await next();
    } catch (err) {
        return json({ error: err.message || "Server error" }, err.status || 500);
    }
}
