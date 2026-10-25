import { json, passwordMatches, adminToken, COOKIE } from "../_lib.js";

export async function onRequestPost({ request, env }) {
    if (!env.ADMIN_PASSWORD) {
        return json({ error: "ADMIN_PASSWORD isn't set — see README setup steps." }, 500);
    }
    const data = await request.json().catch(() => ({}));
    if (!(await passwordMatches(data.password, env))) {
        await new Promise((r) => setTimeout(r, 1000)); // slow down guessing
        return json({ error: "Wrong password" }, 401);
    }
    const token = await adminToken(env);
    return json({ ok: true }, 200, {
        "set-cookie": `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${60 * 60 * 24 * 90}`,
    });
}
