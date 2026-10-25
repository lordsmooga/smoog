// GET /media/<file> — serves uploaded photos/videos out of R2.
// Handles "Range" requests so videos can be scrubbed (and play at all on iPhones).
export async function onRequestGet({ request, env, params }) {
    if (!env.BUCKET) return new Response("Storage not set up", { status: 500 });
    const key = "media/" + [].concat(params.path).join("/");

    let obj;
    try {
        obj = await env.BUCKET.get(key, { range: request.headers, onlyIf: request.headers });
    } catch {
        return new Response("Bad range", { status: 416 });
    }
    if (!obj) return new Response("Not found", { status: 404 });

    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set("etag", obj.httpEtag);
    headers.set("accept-ranges", "bytes");
    headers.set("cache-control", "public, max-age=31536000, immutable");

    if (!("body" in obj)) return new Response(null, { status: 304, headers });

    if (request.headers.has("range") && obj.range) {
        const size = obj.size;
        let start, length;
        if (typeof obj.range.suffix === "number") {
            length = Math.min(obj.range.suffix, size);
            start = size - length;
        } else {
            start = obj.range.offset ?? 0;
            length = obj.range.length ?? size - start;
        }
        headers.set("content-range", `bytes ${start}-${start + length - 1}/${size}`);
        headers.set("content-length", String(length));
        return new Response(obj.body, { status: 206, headers });
    }

    headers.set("content-length", String(obj.size));
    return new Response(obj.body, { headers });
}
