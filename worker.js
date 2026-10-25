// Entry point for the Cloudflare Worker.
// /api/... and /media/... requests run the server code in functions/.
// Everything else (index.html, styles.css, audio, ...) is served as a plain file.
import { onRequest as apiMiddleware } from "./functions/api/_middleware.js";
import * as me from "./functions/api/me.js";
import * as login from "./functions/api/login.js";
import * as logout from "./functions/api/logout.js";
import * as upload from "./functions/api/upload.js";
import * as posts from "./functions/api/posts/index.js";
import * as post from "./functions/api/posts/[id].js";
import * as media from "./functions/media/[[path]].js";

const routes = [
    [/^\/api\/me$/, me],
    [/^\/api\/login$/, login],
    [/^\/api\/logout$/, logout],
    [/^\/api\/upload$/, upload],
    [/^\/api\/posts\/?$/, posts],
    [/^\/api\/posts\/([^/]+)$/, post, (m) => ({ id: decodeURIComponent(m[1]) })],
    [/^\/media\/(.+)$/, media, (m) => ({ path: m[1].split("/") })],
];

const METHODS = { GET: "onRequestGet", POST: "onRequestPost", PUT: "onRequestPut", DELETE: "onRequestDelete" };

export default {
    async fetch(request, env, ctx) {
        const { pathname } = new URL(request.url);

        for (const [pattern, mod, getParams] of routes) {
            const match = pathname.match(pattern);
            if (!match) continue;

            const handler = mod[METHODS[request.method]];
            if (!handler) return new Response("Method not allowed", { status: 405 });

            const context = { request, env, params: getParams ? getParams(match) : {}, waitUntil: (p) => ctx.waitUntil(p) };
            if (pathname.startsWith("/api/")) {
                return apiMiddleware({ ...context, next: () => handler(context) });
            }
            return handler(context);
        }

        return env.ASSETS.fetch(request);
    },
};
