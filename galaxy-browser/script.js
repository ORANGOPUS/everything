const canvas = document.getElementById('galaxyCanvas');
const ctx = canvas.getContext('2d');
const tooltip = document.getElementById('tooltip');
const statusEl = document.getElementById('status');

let planets = [];
let stars = [];
let angle = 0;
let animationId = null;

// ── Canvas sizing ──────────────────────────────────────────────────────────────
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    generateStars();
}

window.addEventListener('resize', resize);
resize();

// ── Stars background ──────────────────────────────────────────────────────────
function generateStars() {
    stars = [];
    const count = Math.floor((canvas.width * canvas.height) / 3500);
    for (let i = 0; i < count; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 1.4 + 0.2,
            alpha: Math.random() * 0.7 + 0.3,
            twinkleSpeed: Math.random() * 0.02 + 0.005,
            twinkleOffset: Math.random() * Math.PI * 2
        });
    }
}

function drawStars(tick) {
    stars.forEach(s => {
        const alpha = s.alpha * (0.6 + 0.4 * Math.sin(tick * s.twinkleSpeed + s.twinkleOffset));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
        ctx.fill();
    });
}

// ── Planet colors ─────────────────────────────────────────────────────────────
const PALETTE = [
    '#4fc3f7', '#81c784', '#ff8a65', '#ce93d8',
    '#fff176', '#80cbc4', '#f48fb1', '#a5d6a7',
    '#ffcc02', '#b39ddb', '#80deea'
];

// ── Search ────────────────────────────────────────────────────────────────────
document.getElementById('searchBtn').addEventListener('click', doSearch);
document.getElementById('searchQuery').addEventListener('keydown', e => {
    if (e.key === 'Enter') doSearch();
});

async function doSearch() {
    const query = document.getElementById('searchQuery').value.trim();
    if (!query) return;

    statusEl.textContent = 'Searching the galaxy…';
    planets = [];

    try {
        // DuckDuckGo Instant Answer API (no key required)
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        // Collect results: RelatedTopics may contain nested topic groups
        const rawTopics = [];
        (data.RelatedTopics || []).forEach(item => {
            if (item.FirstURL && item.Text) {
                rawTopics.push(item);
            } else if (Array.isArray(item.Topics)) {
                item.Topics.forEach(sub => {
                    if (sub.FirstURL && sub.Text) rawTopics.push(sub);
                });
            }
        });

        const results = rawTopics.slice(0, 12);

        if (results.length === 0) {
            statusEl.textContent = 'No results found — try a different query.';
            return;
        }

        // Build planets
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const baseOrbit = Math.min(cx, cy) * 0.22;
        const orbitStep = Math.min(cx, cy) * 0.07;

        planets = results.map((result, i) => ({
            url: result.FirstURL,
            title: result.Text,
            radius: Math.min(22, Math.max(10, 10 + Math.floor(result.Text.length / 18))),
            color: PALETTE[i % PALETTE.length],
            orbitRadius: baseOrbit + i * orbitStep,
            angleOffset: (i / results.length) * Math.PI * 2,
            speed: 0.004 + (results.length - i) * 0.0003,
            x: 0,
            y: 0
        }));

        statusEl.textContent = `${results.length} result${results.length !== 1 ? 's' : ''} found — click a planet to visit`;

        // Start/restart animation loop
        if (animationId) cancelAnimationFrame(animationId);
        animationId = null;
        angle = 0;
        draw();
    } catch (err) {
        console.error(err);
        statusEl.textContent = 'Search failed — check your connection and try again.';
    }
}

// ── Draw loop ─────────────────────────────────────────────────────────────────
let tick = 0;

function draw() {
    animationId = requestAnimationFrame(draw);
    tick++;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawStars(tick);

    if (planets.length === 0) return;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // Glowing sun at centre
    const sunGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28);
    sunGrad.addColorStop(0, 'rgba(255,240,100,0.95)');
    sunGrad.addColorStop(0.5, 'rgba(255,180,0,0.6)');
    sunGrad.addColorStop(1, 'rgba(255,100,0,0)');
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    ctx.fillStyle = sunGrad;
    ctx.fill();

    angle += 0.01;

    planets.forEach(planet => {
        const a = angle * planet.speed / 0.01 + planet.angleOffset;
        const x = cx + Math.cos(a) * planet.orbitRadius;
        const y = cy + Math.sin(a) * planet.orbitRadius * 0.42; // elliptical orbit

        // Orbit ring
        ctx.beginPath();
        ctx.ellipse(cx, cy, planet.orbitRadius, planet.orbitRadius * 0.42, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Planet glow
        const glow = ctx.createRadialGradient(x, y, 0, x, y, planet.radius * 2.2);
        glow.addColorStop(0, planet.color + 'cc');
        glow.addColorStop(1, planet.color + '00');
        ctx.beginPath();
        ctx.arc(x, y, planet.radius * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Planet body
        ctx.beginPath();
        ctx.arc(x, y, planet.radius, 0, Math.PI * 2);
        ctx.fillStyle = planet.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Planet label (short)
        const label = planet.title.split(' ').slice(0, 3).join(' ');
        ctx.font = `11px 'Segoe UI', Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(label, x, y + planet.radius + 14);

        planet.x = x;
        planet.y = y;
    });
}

// ── Idle starfield when no search yet ─────────────────────────────────────────
function idleLoop() {
    animationId = requestAnimationFrame(idleLoop);
    tick++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawStars(tick);
}
idleLoop();

// ── Tooltip & click ───────────────────────────────────────────────────────────
canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let hovered = null;
    planets.forEach(p => {
        const d = Math.hypot(mx - p.x, my - p.y);
        if (d < p.radius + 6) hovered = p;
    });

    if (hovered) {
        tooltip.textContent = hovered.title;
        const tx = Math.min(e.clientX + 14, window.innerWidth - 300);
        const ty = Math.min(e.clientY + 14, window.innerHeight - 80);
        tooltip.style.left = tx + 'px';
        tooltip.style.top = ty + 'px';
        tooltip.classList.add('visible');
        canvas.style.cursor = 'pointer';
    } else {
        tooltip.classList.remove('visible');
        canvas.style.cursor = 'default';
    }
});

canvas.addEventListener('mouseleave', () => {
    tooltip.classList.remove('visible');
    canvas.style.cursor = 'default';
});

canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    planets.forEach(p => {
        const d = Math.hypot(cx - p.x, cy - p.y);
        if (d < p.radius + 6 && p.url && p.url !== '#') {
            window.open(p.url, '_blank', 'noopener,noreferrer');
        }
    });
});
