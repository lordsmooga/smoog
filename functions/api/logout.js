import { json, COOKIE } from "../_lib.js";

export async function onRequestPost() {
    return json({ ok: true }, 200, {
        "set-cookie": `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
    });
}
