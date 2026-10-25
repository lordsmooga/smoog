// Entry point for the Cloudflare Worker.
// /api/... and /media/... requests run the server code in functions/.
// Everything else (index.html, styles.css, images, audio) is served as a plain file.
import { onRequest as apiMiddleware } from "./functions/api/_middleware.js";
import * as me from "./functions/api/me.js";
import * as login from "./functions/api/login.js";
import * as logout from "./functions/api/logout.js";
import * as upload from "./functions/api/upload.js";
import * as about from "./functions/api/about.js";
import * as posts from "./functions/api/posts/index.js";
import * as post from "./functions/api/posts/[id].js";
import * as media from "./functions/media/[[path]].js";
import * as quotes from "./functions/api/quotes.js";
import * as comments from "./functions/api/comments.js";
import * as hits from "./functions/api/hits.js";

// Turns a file's onRequestGet/onRequestPost/... into { GET, POST, ... }
const methods = (mod) => ({
    GET: mod.onRequestGet, POST: mod.onRequestPost, PUT: mod.onRequestPut, DELETE: mod.onRequestDelete,
});

// [ URL pattern, handlers by method, names for the (...) parts of the pattern ]
const routes = [
    [/^\/api\/me$/, methods(me)],
    [/^\/api\/login$/, methods(login)],
    [/^\/api\/logout$/, methods(logout)],
    [/^\/api\/upload$/, methods(upload)],
    [/^\/api\/about$/, methods(about)],
    [/^\/api\/quotes$/, { GET: quotes.list, POST: quotes.add }],
    [/^\/api\/quotes\/([^/]+)$/, { DELETE: quotes.remove }, ["qid"]],
    [/^\/api\/posts\/?$/, methods(posts)],
    [/^\/api\/posts\/([^/]+)$/, methods(post), ["id"]],
    [/^\/api\/posts\/([^/]+)\/comments$/, { GET: comments.list, POST: comments.add }, ["id"]],
    [/^\/api\/posts\/([^/]+)\/comments\/([^/]+)$/, { DELETE: comments.remove }, ["id", "cid"]],
    [/^\/api\/posts\/([^/]+)\/comments\/([^/]+)\/replies$/, { POST: comments.reply }, ["id", "cid"]],
    [/^\/api\/posts\/([^/]+)\/comments\/([^/]+)\/replies\/([^/]+)$/, { DELETE: comments.removeReply }, ["id", "cid", "rid"]],
    // guestbook = same comment code, no post id
    [/^\/api\/guestbook$/, { GET: comments.list, POST: comments.add }],
    [/^\/api\/guestbook\/([^/]+)$/, { DELETE: comments.remove }, ["cid"]],
    [/^\/api\/guestbook\/([^/]+)\/replies$/, { POST: comments.reply }, ["cid"]],
    [/^\/api\/guestbook\/([^/]+)\/replies\/([^/]+)$/, { DELETE: comments.removeReply }, ["cid", "rid"]],
    [/^\/api\/hits$/, methods(hits)],
];

export default {
    async fetch(request, env, ctx) {
        const { pathname } = new URL(request.url);

        if (pathname.startsWith("/media/")) {
            return media.onRequestGet({ request, env, params: { path: pathname.slice(7).split("/") } });
        }

        for (const [pattern, handlers, names = []] of routes) {
            const match = pathname.match(pattern);
            if (!match) continue;

            const handler = handlers[request.method];
            if (!handler) return new Response("Method not allowed", { status: 405 });

            const params = {};
            names.forEach((name, i) => { params[name] = decodeURIComponent(match[i + 1]); });
            const context = { request, env, params, waitUntil: (p) => ctx.waitUntil(p) };
            return apiMiddleware({ ...context, next: () => handler(context) });
        }

        if (pathname.startsWith("/api/")) return new Response("Not found", { status: 404 });
        return env.ASSETS.fetch(request);
    },
};
