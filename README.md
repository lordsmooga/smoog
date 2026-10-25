# smoog
SMOOGNET

## How it works
- `index.html`, `styles.css`, `script.js` — the whole front end. The part of the URL after `#` decides which page shows (`#/`, `#/post/ID`, `#/new`, `#/edit/ID`, `#/login`).
- `functions/` — tiny server code that Cloudflare Pages runs for you. Every file in there becomes a URL (`functions/api/login.js` → `/api/login`).
- Posts live in one `posts.json` file and uploads live in `media/`, both inside an R2 bucket (Cloudflare's file storage).
- Log in at **smoog.net/#/login**. Logged in, you get NEW POST / EDIT / LOG OUT buttons. Everyone else can only read.

## One-time Cloudflare setup
1. **Make the bucket:** Cloudflare dashboard → R2 Object Storage → Create bucket → name it `smoognet`.
   (R2 asks for a card on file the first time. Free up to 10 GB.)
2. **Hook it to the site:** Workers & Pages → `smoog` project → Settings → Bindings → Add → R2 bucket.
   Variable name: `BUCKET` · bucket: `smoognet`.
3. **Set your password:** same Settings page → Variables and Secrets → Add →
   type **Secret**, name `ADMIN_PASSWORD`, value = a long password.
4. **Push this repo** (commit + push in GitHub Desktop). Settings only kick in on the next deploy,
   so if you did steps 1–3 after pushing, hit Deployments → Retry deployment.

## Writing posts
- Blank line = new paragraph.
- [ + PHOTO / VIDEO ] uploads and drops a line like `[photo:abc.jpg]` where your cursor is. Move or delete those lines to move or remove the media.
- Photos get shrunk to 2000px before upload (also strips GPS location from phone photos).
- Videos: 100 MB max per file (Cloudflare free-plan limit).

## Run it on your PC (optional)
`npx wrangler pages dev . --r2=BUCKET --binding ADMIN_PASSWORD=test` → open http://localhost:8788
