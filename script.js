// =====================================================================
//  INTRO — click gate, SMOOG, NET, then the title docks top-left
// =====================================================================
const gate = document.getElementById("gate");
const smoog = document.getElementById("smoog");
const net = document.getElementById("net");
const homeLink = document.getElementById("home-link");
const content = document.getElementById("content");
const smoogSound = new Audio("audio/smoog.mp3");
const netSound = new Audio("audio/net.mp3");

const SMOOG_DELAY = 500;
const NET_DELAY = 1500;
const DOCK_DELAY = 2500;

function unlock(sound) {
    sound.play().catch(() => { });
    sound.pause();
    sound.currentTime = 0;
}

// Moves the title to the top-left. With animate=true it slides there:
// measure where it is, snap it to the new spot, then use a transform
// to make it *look* like it's still in the old spot and let it ease home.
function dock(animate) {
    const first = homeLink.getBoundingClientRect();
    document.body.classList.add("docked");
    if (!animate) return;

    const last = homeLink.getBoundingClientRect();
    const scale = first.width / last.width;
    homeLink.style.transformOrigin = "top left";
    homeLink.style.transform =
        `translate(${first.left - last.left}px, ${first.top - last.top}px) scale(${scale})`;
    homeLink.getBoundingClientRect(); // force the browser to apply that before animating
    homeLink.style.transition = "transform 0.6s ease";
    homeLink.style.transform = "";
}

function finishIntro(animate) {
    gate.classList.add("gone");
    smoog.classList.add("visible");
    net.classList.add("visible");
    dock(animate);
    content.classList.add("visible");
    try { sessionStorage.setItem("introSeen", "1"); } catch { }
}

let introSeen = false;
try { introSeen = sessionStorage.getItem("introSeen") === "1"; } catch { }

if (introSeen) {
    // already watched it this visit (e.g. you refreshed) — skip straight in
    finishIntro(false);
} else {
    gate.addEventListener("click", () => {
        unlock(smoogSound);
        unlock(netSound);
        gate.classList.add("gone");

        setTimeout(() => {
            smoog.classList.add("visible");
            smoogSound.play().catch(() => { });
        }, SMOOG_DELAY);

        setTimeout(() => {
            net.classList.add("visible");
            netSound.play().catch(() => { });
        }, NET_DELAY);

        setTimeout(() => finishIntro(true), DOCK_DELAY);
    });
}

// =====================================================================
//  HELPERS
// =====================================================================

// Build an element: el("a", { href: "#/" }, "text", otherElement)
// Text always goes in as plain text, so nothing typed can break the page.
function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
        else if (value === true) node.setAttribute(key, "");
        else if (value !== false && value != null) node.setAttribute(key, value);
    }
    for (const child of children.flat()) {
        if (child == null || child === false) continue;
        node.append(child instanceof Node ? child : String(child));
    }
    return node;
}

function render(...nodes) {
    content.replaceChildren(...nodes.filter((n) => n != null && n !== false));
}

function fmtDate(iso) {
    return new Date(iso).toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
    });
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

// =====================================================================
//  POST BODY — plain text, blank line = new paragraph,
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
            if (media[1] === "photo") {
                out.append(el("a", { href: src, target: "_blank" },
                    el("img", { src, loading: "lazy", alt: "" })));
            } else {
                out.append(el("video", { src, controls: true, playsinline: true, preload: "metadata" }));
            }
        } else if (line.trim() === "") {
            flush();
        } else {
            lines.push(line);
        }
    }
    flush();
    return out;
}

// =====================================================================
//  PAGES
// =====================================================================
let isAdmin = false;

async function showHome() {
    const posts = await api("/api/posts");
    render(
        el("p", { class: "tagline" }, "Welcome to my website :D"),
        isAdmin && el("div", { class: "admin-bar" },
            el("a", { class: "btn", href: "#/new" }, "[ NEW POST ]"),
            el("button", { class: "btn", onclick: logout }, "[ LOG OUT ]"),
        ),
        posts.length === 0
            ? el("p", { class: "muted" }, "No posts yet.")
            : el("ul", { class: "post-list" }, posts.map((p) =>
                el("li", {},
                    el("a", { href: "#/post/" + encodeURIComponent(p.id) }, p.title),
                    el("span", { class: "date" }, fmtDate(p.created)),
                ))),
    );
}

async function showPost(id) {
    const post = await api("/api/posts/" + encodeURIComponent(id));
    const edited = fmtDate(post.updated) !== fmtDate(post.created);
    document.title = post.title + " — SMOOGNET";
    render(el("article", { class: "post" },
        el("h2", {}, post.title),
        el("span", { class: "date" },
            fmtDate(post.created), edited && ` · edited ${fmtDate(post.updated)}`),
        isAdmin && el("div", { class: "admin-bar" },
            el("a", { class: "btn", href: "#/edit/" + encodeURIComponent(post.id) }, "[ EDIT ]")),
        renderBody(post.body),
    ));
}

const MAX_UPLOAD = 100 * 1024 * 1024; // Cloudflare's free-plan request limit

async function showEditor(id) {
    if (!isAdmin) { location.hash = "#/login"; return; }
    const post = id ? await api("/api/posts/" + encodeURIComponent(id)) : null;

    const title = el("input", { type: "text", id: "title", value: post ? post.title : "" });
    const body = el("textarea", { id: "body" });
    body.value = post ? post.body : "";
    const status = el("p", { class: "hint" });
    const fileInput = el("input", { type: "file", accept: "image/*,video/*", multiple: true, hidden: true });
    const addBtn = el("button", { class: "btn", type: "button", onclick: () => fileInput.click() }, "[ + PHOTO / VIDEO ]");
    const saveBtn = el("button", { class: "btn", type: "button", onclick: save }, post ? "[ SAVE ]" : "[ PUBLISH ]");

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
        if (!title.value.trim()) { alert("Give it a title first."); return; }
        saveBtn.disabled = true;
        try {
            const data = { title: title.value, body: body.value };
            const saved = post
                ? await api("/api/posts/" + encodeURIComponent(post.id), sendJSON("PUT", data))
                : await api("/api/posts", sendJSON("POST", data));
            location.hash = "#/post/" + encodeURIComponent(saved.id);
        } catch (err) {
            alert("Couldn't save: " + err.message);
            saveBtn.disabled = false;
        }
    }

    async function remove() {
        if (!confirm("Delete this post for good?")) return;
        try {
            await api("/api/posts/" + encodeURIComponent(post.id), { method: "DELETE" });
            location.hash = "#/";
        } catch (err) {
            alert("Couldn't delete: " + err.message);
        }
    }

    render(
        el("h2", {}, post ? "Edit post" : "New post"),
        el("label", { for: "title" }, "Title"),
        title,
        el("label", { for: "body" }, "Post"),
        el("div", {}, addBtn, fileInput),
        body,
        status,
        el("p", { class: "hint" },
            "Blank line = new paragraph. Photos/videos show up wherever their [photo:…] or [video:…] line sits — move or delete those lines like any other text."),
        el("div", {},
            saveBtn,
            el("a", { class: "btn", href: post ? "#/post/" + encodeURIComponent(post.id) : "#/" }, "[ CANCEL ]"),
            post && el("button", { class: "btn danger", type: "button", onclick: remove }, "[ DELETE ]"),
        ),
    );
    if (!post) title.focus();
}

function showLogin() {
    if (isAdmin) { location.hash = "#/"; return; }
    const pw = el("input", { type: "password", id: "pw", autocomplete: "current-password" });
    const msg = el("p", { class: "error" });
    render(el("form", {
        onsubmit: async (e) => {
            e.preventDefault();
            try {
                await api("/api/login", sendJSON("POST", { password: pw.value }));
                isAdmin = true;
                location.hash = "#/";
            } catch (err) {
                msg.textContent = err.message;
            }
        },
    },
        el("label", { for: "pw" }, "Password"),
        pw,
        el("p", {}, el("button", { class: "btn", type: "submit" }, "[ LOG IN ]")),
        msg,
    ));
    pw.focus();
}

async function logout() {
    await api("/api/logout", { method: "POST" }).catch(() => { });
    isAdmin = false;
    route();
}

// =====================================================================
//  UPLOAD HELPERS
// =====================================================================

// Phone photos are huge. Shrink to 2000px wide-ish JPEG before uploading.
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
//  ROUTER — the part after # in the URL decides what page to show
//    #/            home (post list)
//    #/post/ID     one post
//    #/new         new post (you only)
//    #/edit/ID     edit post (you only)
//    #/login       log in
// =====================================================================
async function route() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    const [page, id] = [parts[0], parts[1] && decodeURIComponent(parts[1])];
    document.title = "SMOOGNET";
    window.scrollTo(0, 0);
    try {
        if (!page) await showHome();
        else if (page === "post" && id) await showPost(id);
        else if (page === "new") await showEditor(null);
        else if (page === "edit" && id) await showEditor(id);
        else if (page === "login") showLogin();
        else render(el("p", {}, "Nothing here. ", el("a", { href: "#/" }, "Go home")));
    } catch (err) {
        render(el("p", { class: "error" }, err.message), el("a", { href: "#/" }, "Go home"));
    }
}

window.addEventListener("hashchange", route);

api("/api/me")
    .then((me) => { isAdmin = me.admin; })
    .catch(() => { })
    .finally(route);

// =====================================================================
//  BUDDY — click him and he says hi. The jaw drops further
//  the louder the audio is at that moment.
// =====================================================================
const buddy = document.getElementById("buddy");
const jaw = document.getElementById("buddy-jaw");
const hello = new Audio("audio/hello.wav");
const JAW_MAX = 4; // how far the jaw can drop, in his own pixels (he's 107px tall)
let analyser, samples;

buddy.addEventListener("click", () => {
    // Web Audio lets us "listen" to the sound while it plays
    if (!analyser) {
        const ctx = new AudioContext();
        analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaElementSource(hello).connect(analyser);
        analyser.connect(ctx.destination);
        samples = new Uint8Array(analyser.fftSize);
        buddy.audioCtx = ctx;
    }
    buddy.audioCtx.resume();
    hello.currentTime = 0;
    hello.play().catch(() => { });
    requestAnimationFrame(moveJaw);
});

let level = 0;
function moveJaw() {
    analyser.getByteTimeDomainData(samples);
    let loudest = 0;
    for (const s of samples) loudest = Math.max(loudest, Math.abs(s - 128)); // 128 = silence
    level = Math.max(loudest, level * 0.8); // jaw snaps open, eases shut
    const drop = hello.paused ? 0 : Math.round(Math.min(1, level / 40) * JAW_MAX);
    jaw.style.transform = `translateY(${(drop / 107) * 100}%)`; // whole pixels only, stays chunky
    if (hello.paused) level = 0;
    else requestAnimationFrame(moveJaw);
}
