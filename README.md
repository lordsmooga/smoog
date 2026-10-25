# smoog
SMOOGNET

## How it works
- `index.html`, `styles.css`, `script.js` — the whole front end. The part of the URL after `#` decides which page shows (`#/`, `#/post/ID`, `#/new`, `#/edit/ID`, `#/login`).
- `worker.js` — the Cloudflare Worker. Sends `/api/...` and `/media/...` to the server code in `functions/`, serves everything else as plain files.
- `wrangler.jsonc` — Worker settings Cloudflare reads on every deploy (name, R2 bucket hookup). `.assetsignore` keeps server files from being served publicly.
- Posts live in one `posts.json` file and uploads live in `media/`, both inside an R2 bucket (Cloudflare's file storage).
- Log in at **smoog.net/#/login**. Logged in, you get NEW POST / EDIT / LOG OUT buttons. Everyone else can only read.

## One-time Cloudflare setup
1. **Make the bucket:** Cloudflare dashboard → R2 Object Storage → Create bucket → name it `smoognet`.
   (R2 asks for a card on file the first time. Free up to 10 GB.) Do this BEFORE pushing or the deploy fails.
2. **Check the name:** the `"name"` in `wrangler.jsonc` must match your Worker's name in the dashboard (it's set to `smoog`).
3. **Push** (commit + Push origin in GitHub Desktop). The bucket hookup comes from `wrangler.jsonc`, no dashboard clicking needed.
4. **Set your password:** Workers & Pages → your Worker → Settings → Variables and Secrets → Add →
   type **Secret**, name `ADMIN_PASSWORD`, value = a long password. Secrets stick around between deploys.

## Writing posts
- Blank line = new paragraph.
- [ + PHOTO / VIDEO ] uploads and drops a line like `[photo:abc.jpg]` where your cursor is. Move or delete those lines to move or remove the media.
- Photos get shrunk to 2000px before upload (also strips GPS location from phone photos).
- Videos: 100 MB max per file (Cloudflare free-plan limit).

## Run it on your PC (optional)
`npx wrangler dev --var ADMIN_PASSWORD:test` → open http://localhost:8788
