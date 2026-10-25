// =====================================================================
//  SMOOGNET — the whole front end
// =====================================================================
const content = document.getElementById("content");
const leftnav = document.getElementById("leftnav");
const rightcol = document.getElementById("rightcol");
const layout = document.getElementById("layout");
const subbar = document.getElementById("subbar");
const signin = document.getElementById("signin");
const promo = document.getElementById("promo");
const qotdBox = document.getElementById("qotd");
const dateBox = document.getElementById("date");

const OWNER = "smoog"; // your name on comment replies (matches OWNER_NAME in functions/_lib.js)

let isAdmin = false;
let postList = []; // newest first, no full bodies
let quoteList = [];
let hitCount = null; // visitor odometer

// =====================================================================
//  HELPERS
// =====================================================================

// Build an element: el("a", { href: "#/" }, "text", otherElement, [moreStuff])
// Text always goes in as plain text, so nothing anyone types can break the page.
function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
        else if (value === true) node.setAttribute(key, "");
        else if (value !== false && value != null) node.setAttribute(key, value);
    }
    return appendAll(node, children);
}

// Skips null/false/"" so you can write: isAdmin && el(...)
function appendAll(node, children) {
    for (const child of children.flat(Infinity)) {
        if (child == null || child === false || child === "") continue;
        node.append(child instanceof Node ? child : String(child));
    }
    return node;
}

// Replace everything inside a node
function fill(node, ...children) {
    node.replaceChildren();
    return appendAll(node, children);
}

const render = (...nodes) => fill(content, ...nodes);
const enc = encodeURIComponent;
const postLink = (p) => "#/post/" + enc(p.id);

// A box with a yellow title strip, like the MSN panels
function panel(title, ...children) {
    return el("section", { class: "panel" },
        el("div", { class: "panel-head" }, title),
        el("div", { class: "panel-body" }, ...children));
}

function fmtDate(iso) {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function fmtStamp(iso) {
    return new Date(iso).toLocaleString("en-US", {
        month: "numeric", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
    }).replace(",", "");
}

// Talk to the server. Throws with the server's error message if it fails.
async function api(path, options = {}) {
    const res = await fetch(path, options);
    let data = null;
    try { data = await res.json(); } catch { }
    if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
    return data;
}

function sendJSON(method, body) {
    return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

// Wrap a click/submit handler so any error pops up instead of failing silently
const guard = (fn) => async (...args) => {
    try { await fn(...args); } catch (err) { alert(err.message); }
};

async function refreshPosts() {
    postList = await api("/api/posts");
    renderChrome();
}

async function refreshQuotes() {
    quoteList = await api("/api/quotes");
    renderQotd();
}

// =====================================================================
//  POST TEXT — plain text, blank line = new paragraph,
//  a line like [photo:abc.jpg] or [video:abc.mp4] becomes that media
// =====================================================================
const MEDIA_LINE = /^\s*\[(photo|video):([\w.-]+)\]\s*$/;

function renderBody(text) {
    const out = el("div", { class: "post-body" });
    let lines = [];

    function flush() {
        if (!lines.length) return;
        const p = el("p");
        lines.forEach((line, i) => {
            if (i > 0) p.append(el("br"));
            p.append(line);
        });
        out.append(p);
        lines = [];
    }

    for (const line of text.split("\n")) {
        const media = line.match(MEDIA_LINE);
        if (media) {
            flush();
            const src = "/media/" + media[2];
            out.append(media[1] === "photo"
                ? el("a", { href: src, target: "_blank" }, el("img", { src, loading: "lazy", alt: "" }))
                : el("video", { src, controls: true, playsinline: true, preload: "metadata" }));
        } else if (line.trim() === "") {
            flush();
        } else {
            lines.push(line);
        }
    }
    flush();
    return out;
}

function excerptOf(text, max = 200) {
    const plain = text.split("\n").filter((l) => !MEDIA_LINE.test(l)).join(" ").replace(/\s+/g, " ").trim();
    return plain.length > max ? plain.slice(0, max).replace(/\s+\S*$/, "") + "…" : plain;
}

// =====================================================================
//  DATE + QUOTE OF THE DAY
// =====================================================================

// Days since 1970 in *your* timezone, so the quote flips at local midnight
function dayNumber(d = new Date()) {
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

// Same seed = same "random" order every time, for everyone
function shuffledOrder(n, seed) {
    let s = seed >>> 0;
    const rand = () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const order = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
}

// Goes through every quote in a random order, one per day, before
// reshuffling. Everybody sees the same quote on the same day.
function quoteOfTheDay(quotes) {
    if (!quotes.length) return null;
    const day = dayNumber();
    const n = quotes.length;
    return quotes[shuffledOrder(n, Math.floor(day / n))[day % n]];
}

let shownDay = dayNumber();

function renderDate() {
    const d = new Date();
    fill(dateBox,
        el("div", { class: "weekday" }, d.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()),
        el("div", {},
            el("span", { class: "month" }, d.toLocaleDateString("en-US", { month: "long" }).toUpperCase()),
            " ",
            el("span", { class: "day" }, String(d.getDate()))));
    document.getElementById("year").textContent = d.getFullYear();
}

function renderQotd() {
    const q = quoteOfTheDay(quoteList);
    fill(qotdBox,
        isAdmin && el("a", { href: "#/quotes", class: "qedit" }, "edit"),
        q ? [el("span", {}, `“${q.text}”`), q.by && el("span", { class: "by" }, ` — ${q.by}`)]
            : el("span", { class: "muted" }, "No quote today."));
}

// If the page is left open past midnight, roll the date and quote over
setInterval(() => {
    if (dayNumber() !== shownDay) {
        shownDay = dayNumber();
        renderDate();
        renderQotd();
    }
}, 60000);

// =====================================================================
//  CHROME — the parts around the page: promo, bars, left column
// =====================================================================
function renderChrome() {
    const latest = postList[0];
    fill(promo, latest
        ? ["Check out the latest post:", el("a", { href: postLink(latest) }, latest.title)]
        : "Welcome to my website :D");

    renderQotd();

    fill(subbar, isAdmin
        ? [el("b", {}, "WEBMASTER: "),
            el("a", { href: "#/new" }, "New post"),
            el("a", { href: "#/quotes" }, "Quotes"),
            el("a", { href: "#/edit-about" }, "Edit About")]
        : "Welcome to my website :D");

    fill(signin, isAdmin
        ? el("a", { href: "#/", onclick: logout }, "sign out")
        : el("a", { href: "#/login" }, "sign in"));

    fill(leftnav, panel("Posts",
        postList.length
            ? el("ul", { class: "navlist" }, postList.slice(0, 12).map((p) =>
                el("li", {}, el("a", { href: postLink(p) }, p.title))))
            : el("p", { class: "muted" }, "Nothing yet."),
        postList.length > 12 && el("p", {}, el("a", { href: "#/posts" }, "More..."))),
        hitCount != null && panel("Visitors",
            el("div", { class: "odo" }, String(hitCount).padStart(6, "0").split("").map((d) => el("span", {}, d))),
            el("div", { class: "muted center" }, "since 2026")));
}

// =====================================================================
//  PAGES
// =====================================================================
async function showHome() {
    const [latest, ...rest] = postList;
    render(
        panel("Today on SMOOGNET", latest
            ? el("div", { class: "featured" },
                latest.thumb && el("a", { href: postLink(latest) },
                    el("img", { class: "thumb", src: "/media/" + latest.thumb, alt: "" })),
                el("h2", {}, el("a", { href: postLink(latest) }, latest.title)),
                el("div", { class: "date" }, fmtDate(latest.created)),
                latest.excerpt && el("p", {}, latest.excerpt),
                el("p", {}, el("a", { href: postLink(latest) }, "Read more »")))
            : el("p", {}, "Nothing posted yet. Check back soon!")),
        rest.length > 0 && panel("More posts",
            el("ul", { class: "navlist" }, rest.slice(0, 8).map((p) =>
                el("li", {}, el("a", { href: postLink(p) }, p.title),
                    el("span", { class: "muted" }, " — " + fmtDate(p.created))))),
            rest.length > 8 && el("p", {}, el("a", { href: "#/posts" }, "All posts »"))),
    );

    const about = await api("/api/about").catch(() => null);
    fill(rightcol, panel("Message Center",
        el("p", {}, "Welcome to my website :D"),
        el("p", {}, "Click Smooga up top. He has something to say."),
        about && about.body.trim() && el("p", {},
            el("b", {}, "About me: "), excerptOf(about.body, 160), " ",
            el("a", { href: "#/about" }, "More..."))),
        panel("Feed Smooga",
            el("div", { class: "can-box" },
                el("img", { class: "can", src: "img/sardinecan.png", alt: "Can of sardines", draggable: "false", onpointerdown: grabFish })),
            el("p", { class: "muted center" }, "Pull out a sardine and dangle it in Smooga's mouth. Or just tap the can.")));
}

function showPosts() {
    document.title = "Posts — SMOOGNET";
    const months = new Map(); // "OCTOBER 2026" -> [posts]
    for (const p of postList) {
        const m = new Date(p.created).toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase();
        if (!months.has(m)) months.set(m, []);
        months.get(m).push(p);
    }
    render(panel("All posts",
        postList.length === 0 && el("p", {}, "Nothing posted yet."),
        [...months].map(([month, posts]) => [
            el("h3", {}, month),
            el("ul", { class: "navlist" }, posts.map((p) =>
                el("li", {}, el("a", { href: postLink(p) }, p.title),
                    el("span", { class: "muted" }, " — " + fmtDate(p.created))))),
        ])));
}

async function showPost(id) {
    const post = await api("/api/posts/" + enc(id));
    const edited = fmtDate(post.updated) !== fmtDate(post.created);
    document.title = post.title + " — SMOOGNET";
    const commentsBox = el("div");
    render(
        panel(fmtDate(post.created),
            el("h2", {}, post.title),
            edited && el("div", { class: "date" }, "edited " + fmtDate(post.updated)),
            isAdmin && el("p", {}, el("a", { class: "btn", href: "#/edit/" + enc(post.id) }, "Edit")),
            renderBody(post.body)),
        commentsBox,
    );
    await loadComments(`/api/posts/${enc(post.id)}/comments`, commentsBox);
}

async function showAbout() {
    document.title = "About — SMOOGNET";
    const about = await api("/api/about");
    render(panel("About",
        isAdmin && el("p", {}, el("a", { class: "btn", href: "#/edit-about" }, "Edit")),
        about.body.trim() ? renderBody(about.body) : el("p", { class: "muted" }, "Nothing here yet.")));
}

function showLogin() {
    if (isAdmin) { location.hash = "#/"; return; }
    const pw = el("input", { type: "password", id: "pw", autocomplete: "current-password" });
    const msg = el("p", { class: "error" });
    render(panel("Webmaster sign in",
        el("form", {
            onsubmit: async (e) => {
                e.preventDefault();
                try {
                    await api("/api/login", sendJSON("POST", { password: pw.value }));
                    isAdmin = true;
                    renderChrome();
                    location.hash = "#/";
                } catch (err) {
                    msg.textContent = err.message;
                }
            },
        },
            el("label", { for: "pw" }, "Password:"),
            el("div", { class: "inline-form" }, pw, el("button", { class: "go", type: "submit" }, "go")),
            msg)));
    pw.focus();
}

async function logout(e) {
    e.preventDefault();
    await api("/api/logout", { method: "POST" }).catch(() => { });
    isAdmin = false;
    renderChrome();
    location.hash = "#/";
    route();
}

// =====================================================================
//  COMMENTS + GUESTBOOK — same code, different address:
//    post comments: /api/posts/<id>/comments     guestbook: /api/guestbook
// =====================================================================
async function loadComments(apiBase, box, opts = {}) {
    let comments = await api(apiBase);
    if (opts.newestFirst) comments = comments.slice().reverse();
    const reload = () => loadComments(apiBase, box, opts);

    const list = comments.length
        ? el("ol", { class: "comments" }, comments.map((c) => commentItem(apiBase, c, reload)))
        : el("p", { class: "muted" }, opts.empty || "No comments yet. Be the first!");
    const form = commentForm(apiBase, reload, opts.formTitle || "Leave a comment", opts.button || "Post comment");

    fill(box, panel(`${opts.title || "Comments"} (${comments.length})`,
        opts.formFirst ? [form, list] : [list, form]));
}

function commentItem(apiBase, c, reload) {
    const base = `${apiBase}/${enc(c.id)}`;
    const replyArea = el("div");

    return el("li", { class: "comment" },
        el("div", { class: "meta" }, el("b", {}, c.name), " ", el("span", { class: "stamp" }, fmtStamp(c.created))),
        el("div", { class: "text" }, c.text),
        isAdmin && el("div", { class: "admin-row" },
            el("button", { class: "btn small", onclick: () => fill(replyArea, replyForm(base, replyArea, reload)) }, "Reply"),
            el("button", {
                class: "btn small",
                onclick: guard(async () => {
                    if (!confirm(`Delete ${c.name}'s message?`)) return;
                    await api(base, { method: "DELETE" });
                    await reload();
                }),
            }, "Delete")),
        c.replies.length > 0 && el("ul", { class: "replies" }, c.replies.map((r) =>
            el("li", { class: "reply" },
                el("div", { class: "meta" },
                    el("b", {}, "★ " + OWNER), " ", el("span", { class: "tag" }, "webmaster"), " ",
                    el("span", { class: "stamp" }, fmtStamp(r.created))),
                el("div", { class: "text" }, r.text),
                isAdmin && el("div", { class: "admin-row" },
                    el("button", {
                        class: "btn small",
                        onclick: guard(async () => {
                            if (!confirm("Delete your reply?")) return;
                            await api(`${base}/replies/${enc(r.id)}`, { method: "DELETE" });
                            await reload();
                        }),
                    }, "Delete"))))),
        replyArea);
}

function replyForm(base, area, reload) {
    const text = el("textarea", { rows: 3, maxlength: 2000 });
    setTimeout(() => text.focus());
    return el("form", {
        onsubmit: guard(async (e) => {
            e.preventDefault();
            if (!text.value.trim()) return;
            await api(base + "/replies", sendJSON("POST", { text: text.value }));
            await reload();
        }),
    },
        text,
        el("p", {},
            el("button", { class: "btn small", type: "submit" }, "Post reply"),
            el("button", { class: "btn small", type: "button", onclick: () => area.replaceChildren() }, "Cancel")));
}

function commentForm(apiBase, reload, heading, buttonText) {
    let savedName = "";
    try { savedName = localStorage.getItem("screenName") || ""; } catch { }

    const name = el("input", { type: "text", id: "c-name", maxlength: 32, value: savedName });
    const text = el("textarea", { id: "c-text", rows: 5, maxlength: 2000 });
    // the trap: hidden from people, but spam bots fill it in
    const trap = el("input", { type: "text", name: "website", class: "hp", tabindex: "-1", autocomplete: "off", "aria-hidden": "true" });
    const button = el("button", { class: "btn", type: "submit" }, buttonText);

    return el("form", {
        onsubmit: guard(async (e) => {
            e.preventDefault();
            if (!name.value.trim() || !text.value.trim()) { alert("Fill in a screen name and a message."); return; }
            button.disabled = true;
            try {
                await api(apiBase, sendJSON("POST", { name: name.value, text: text.value, website: trap.value }));
                try { localStorage.setItem("screenName", name.value.trim()); } catch { }
                await reload();
            } finally {
                button.disabled = false;
            }
        }),
    },
        el("h3", {}, heading),
        el("label", { for: "c-name" }, "Screen name"), name,
        el("label", { for: "c-text" }, "Message"), text,
        trap,
        el("p", {}, button));
}

async function showGuestbook() {
    document.title = "Guestbook — SMOOGNET";
    const box = el("div");
    render(box);
    await loadComments("/api/guestbook", box, {
        title: "Guestbook", newestFirst: true, formFirst: true,
        formTitle: "Sign my guestbook!", button: "Sign it",
        empty: "Nobody has signed yet. Be the first!",
    });
}

// =====================================================================
//  EDITORS (you only) — posts, the About page, quotes
// =====================================================================
const MAX_UPLOAD = 100 * 1024 * 1024; // Cloudflare's free-plan request limit

// kind is "post" or "about"
async function showEditor(kind, id) {
    if (!isAdmin) { location.hash = "#/login"; return; }
    const isAbout = kind === "about";
    const post = !isAbout && id ? await api("/api/posts/" + enc(id)) : null;
    const about = isAbout ? await api("/api/about") : null;

    const title = el("input", { type: "text", id: "title", value: post ? post.title : "" });
    const body = el("textarea", { id: "body", class: "editor-body" });
    body.value = (post || about || { body: "" }).body;
    const status = el("p", { class: "hint" });
    const fileInput = el("input", { type: "file", accept: "image/*,video/*", multiple: true, hidden: true });
    const addBtn = el("button", { class: "btn", type: "button", onclick: () => fileInput.click() }, "+ Photo / Video");
    const saveBtn = el("button", { class: "btn", type: "button", onclick: guard(save) }, post || isAbout ? "Save" : "Publish");

    fileInput.addEventListener("change", async () => {
        const files = [...fileInput.files];
        fileInput.value = "";
        saveBtn.disabled = addBtn.disabled = true;
        for (let i = 0; i < files.length; i++) {
            const label = `Uploading ${i + 1} of ${files.length}`;
            try {
                status.textContent = label + "…";
                let file = files[i];
                if (file.type.startsWith("image/")) file = await shrinkImage(file);
                if (file.size > MAX_UPLOAD) {
                    throw new Error(`${files[i].name} is ${Math.round(file.size / 1048576)} MB — max is 100 MB`);
                }
                const result = await uploadFile(file, (pct) => {
                    status.textContent = `${label}… ${Math.round(pct * 100)}%`;
                });
                insertAtCursor(body, `[${result.kind}:${result.key}]`);
            } catch (err) {
                alert("Upload failed: " + err.message);
            }
        }
        status.textContent = "";
        saveBtn.disabled = addBtn.disabled = false;
    });

    async function save() {
        saveBtn.disabled = true;
        try {
            if (isAbout) {
                await api("/api/about", sendJSON("PUT", { body: body.value }));
                location.hash = "#/about";
                return;
            }
            if (!title.value.trim()) throw new Error("Give it a title first.");
            const data = { title: title.value, body: body.value };
            const saved = post
                ? await api("/api/posts/" + enc(post.id), sendJSON("PUT", data))
                : await api("/api/posts", sendJSON("POST", data));
            await refreshPosts();
            location.hash = postLink(saved);
        } finally {
            saveBtn.disabled = false;
        }
    }

    async function remove() {
        if (!confirm("Delete this post (and its comments) for good?")) return;
        await api("/api/posts/" + enc(post.id), { method: "DELETE" });
        await refreshPosts();
        location.hash = "#/posts";
    }

    render(panel(isAbout ? "Edit About page" : post ? "Edit post" : "New post",
        !isAbout && [el("label", { for: "title" }, "Title"), title],
        el("label", { for: "body" }, isAbout ? "About" : "Post"),
        el("p", {}, addBtn, fileInput),
        body,
        status,
        el("p", { class: "hint" },
            "Blank line = new paragraph. Photos/videos show up wherever their [photo:…] or [video:…] line sits — move or delete those lines like any other text."),
        el("p", {},
            saveBtn,
            el("a", { class: "btn", href: isAbout ? "#/about" : post ? postLink(post) : "#/" }, "Cancel"),
            post && el("button", { class: "btn", type: "button", onclick: guard(remove) }, "Delete post"))));
    if (!post && !isAbout) title.focus();
}

function showQuotes() {
    if (!isAdmin) { location.hash = "#/login"; return; }
    document.title = "Quotes — SMOOGNET";
    const today = quoteOfTheDay(quoteList);
    const text = el("textarea", { id: "q-text", rows: 3, maxlength: 500 });
    const by = el("input", { type: "text", id: "q-by", maxlength: 100 });

    render(panel("Quotes of the day",
        el("p", { class: "muted" },
            "One gets picked each day at random. It works through all of them before any repeats, and everyone sees the same one."),
        quoteList.length
            ? el("ol", {}, quoteList.map((q) => el("li", {},
                `“${q.text}”`, q.by && el("span", { class: "muted" }, ` — ${q.by}`),
                q === today && el("b", {}, " ← today"), " ",
                el("button", {
                    class: "btn small",
                    onclick: guard(async () => {
                        if (!confirm("Delete this quote?")) return;
                        await api("/api/quotes/" + enc(q.id), { method: "DELETE" });
                        await refreshQuotes();
                        showQuotes();
                    }),
                }, "Delete"))))
            : el("p", {}, "No quotes yet."),
        el("form", {
            onsubmit: guard(async (e) => {
                e.preventDefault();
                if (!text.value.trim()) return;
                await api("/api/quotes", sendJSON("POST", { text: text.value, by: by.value }));
                await refreshQuotes();
                showQuotes();
            }),
        },
            el("h3", {}, "Add a quote"),
            el("label", { for: "q-text" }, "Quote"), text,
            el("label", { for: "q-by" }, "Who said it (optional)"), by,
            el("p", {}, el("button", { class: "btn", type: "submit" }, "Add quote")))));
    text.focus();
}

// =====================================================================
//  UPLOAD HELPERS
// =====================================================================

// Phone photos are huge. Shrink to 2000px before uploading.
// (This also strips the GPS location phones bake into photos.)
async function shrinkImage(file) {
    if (file.type === "image/gif") return file; // keep animations
    try {
        const img = await createImageBitmap(file);
        const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
        return blob || file;
    } catch {
        return file; // browser couldn't read it — upload the original
    }
}

// fetch() can't report upload progress, XMLHttpRequest can.
function uploadFile(file, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/upload");
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
        xhr.onload = () => {
            let data = null;
            try { data = JSON.parse(xhr.responseText); } catch { }
            if (xhr.status >= 200 && xhr.status < 300 && data) resolve(data);
            else if (xhr.status === 413) reject(new Error("File too big (100 MB max)"));
            else reject(new Error((data && data.error) || `status ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("network error"));
        xhr.send(file);
    });
}

// Drop text into the textarea where the cursor is, on its own line.
function insertAtCursor(textarea, text) {
    const v = textarea.value;
    const before = v.slice(0, textarea.selectionStart);
    const after = v.slice(textarea.selectionEnd);
    const pre = before && !before.endsWith("\n") ? "\n" : "";
    const post = after.startsWith("\n") ? "" : "\n";
    textarea.value = before + pre + text + post + after;
    textarea.selectionStart = textarea.selectionEnd = (before + pre + text + post).length;
}

// =====================================================================
//  SMOOGA — click him and he says hi. Drag the sardines onto him and
//  he eats them. His jaw drops further the louder the sound is.
// =====================================================================
const buddy = document.getElementById("buddy");
const jaw = document.getElementById("buddy-jaw");
const food = document.getElementById("buddy-food");

const HELLO = "audio/hello.wav";
const EAT_SOUND = "audio/eat.wav";
const FED_LINES = ["audio/fed1.wav", "audio/fed2.wav", "audio/fed3.wav", "audio/fed4.wav"];
const JAW_MAX = 4; // how far the jaw drops while talking, in his own pixels (he's 107px tall)
const JAW_EAT = 4; // how wide he opens for the sardine

let analyser, samples, audioCtx;
let speaking = null; // the sound playing right now
let level = 0;
let busy = false; // true while he's eating, so he can't be fed twice at once
const sounds = {};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function setJaw(px) {
    jaw.style.transform = `translateY(${(px / 107) * 100}%)`; // whole pixels only, stays chunky
}

// Play a sound through the "listener" so the jaw can follow it.
// Resolves when the sound finishes (or right away if the file is missing).
function speak(src) {
    if (!analyser) {
        audioCtx = new AudioContext();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.connect(audioCtx.destination);
        samples = new Uint8Array(analyser.fftSize);
    }
    audioCtx.resume();
    if (!sounds[src]) {
        sounds[src] = new Audio(src);
        audioCtx.createMediaElementSource(sounds[src]).connect(analyser);
    }
    if (speaking) speaking.pause();
    const sound = sounds[src];
    speaking = sound;
    sound.currentTime = 0;
    return new Promise((resolve) => {
        const done = () => { sound.removeEventListener("ended", done); resolve(); };
        sound.addEventListener("ended", done);
        sound.play().then(() => requestAnimationFrame(moveJaw)).catch(done);
    });
}

function moveJaw() {
    if (!speaking || speaking.paused) { level = 0; setJaw(0); return; }
    analyser.getByteTimeDomainData(samples);
    let loudest = 0;
    for (const s of samples) loudest = Math.max(loudest, Math.abs(s - 128)); // 128 = silence
    level = Math.max(loudest, level * 0.8); // jaw snaps open, eases shut
    setJaw(Math.round(Math.min(1, level / 40) * JAW_MAX));
    requestAnimationFrame(moveJaw);
}

buddy.addEventListener("click", () => {
    if (!busy) speak(HELLO);
});

async function feed() {
    if (busy) return;
    busy = true;
    if (speaking) speaking.pause();
    try {
        setJaw(JAW_EAT); // open wide
        await wait(150);
        food.classList.remove("slurp");
        void food.offsetWidth; // restart the animation
        food.classList.add("slurp"); // sardine slides up behind his face
        await wait(750);
        food.classList.remove("slurp");
        setJaw(0);
        await speak(EAT_SOUND); // chewing = jaw following the eating sound
        await wait(250);
        await speak(nextLine());
    } finally {
        busy = false;
    }
}

// Lines come out of a shuffled "bag": every line plays once before any
// repeats, and the same line never plays twice in a row.
let lineBag = [];
let lastLine = null;

function nextLine() {
    if (!lineBag.length) {
        lineBag = FED_LINES.slice();
        for (let i = lineBag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [lineBag[i], lineBag[j]] = [lineBag[j], lineBag[i]];
        }
        if (lineBag[0] === lastLine && lineBag.length > 1) [lineBag[0], lineBag[1]] = [lineBag[1], lineBag[0]];
    }
    lastLine = lineBag.shift();
    return lastLine;
}

// ---------- pulling a sardine out of the can ----------
// You hold it by the tail and it swings like a pendulum. Swing its head
// into Smooga to feed him. Let go and it flies off with your mouse's speed.
const TAIL_X = 3, TAIL_Y = 10.5; // where the tail is in sardine.png (matches .flying-fish in styles.css)
const FISH_LEN = 80;             // tail to head, in pixels
const GRAVITY = 3000;            // pixels per second², just picked to feel right
const SWING_DAMPING = 5;       // higher = settles down faster

function grabFish(e) {
    e.preventDefault();
    const fish = el("img", { src: "img/sardine.png", class: "flying-fish", alt: "", draggable: "false" });
    document.body.append(fish);
    document.body.classList.add("holding-fish");

    const start = { x: e.clientX, y: e.clientY };
    let pointer = { ...start };   // where the mouse/finger is
    let pivot = { ...start };     // where the tail is
    let vel = { x: 0, y: 0 };     // tail speed
    let theta = 0;                // swing angle: 0 = hanging straight down
    let omega = 0;                // swing speed
    let holding = true;
    let moved = false;
    let last = performance.now();
    const born = last;

    const onMove = (ev) => {
        pointer = { x: ev.clientX, y: ev.clientY };
        if (Math.hypot(pointer.x - start.x, pointer.y - start.y) > 5) moved = true;
    };
    const onUp = () => {
        holding = false;
        stopListening();
        document.body.classList.remove("holding-fish");
        if (!moved) { fish.remove(); feed(); } // a tap = just feed him
    };
    const stopListening = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    const clamp = (v) => Math.max(-30000, Math.min(30000, v));

    function draw() {
        // the picture points tail→head to the right; turn it to match the swing
        fish.style.transform =
            `translate(${pivot.x - TAIL_X}px, ${pivot.y - TAIL_Y}px) rotate(${Math.PI / 2 - theta}rad)`;
    }

    function step(now) {
        if (!fish.isConnected) return;
        const dt = Math.min(0.033, (now - last) / 1000) || 0.016;
        last = now;

        if (holding) {
            // how fast (and how suddenly) the tail is being yanked around
            const newVel = { x: (pointer.x - pivot.x) / dt, y: (pointer.y - pivot.y) / dt };
            const smoothed = { x: vel.x + (newVel.x - vel.x) * 0.5, y: vel.y + (newVel.y - vel.y) * 0.5 };
            const acc = { x: clamp((smoothed.x - vel.x) / dt), y: clamp((smoothed.y - vel.y) / dt) };
            vel = smoothed;
            pivot = { ...pointer };

            // pendulum: gravity pulls the head down, yanking the tail flings it the other way
            const alpha = (-(GRAVITY - acc.y) * Math.sin(theta) - acc.x * Math.cos(theta)) / FISH_LEN - SWING_DAMPING * omega;
            omega += alpha * dt;
            theta += omega * dt;
            draw();

            // head inside Smooga = he eats it
            const head = { x: pivot.x + FISH_LEN * Math.sin(theta), y: pivot.y + FISH_LEN * Math.cos(theta) };
            const b = buddy.getBoundingClientRect();
            if (!busy && head.x > b.left && head.x < b.right && head.y > b.top && head.y < b.bottom) {
                holding = false;
                stopListening();
                document.body.classList.remove("holding-fish");
                fish.remove();
                feed();
                return;
            }
        } else {
            // let go: it keeps your mouse's speed, falls, and keeps spinning
            vel.y += GRAVITY * dt;
            pivot.x += vel.x * dt;
            pivot.y += vel.y * dt;
            theta += omega * dt;
            draw();
            const gone = pivot.y > innerHeight + 200 || pivot.x < -200 || pivot.x > innerWidth + 200 || now - born > 8000;
            if (gone) { fish.remove(); return; }
        }
        requestAnimationFrame(step);
    }

    draw();
    requestAnimationFrame(step);
}

// =====================================================================
//  ROUTER — the part after # in the URL decides what page to show
//    #/              home          #/post/ID      one post
//    #/posts         all posts     #/about        about page
//    #/guestbook     guestbook
//    #/new           new post      #/edit/ID      edit post
//    #/edit-about    edit about    #/quotes       manage quotes
//    #/login         sign in
// =====================================================================
const TAB_FOR = { home: "home", posts: "posts", post: "posts", new: "posts", edit: "posts", guestbook: "guestbook", about: "about", "edit-about": "about" };

async function route() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    const page = parts[0] || "home";
    const id = parts[1] && decodeURIComponent(parts[1]);

    document.querySelectorAll("#tabs a[data-tab]").forEach((a) =>
        a.classList.toggle("active", a.dataset.tab === TAB_FOR[page]));
    document.title = "SMOOGNET";
    layout.classList.toggle("with-right", page === "home");
    rightcol.replaceChildren();
    window.scrollTo(0, 0);

    try {
        if (page === "home") await showHome();
        else if (page === "posts") showPosts();
        else if (page === "post" && id) await showPost(id);
        else if (page === "guestbook") await showGuestbook();
        else if (page === "about") await showAbout();
        else if (page === "new") await showEditor("post");
        else if (page === "edit" && id) await showEditor("post", id);
        else if (page === "edit-about") await showEditor("about");
        else if (page === "quotes") showQuotes();
        else if (page === "login") showLogin();
        else render(panel("Not found", el("p", {}, "Nothing here. ", el("a", { href: "#/" }, "Go home"))));
    } catch (err) {
        render(panel("Error", el("p", { class: "error" }, err.message), el("a", { href: "#/" }, "Go home")));
    }
}

window.addEventListener("hashchange", route);

// ---------- start up ----------

// Adds 1 to the odometer the first time this browser visits, otherwise just reads it
async function countVisit() {
    let counted = false;
    try { counted = localStorage.getItem("counted") === "1"; } catch { }
    try {
        const { count } = counted ? await api("/api/hits") : await api("/api/hits", { method: "POST" });
        if (!counted) try { localStorage.setItem("counted", "1"); } catch { }
        return count;
    } catch {
        return null;
    }
}

renderDate();
Promise.all([
    api("/api/me").catch(() => ({ admin: false })),
    api("/api/posts").catch(() => []),
    api("/api/quotes").catch(() => []),
    countVisit(),
]).then(([me, posts, quotes, hits]) => {
    isAdmin = me.admin;
    postList = posts;
    quoteList = quotes;
    hitCount = hits;
    renderChrome();
    route();
});
