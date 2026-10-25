# smoog
SMOOGNET

## How it works
- `index.html`, `styles.css`, `script.js` — the whole front end (the 2000-era MSN-style layout). The part of the URL after `#` decides which page shows.
- `worker.js` — the Cloudflare Worker. Sends `/api/...` and `/media/...` to the server code in `functions/`, serves everything else as plain files.
- `wrangler.jsonc` — Worker settings Cloudflare reads on every deploy (name, R2 bucket hookup). `.assetsignore` keeps server files from being served publicly.
- Everything you write lives in the R2 bucket: `posts.json`, `quotes.json`, `about.json`, `comments/<post id>.json`, and uploads in `media/`.
- `audio/smoog.mp3` and `audio/net.mp3` belonged to the old intro and aren't used anymore. Safe to delete.

## Pages
| URL | What |
|---|---|
| `#/` | Home |
| `#/posts` | All posts |
| `#/post/ID` | One post + comments |
| `#/about` | About page |
| `#/login` | Sign in (also the "sign in" link on the tab bar) |
| `#/new`, `#/edit/ID`, `#/edit-about`, `#/quotes` | Webmaster only (links show in the bar under the tabs when signed in) |

## Quote of the day
Add/delete quotes at `#/quotes`. Each day one is picked at random; it goes through all of them before repeating, and everyone sees the same one.

## Comments
Anyone can comment with a screen name. Signed in, you get Reply and Delete on every comment.
Your replies show as **smoog** with a WEBMASTER tag (change `OWNER_NAME` in `functions/_lib.js` and `OWNER` in `script.js` together). Visitors can't use that screen name.
Spam protection is a hidden "honeypot" box that bots fill in and people never see. If real spam gets through, Cloudflare Turnstile is the next step up.

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
`npx wrangler dev --var ADMIN_PASSWORD:test` → open http://localhost:8787
