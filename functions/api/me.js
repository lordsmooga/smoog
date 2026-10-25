import { json, isAdmin } from "../_lib.js";

export async function onRequestGet({ request, env }) {
    return json({ admin: await isAdmin(request, env) });
}
