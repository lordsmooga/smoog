// =====================================================================
//  SMOOG'S CASTLE — a tiny pinball machine for the left column.
//  Layout borrowed from the classic castle-siege tables: break the
//  castle gate and shoot the ball inside, smash the trolls, save the
//  damsel. Drawn at 160×326 pixels and scaled up with chunky pixels.
//
//  Controls: drag the plunger (bottom right) down and let go.
//  Click/tap the left or right half to flip. Keys when the game is
//  focused: Q / Z / Left = left flipper, E / M / Right = right flipper,
//  Space or Down = plunger.
// =====================================================================
(function () {
    const W = 160;               // playfield width
    const H = 300;               // playfield height
    const DMD = 26;              // score display strip on top
    const R = 3;                 // ball radius
    const GRAVITY = 720;         // units/s² (the table "tilt") — lower = slower, floatier ball
    const MAX_SPEED = 1000;
    const STEP = 1 / 600;        // physics step (small steps = no tunneling)
    const FLIP_LEN = 24;
    const FLIP_R = 3;            // flipper thickness (radius)
    const FLIP_SPEED = 25;       // rad/s
    const FLIP_REST = 0.5;       // radians below horizontal
    const FLIP_UP = -0.45;
    const BALLS_PER_GAME = 3;

    const COLORS = {
        bg: "#24091c", wall: "#ffe100", wallDim: "#8f7e00", tileA: "#a8421a", tileB: "#3b1e5c",
        stone: "#8a8f99", stoneDark: "#5a5f69", door: "#7a4a1f", doorDark: "#4a2a0f",
        bumper: "#c0392b", ring: "#ffe100", troll: "#4caf50", damsel: "#ff7aa8",
        flipper: "#f2f2f2", flipperEdge: "#c0392b", ball: "#d8dde3", dmdBg: "#140800", dmd: "#ff8c1a", dmdDim: "#4a2400",
    };

    // ---------- tiny 3×5 pixel font for the dot-matrix display ----------
    const FONT = {
        "0": "111101101101111", "1": "010110010010111", "2": "111001111100111", "3": "111001111001111", "4": "101101111001001",
        "5": "111100111001111", "6": "111100111101111", "7": "111001001001001", "8": "111101111101111", "9": "111101111001111",
        A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110", E: "111100110100111",
        F: "111100110100100", G: "011100101101011", H: "101101111101101", I: "111010010010111", J: "001001001101010",
        K: "101101110101101", L: "100100100100111", M: "101111111101101", N: "110101101101101", O: "010101101101010",
        P: "110101110100100", Q: "010101101110011", R: "110101110101101", S: "011100010001110", T: "111010010010010",
        U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101", Y: "101101010010010",
        Z: "111001010100111", " ": "000000000000000", "!": "010010010000010", ",": "000000000010100", ".": "000000000000010",
        "-": "000000111000000", ":": "000010000010000", "'": "010010000000000", "_": "000000000000111", "?": "111001010000010",
        "/": "001001010100100", "#": "101111101111101",
    };

    function text(ctx, str, x, y, scale, color) {
        ctx.fillStyle = color;
        for (const ch of str.toUpperCase()) {
            const g = FONT[ch] || FONT["?"];
            for (let i = 0; i < 15; i++) {
                if (g[i] === "1") ctx.fillRect(x + (i % 3) * scale, y + Math.floor(i / 3) * scale, scale, scale);
            }
            x += 4 * scale;
        }
    }
    const textWidth = (str, scale) => str.length * 4 * scale - scale;
    const centerText = (ctx, str, y, scale, color) => text(ctx, str, Math.round((W - textWidth(str, scale)) / 2), y, scale, color);
    const fmt = (n) => n.toLocaleString("en-US");

    // ---------- the table ----------
    // Walls are line segments. "kind" changes what happens on contact.
    const walls = [];
    const wall = (x1, y1, x2, y2, extra = {}) => { const s = { x1, y1, x2, y2, kind: "wall", on: true, ...extra }; walls.push(s); return s; };
    const box = (x1, y1, x2, y2, extra) => [wall(x1, y1, x2, y1, extra), wall(x2, y1, x2, y2, extra), wall(x2, y2, x1, y2, extra), wall(x1, y2, x1, y1, extra)];

    // dome across the top
    const DOME = { cx: 80, cy: 60, rx: 76, ry: 56 };
    let prev = null;
    for (let i = 0; i <= 32; i++) {
        const a = Math.PI + (i / 32) * Math.PI;
        const pt = { x: DOME.cx + DOME.rx * Math.cos(a), y: DOME.cy + DOME.ry * Math.sin(a) };
        if (prev) wall(prev.x, prev.y, pt.x, pt.y);
        prev = pt;
    }
    wall(4, 60, 4, 206);            // left wall
    wall(4, 206, 46, 268);          // left inlane rail → runs right into the flipper pivot (no notch to stall in)
    wall(144, 70, 144, 300);        // shooter lane divider
    wall(156, 60, 156, 300);        // right wall (outside of shooter lane)
    wall(144, 206, 102, 268);       // right inlane rail → right flipper pivot
    const plungerWall = wall(144, 290, 156, 290, { kind: "plunger" });

    // castle: the door is the target. The ball bounces off an invisible peaked
    // roof (so it can't come to rest between the towers); the drawn outline is decoration.
    [[58, 58, 58, 22], [58, 22, 74, 14, { hidden: true }], [74, 14, 90, 22, { hidden: true }],
        [90, 22, 90, 58], [58, 58, 68, 58], [80, 58, 90, 58]].forEach(([a, b, c, d, extra]) => wall(a, b, c, d, extra));
    const castleOutline = [[58, 22, 64, 22], [64, 22, 64, 30], [64, 30, 84, 30], [84, 30, 84, 22], [84, 22, 90, 22]];
    const gate = wall(68, 58, 80, 58, { kind: "gate" });
    const pocket = [wall(68, 58, 68, 44, { on: false }), wall(80, 58, 80, 44, { on: false }), wall(68, 44, 80, 44, { on: false })];

    // slingshots: the long face kicks the ball. They sit high enough above the
    // inlane rails that a ball always fits underneath (no wedging).
    const slings = [
        { a: [16, 184], b: [16, 206], c: [32, 232] },
        { a: [132, 184], b: [132, 206], c: [116, 232] },
    ].map((s) => ({
        flash: 0,
        segs: [wall(...s.a, ...s.b), wall(...s.b, ...s.c), wall(...s.a, ...s.c, { kind: "sling" })],
        pts: [s.a, s.b, s.c],
    }));
    slings.forEach((s) => { s.segs[2].sling = s; });

    // trolls (standup targets in the middle)
    const trolls = [[60, 134], [80, 134]].map(([x, y]) => {
        const t = { x, y, up: true, segs: [] };
        t.segs = box(x, y, x + 8, y + 4, { kind: "troll", troll: t });
        return t;
    });
    // damsel drop targets on the right
    const damsels = [112, 126, 140].map((y) => {
        const d = { x: 138, y, up: true, segs: [] };
        d.segs = box(138, y, 143, y + 10, { kind: "damsel", damsel: d });
        return d;
    });
    // pop bumpers
    const bumpers = [[28, 92], [46, 108], [24, 122]].map(([x, y]) => ({ x, y, r: 7, flash: 0 }));

    // flippers
    const flippers = [
        { px: 46, py: 268, rest: FLIP_REST, up: FLIP_UP, dir: -1, angle: FLIP_REST, omega: 0, pressed: false },
        { px: 102, py: 268, rest: Math.PI - FLIP_REST, up: Math.PI - FLIP_UP, dir: 1, angle: Math.PI - FLIP_REST, omega: 0, pressed: false },
    ];
    const flipTip = (f) => ({ x: f.px + FLIP_LEN * Math.cos(f.angle), y: f.py + FLIP_LEN * Math.sin(f.angle) });

    // ---------- the game ----------
    function createPinball() {
        const wrap = document.createElement("div");
        wrap.className = "pinball";
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H + DMD;
        canvas.tabIndex = 0;
        canvas.setAttribute("aria-label", "Pinball game");
        const scoreList = document.createElement("ol");
        scoreList.className = "pinball-scores";
        const help = document.createElement("p");
        help.className = "hint center";
        help.textContent = "Drag the plunger down and let go. Click left/right (or Q / E) to flip.";
        wrap.append(canvas, scoreList, help);
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = false;

        const background = drawBackground();

        let state = "attract"; // attract | play | initials
        let score = 0, ballsLeft = 0, castleLevel = 1, gateHp = 3;
        let ball = null;                 // { x, y, vx, vy, captured }
        let plungerPull = 0;             // 0..1
        let stuckTime = 0;
        let message = null, messageTime = 0;
        let highScores = [];
        let initials = ["A", "A", "A"], initialIdx = 0;
        const timers = [];               // [secondsLeft, fn]
        const later = (sec, fn) => timers.push([sec, fn]);

        loadScores();

        function loadScores() {
            fetch("/api/pinball").then((r) => r.json()).then((s) => { highScores = s; showScores(); }).catch(() => { });
        }
        function showScores() {
            scoreList.replaceChildren(...[0, 1, 2].map((i) => {
                const li = document.createElement("li");
                const s = highScores[i];
                li.textContent = s ? `${s.initials}  ${fmt(s.score)}` : "---  0";
                return li;
            }));
        }

        function say(msg, sec = 1.6) { message = msg; messageTime = sec; }
        function add(points) { score += points; }

        function newGame() {
            state = "play";
            score = 0;
            ballsLeft = BALLS_PER_GAME;
            castleLevel = 1;
            gateHp = 3;
            resetTargets();
            serveBall();
        }
        function resetTargets() {
            trolls.forEach((t) => (t.up = true));
            damsels.forEach((d) => (d.up = true));
            gate.on = gateHp > 0;
            pocket.forEach((p) => (p.on = gateHp <= 0));
        }
        function serveBall() {
            ball = { x: 150, y: 286, vx: 0, vy: 0, captured: false };
            say(`BALL ${BALLS_PER_GAME - ballsLeft + 1}`);
        }
        function ballInLane() {
            return ball && ball.x > 144 && ball.y > 270 && Math.abs(ball.vy) < 60;
        }
        function launch() {
            if (state === "attract") newGame();
            if (state === "play" && ballInLane()) ball.vy = -(320 + 640 * plungerPull);
            plungerPull = 0;
        }
        function drain() {
            ball = null;
            ballsLeft--;
            if (ballsLeft > 0) later(1, serveBall);
            else gameOver();
        }
        function gameOver() {
            say("GAME OVER", 2.5);
            const qualifies = score > 0 && (highScores.length < 3 || score > highScores[Math.min(2, highScores.length - 1)].score);
            later(2.5, () => {
                if (qualifies) { state = "initials"; initials = ["A", "A", "A"]; initialIdx = 0; }
                else state = "attract";
            });
        }
        async function submitInitials() {
            state = "attract";
            say("SAVING...", 3);
            try {
                const res = await fetch("/api/pinball", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ initials: initials.join(""), score }),
                });
                if (res.ok) { highScores = await res.json(); showScores(); say("HIGH SCORE!", 2.5); }
                else say("SAVE FAILED", 2);
            } catch { say("SAVE FAILED", 2); }
        }

        // ----- scoring events -----
        function hitGate() {
            gateHp--;
            add(5000);
            if (gateHp <= 0) { gate.on = false; pocket.forEach((p) => (p.on = true)); say("GATE BROKEN!"); }
            else say(`GATE ${gateHp} MORE`, 1);
        }
        function enterCastle() {
            ball.captured = true;
            ball.vx = ball.vy = 0;
            const bonus = 50000 * castleLevel;
            add(bonus);
            say(`CASTLE DESTROYED ${fmt(bonus)}`, 2);
            castleLevel++;
            later(1.5, () => {
                gateHp = 3;
                gate.on = true;
                pocket.forEach((p) => (p.on = false));
                if (ball) Object.assign(ball, { x: 74, y: 66, vx: (Math.random() - 0.5) * 220, vy: 160, captured: false });
            });
        }
        function hitTroll(t) {
            t.up = false;
            add(7500);
            if (trolls.every((x) => !x.up)) {
                add(25000);
                say("TROLLS SMASHED!");
                later(2, () => trolls.forEach((x) => (x.up = true)));
            }
        }
        function hitDamsel(d) {
            d.up = false;
            add(5000);
            if (damsels.every((x) => !x.up)) {
                add(30000);
                say("DAMSEL SAVED!");
                later(1.5, () => damsels.forEach((x) => (x.up = true)));
            }
        }

        // ----- physics -----
        function physics(h) {
            for (const f of flippers) {
                const target = f.pressed ? f.up : f.rest;
                const speed = f.pressed ? FLIP_SPEED : FLIP_SPEED * 0.6;
                const before = f.angle;
                const diff = target - f.angle;
                const stepA = Math.sign(diff) * Math.min(Math.abs(diff), speed * h);
                f.angle += stepA;
                f.omega = (f.angle - before) / h;
            }
            if (!ball || ball.captured) return;

            ball.vy += GRAVITY * h;
            ball.x += ball.vx * h;
            ball.y += ball.vy * h;

            for (const s of walls) {
                if (!s.on) continue;
                if (s.kind === "troll" && !s.troll.up) continue;
                if (s.kind === "damsel" && !s.damsel.up) continue;
                const q = closest(ball.x, ball.y, s.x1, s.y1, s.x2, s.y2);
                const dx = ball.x - q.x, dy = ball.y - q.y;
                const dist = Math.hypot(dx, dy);
                if (dist >= R || dist === 0) continue;
                const nx = dx / dist, ny = dy / dist;
                ball.x = q.x + nx * R;
                ball.y = q.y + ny * R;
                const vn = ball.vx * nx + ball.vy * ny;
                if (vn >= 0) continue;
                const bounce = s.kind === "plunger" ? 0 : 0.45;
                ball.vx -= (1 + bounce) * vn * nx;
                ball.vy -= (1 + bounce) * vn * ny;
                const hard = vn < -40;
                if (s.kind === "sling" && vn < -25) {
                    ball.vx += nx * 240; ball.vy += ny * 240;
                    s.sling.flash = 0.12; add(250);
                } else if (s.kind === "gate" && hard) hitGate();
                else if (s.kind === "troll" && hard && s.troll.up) hitTroll(s.troll);
                else if (s.kind === "damsel" && hard && s.damsel.up) hitDamsel(s.damsel);
            }

            for (const b of bumpers) {
                const dx = ball.x - b.x, dy = ball.y - b.y;
                const dist = Math.hypot(dx, dy);
                if (dist >= R + b.r || dist === 0) continue;
                const nx = dx / dist, ny = dy / dist;
                ball.x = b.x + nx * (R + b.r);
                ball.y = b.y + ny * (R + b.r);
                const vn = ball.vx * nx + ball.vy * ny;
                const kick = 330;
                if (vn < kick) { ball.vx += (kick - vn) * nx; ball.vy += (kick - vn) * ny; }
                b.flash = 0.12;
                add(1000);
            }

            for (const f of flippers) {
                const tip = flipTip(f);
                const q = closest(ball.x, ball.y, f.px, f.py, tip.x, tip.y);
                const dx = ball.x - q.x, dy = ball.y - q.y;
                const dist = Math.hypot(dx, dy);
                if (dist >= R + FLIP_R || dist === 0) continue;
                const nx = dx / dist, ny = dy / dist;
                ball.x = q.x + nx * (R + FLIP_R);
                ball.y = q.y + ny * (R + FLIP_R);
                // the flipper's own speed at the contact point gets added to the ball
                const sx = -f.omega * (q.y - f.py), sy = f.omega * (q.x - f.px);
                const rvx = ball.vx - sx, rvy = ball.vy - sy;
                const vn = rvx * nx + rvy * ny;
                if (vn < 0) {
                    ball.vx = rvx - 1.3 * vn * nx + sx;
                    ball.vy = rvy - 1.3 * vn * ny + sy;
                }
            }

            const speed = Math.hypot(ball.vx, ball.vy);
            if (speed > MAX_SPEED) { ball.vx *= MAX_SPEED / speed; ball.vy *= MAX_SPEED / speed; }

            // into the broken castle?
            if (gateHp <= 0 && ball.x > 68 && ball.x < 80 && ball.y < 54 && ball.y > 40) enterCastle();
            if (ball.y > H + 10) drain();
        }

        function closest(px, py, x1, y1, x2, y2) {
            const dx = x2 - x1, dy = y2 - y1;
            const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
            return { x: x1 + t * dx, y: y1 + t * dy };
        }

        // ----- drawing -----
        function draw(time) {
            ctx.drawImage(background, 0, DMD);
            ctx.save();
            ctx.translate(0, DMD);

            // castle door
            if (gateHp > 0) {
                ctx.fillStyle = COLORS.door;
                ctx.fillRect(68, 46, 12, 12);
                ctx.fillStyle = COLORS.doorDark;
                for (let x = 70; x < 80; x += 3) ctx.fillRect(x, 46, 1, 12);
                if (gateHp < 3) { ctx.fillStyle = "#000"; ctx.fillRect(71, 50, 2, 3); ctx.fillRect(74, 54, 3, 1); }
                if (gateHp < 2) { ctx.fillRect(76, 48, 2, 4); ctx.fillRect(69, 55, 3, 2); }
            } else {
                ctx.fillStyle = "#000";
                ctx.fillRect(68, 44, 12, 14);
                if (Math.floor(time / 250) % 2) { ctx.fillStyle = COLORS.wall; ctx.fillRect(72, 62, 4, 3); ctx.fillRect(73, 61, 2, 1); }
            }

            // bumpers
            for (const b of bumpers) {
                ctx.fillStyle = b.flash > 0 ? "#fff" : COLORS.bumper;
                disc(b.x, b.y, b.r);
                ctx.strokeStyle = COLORS.ring;
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 0.5, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = COLORS.ring;
                disc(b.x, b.y, 2);
            }

            // slingshots
            for (const s of slings) {
                ctx.fillStyle = s.flash > 0 ? "#fff" : COLORS.bumper;
                ctx.beginPath();
                ctx.moveTo(...s.pts[0]); ctx.lineTo(...s.pts[1]); ctx.lineTo(...s.pts[2]); ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = COLORS.wall; ctx.stroke();
            }

            // trolls
            for (const t of trolls) {
                if (t.up) {
                    ctx.fillStyle = COLORS.troll;
                    ctx.fillRect(t.x, t.y - 4, 8, 8);
                    ctx.fillStyle = "#000";
                    ctx.fillRect(t.x + 2, t.y - 2, 1, 1); ctx.fillRect(t.x + 5, t.y - 2, 1, 1);
                    ctx.fillRect(t.x + 2, t.y + 1, 4, 1);
                } else {
                    ctx.fillStyle = COLORS.stoneDark; ctx.fillRect(t.x, t.y + 2, 8, 2);
                }
            }

            // damsel drop targets
            for (const d of damsels) {
                ctx.fillStyle = d.up ? COLORS.damsel : "#3a1a28";
                ctx.fillRect(d.x, d.y, 5, 10);
                if (d.up) { ctx.fillStyle = "#fff"; ctx.fillRect(d.x + 1, d.y + 2, 3, 1); }
            }

            // flippers
            for (const f of flippers) {
                const tip = flipTip(f);
                ctx.lineCap = "round";
                ctx.strokeStyle = COLORS.flipperEdge; ctx.lineWidth = FLIP_R * 2;
                ctx.beginPath(); ctx.moveTo(f.px, f.py); ctx.lineTo(tip.x, tip.y); ctx.stroke();
                ctx.strokeStyle = COLORS.flipper; ctx.lineWidth = FLIP_R * 2 - 2;
                ctx.beginPath(); ctx.moveTo(f.px, f.py); ctx.lineTo(tip.x, tip.y); ctx.stroke();
            }

            // plunger
            const py = 291 + plungerPull * 7;
            ctx.fillStyle = COLORS.stoneDark;
            for (let y = py + 1; y < 299; y += 2) ctx.fillRect(147, y, 6, 1);
            ctx.fillStyle = COLORS.bumper;
            ctx.fillRect(146, py - 1, 8, 2);

            // ball
            if (ball && !ball.captured) {
                ctx.fillStyle = COLORS.ball; disc(ball.x, ball.y, R);
                ctx.fillStyle = "#fff"; ctx.fillRect(Math.round(ball.x - 1.5), Math.round(ball.y - 1.5), 1, 1);
            }
            ctx.restore();

            drawDmd(time);
        }

        function disc(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

        function drawDmd(time) {
            ctx.fillStyle = COLORS.dmdBg;
            ctx.fillRect(0, 0, W, DMD);
            ctx.fillStyle = COLORS.dmdDim;
            for (let x = 1; x < W; x += 2) ctx.fillRect(x, 0, 1, DMD); // dot-matrix texture
            const c = COLORS.dmd;
            if (state === "initials") {
                centerText(ctx, "HIGH SCORE! INITIALS:", 2, 1, c);
                const blink = Math.floor(time / 300) % 2;
                initials.forEach((ch, i) => {
                    if (i === initialIdx && blink) return;
                    text(ctx, i < initialIdx || i === initialIdx ? ch : "_", 56 + i * 18, 10, 3, c);
                });
                return;
            }
            if (message) { centerText(ctx, message, 10, message.length > 18 ? 1 : 2, c); return; }
            if (state === "play") {
                const s = fmt(score);
                centerText(ctx, s, 5, s.length > 9 ? 2 : 3, c);
                text(ctx, `BALL ${BALLS_PER_GAME - ballsLeft + 1}`, 2, 20, 1, c);
                return;
            }
            // attract mode
            centerText(ctx, "SMOOG'S CASTLE", 3, 2, c);
            const top = highScores[0];
            const line = Math.floor(time / 2500) % 2 === 0 || !top
                ? "PULL PLUNGER TO PLAY"
                : `HIGH SCORE ${top.initials} ${fmt(top.score)}`;
            centerText(ctx, line, 17, 1, c);
        }

        // ----- input -----
        const pointers = new Map(); // pointerId → "left" | "right" | {plunger}
        function toWorld(e) {
            const r = canvas.getBoundingClientRect();
            return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * (H + DMD)) / r.height - DMD };
        }
        function press(side, down) {
            if (state === "initials") {
                if (!down) return;
                if (side === "left") initials[initialIdx] = String.fromCharCode(((initials[initialIdx].charCodeAt(0) - 65 + 1) % 26) + 65);
                else { initialIdx++; if (initialIdx > 2) { initialIdx = 2; submitInitials(); } }
                return;
            }
            flippers[side === "left" ? 0 : 1].pressed = down;
        }
        canvas.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            canvas.focus({ preventScroll: true });
            canvas.setPointerCapture(e.pointerId);
            const p = toWorld(e);
            if (p.x > 138 && p.y > 240 && state !== "initials") {
                pointers.set(e.pointerId, { plunger: true, startY: p.y });
            } else {
                const side = p.x < 74 ? "left" : "right";
                pointers.set(e.pointerId, side);
                press(side, true);
            }
        });
        canvas.addEventListener("pointermove", (e) => {
            const info = pointers.get(e.pointerId);
            if (info && info.plunger) plungerPull = Math.max(0, Math.min(1, (toWorld(e).y - info.startY) / 24));
        });
        const release = (e) => {
            const info = pointers.get(e.pointerId);
            if (!info) return;
            pointers.delete(e.pointerId);
            if (info.plunger) launch();
            else press(info, false);
        };
        canvas.addEventListener("pointerup", release);
        canvas.addEventListener("pointercancel", release);

        const LEFT_KEYS = ["q", "Q", "z", "Z", "ArrowLeft"];
        const RIGHT_KEYS = ["e", "E", "m", "M", "/", "ArrowRight"];
        let plungerKeyHeld = false;
        canvas.addEventListener("keydown", (e) => {
            const k = e.key;
            if (state === "initials" && /^[a-z]$/i.test(k)) {
                initials[initialIdx] = k.toUpperCase();
                initialIdx++;
                if (initialIdx > 2) { initialIdx = 2; submitInitials(); }
                e.preventDefault();
                return;
            }
            if (state === "initials" && k === "Backspace") { initialIdx = Math.max(0, initialIdx - 1); e.preventDefault(); return; }
            if (LEFT_KEYS.includes(k)) { if (!e.repeat) press("left", true); e.preventDefault(); }
            else if (RIGHT_KEYS.includes(k)) { if (!e.repeat) press("right", true); e.preventDefault(); }
            else if (k === " " || k === "ArrowDown") { plungerKeyHeld = true; e.preventDefault(); }
        });
        canvas.addEventListener("keyup", (e) => {
            const k = e.key;
            if (LEFT_KEYS.includes(k)) press("left", false);
            else if (RIGHT_KEYS.includes(k)) press("right", false);
            else if (k === " " || k === "ArrowDown") { plungerKeyHeld = false; launch(); }
        });
        canvas.addEventListener("blur", () => { flippers.forEach((f) => (f.pressed = false)); plungerKeyHeld = false; });

        // ----- main loop -----
        let last = performance.now();
        function frame(now) {
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            if (plungerKeyHeld) plungerPull = Math.min(1, plungerPull + dt * 1.5);

            const steps = Math.max(1, Math.round(dt / STEP));
            for (let i = 0; i < steps; i++) physics(dt / steps);

            // unstick a ball that stopped somewhere silly
            // (not near the flippers: a ball resting there is you holding it)
            if (state === "play" && ball && !ball.captured && !ballInLane() && ball.y < 240 && Math.hypot(ball.vx, ball.vy) < 8) {
                stuckTime += dt;
                if (stuckTime > 1.5) { ball.vx = (ball.x < 74 ? 1 : -1) * (80 + Math.random() * 80); ball.vy = -260; stuckTime = 0; } // nudge toward the middle
            } else stuckTime = 0;

            for (let i = timers.length - 1; i >= 0; i--) {
                timers[i][0] -= dt;
                if (timers[i][0] <= 0) { const fn = timers[i][1]; timers.splice(i, 1); fn(); }
            }
            if (messageTime > 0) { messageTime -= dt; if (messageTime <= 0) message = null; }
            bumpers.forEach((b) => (b.flash -= dt));
            slings.forEach((s) => (s.flash -= dt));

            if (canvas.isConnected) draw(now);
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
        showScores();

        // for testing in the console
        wrap.pinball = {
            get state() { return state; }, get score() { return score; }, get ball() { return ball; }, get ballsLeft() { return ballsLeft; }, flippers,
            // fast-forward physics (for testing): returns where the ball sat still for over a second, if anywhere
            sim(seconds) {
                let still = 0;
                for (let t = 0; t < seconds; t += STEP) {
                    physics(STEP);
                    if (!ball || ball.y > 250) return null;
                    still = Math.hypot(ball.vx, ball.vy) < 8 && !ballInLane() ? still + STEP : 0;
                    if (still > 1) return { x: Math.round(ball.x), y: Math.round(ball.y) };
                }
                return null;
            },
        };
        return wrap;
    }

    // The parts that never move get drawn once.
    function drawBackground() {
        const c = document.createElement("canvas");
        c.width = W; c.height = H;
        const g = c.getContext("2d");
        g.fillStyle = COLORS.bg; g.fillRect(0, 0, W, H);

        // checkered castle floor near the flippers
        for (let y = 170; y < H; y += 10) {
            for (let x = 4; x < 144; x += 10) {
                g.fillStyle = ((x - 4) / 10 + (y - 170) / 10) % 2 ? COLORS.tileA : COLORS.tileB;
                g.fillRect(x, y, 10, 10);
            }
        }
        g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(4, 170, 140, 130);
        // shooter lane floor
        g.fillStyle = "#12040d"; g.fillRect(144, 70, 12, 230);

        // castle
        g.fillStyle = COLORS.stone;
        g.fillRect(58, 30, 32, 28); g.fillRect(58, 22, 6, 8); g.fillRect(84, 22, 6, 8);
        g.fillStyle = COLORS.stoneDark;
        for (let y = 33; y < 58; y += 4) for (let x = 59 + (Math.floor(y / 4) % 2) * 3; x < 89; x += 6) g.fillRect(x, y, Math.min(4, 89 - x), 1);
        for (const x of [58, 61, 84, 87]) g.fillRect(x, 20, 2, 2);          // tower crenellations
        for (let x = 64; x < 84; x += 4) g.fillRect(x, 28, 2, 2);          // wall crenellations
        g.fillStyle = "#000"; g.fillRect(60, 25, 2, 3); g.fillRect(86, 25, 2, 3); // tower windows
        g.fillStyle = COLORS.bumper; g.fillRect(73, 14, 1, 16); g.fillRect(74, 14, 5, 3);  // flag

        // lane arrows
        g.fillStyle = COLORS.wallDim;
        for (const [x, y] of [[74, 80], [74, 92], [74, 104]]) { g.fillRect(x - 3, y, 7, 1); g.fillRect(x - 2, y - 1, 5, 1); g.fillRect(x - 1, y - 2, 3, 1); g.fillRect(x, y - 3, 1, 1); }

        // table name in the middle
        text(g, "SMOOG", 54, 156, 2, "rgba(255,225,0,0.35)");

        // walls
        g.strokeStyle = COLORS.wall; g.lineWidth = 1;
        for (const s of walls) {
            if (s.kind !== "wall" || !s.on || s.hidden) continue;
            g.beginPath(); g.moveTo(s.x1, s.y1); g.lineTo(s.x2, s.y2); g.stroke();
        }
        for (const [x1, y1, x2, y2] of castleOutline) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
        return c;
    }

    window.createPinball = createPinball;
})();
