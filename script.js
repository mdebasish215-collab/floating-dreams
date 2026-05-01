// ─── Tracks List ─────────────────────────────────────
const TRACKS = [
    { id: 'dSPocMXYd-8', name: 'Tate Jebe Dekhe', artist: 'Kuldeep & Ananya' },
    { id: '1pSPZAGeO3w', name: 'Hum Dum', artist: 'Shiddat' },
    { id: 'zQxq2oqYrgM', name: 'Raataan Lambiyan (Lofi)', artist: 'Shershaah' },
    { id: 'HLW8DepLaEg', name: 'Tum Hi Ho (Lofi)', artist: 'Aashiqui 2' },
    { id: '532toSHe57E', name: 'Kesariya (Lofi)', artist: 'Brahmastra' }
];

// ─── State ────────────────────────────────────────────
let trackIdx       = 0;
let isPlaying      = false;
let carouselImgs   = [];
let carouselDots   = [];
let slideIdx       = 0;
let slideTimer     = null;
let adminAuthed    = false;
let pendingPlay    = false;   // queued play request before user interaction

// ─── YouTube IFrame API ───────────────────────────────
let ytPlayer = null;
let ytPlayerReady = false;

window.onYouTubeIframeAPIReady = function() {
    ytPlayer = new YT.Player('youtube-player', {
        height: '0',
        width: '0',
        videoId: TRACKS[trackIdx] ? TRACKS[trackIdx].id : '1pSPZAGeO3w',
        playerVars: {
            'autoplay': 0,
            'controls': 0,
            'disablekb': 1,
            'fs': 0,
            'rel': 0,
            'showinfo': 0,
            'modestbranding': 1,
            'playsinline': 1
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
        }
    });
};

function onPlayerReady(event) {
    ytPlayerReady = true;
    if (pendingPlay) {
        safePlay();
        pendingPlay = false;
    }
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        isPlaying = true;
        document.getElementById('btn-play').textContent = '⏸';
        updateActiveTrack();
    } else if (event.data === YT.PlayerState.PAUSED) {
        isPlaying = false;
        document.getElementById('btn-play').textContent = '▶';
    } else if (event.data === YT.PlayerState.ENDED) {
        nextTrack();
    }
}

function onPlayerError(event) {
    console.warn('YouTube Player Error:', event.data, '. Skipping to next track...');
    setTimeout(nextTrack, 1200);
}

// Safe play: handles browser gesture requirements
function safePlay() {
    if (!ytPlayerReady) {
        pendingPlay = true;
        return;
    }
    ytPlayer.playVideo();
}

// ─── Enter Gate ───────────────────────────────────────
document.getElementById('enter-btn').addEventListener('click', function () {
    const overlay = document.getElementById('enter-overlay');
    overlay.classList.add('hidden');
    setTimeout(() => { overlay.style.display = 'none'; }, 900);

    // Start music — triggered by user gesture (unlocks audio on Android/iOS)
    safePlay();
    document.getElementById('btn-play').textContent = '⏸';
    isPlaying = true;

    // Animate hero in
    gsap.to('.hero-title', { opacity: 1, y: 0, duration: 1.4, ease: 'power4.out', delay: 0.2 });

    // Confetti burst
    confetti({ particleCount: 180, spread: 80, origin: { y: 0.6 } });
});

// ─── Config Fetch ─────────────────────────────────────
async function fetchConfig() {
    try {
        const res = await fetch('/api/config');
        if (!res.ok) throw new Error('API error ' + res.status);
        const data = await res.json();

        // Override default track if admin set one
        if (data.default_song_id) {
            const idx = TRACKS.findIndex(t => t.id === data.default_song_id);
            if (idx >= 0) trackIdx = idx;
            else {
                TRACKS.unshift({ id: data.default_song_id, name: 'Admin Pick', artist: '♥' });
                trackIdx = 0;
            }
        }

        // Admin song input prefill
        const songInput = document.getElementById('admin-song-id');
        if (songInput) songInput.value = data.default_song_id || '';

        // Rebuild track list UI with updated trackIdx
        buildTrackList();
        updateNowPlaying();

        // Load the correct video into the player (no autoplay yet)
        if (ytPlayerReady) {
            ytPlayer.cueVideoById(TRACKS[trackIdx].id);
        }

        // Photos carousel
        if (data.photos && data.photos.length > 0) {
            buildCarousel(data.photos.map(p => p.path));
        }
    } catch (err) {
        console.warn('Config fetch failed, using defaults:', err);
    }
}

// ─── Carousel ─────────────────────────────────────────
function buildCarousel(paths) {
    const frame = document.getElementById('hero-carousel');
    const dots  = document.getElementById('carousel-dots');
    frame.innerHTML = '';
    dots.innerHTML  = '';
    carouselImgs = [];
    carouselDots = [];

    paths.forEach((p, i) => {
        const img = document.createElement('img');
        img.src = p;
        img.alt = 'Memory ' + (i + 1);
        if (i === 0) img.classList.add('active');
        frame.appendChild(img);
        carouselImgs.push(img);

        const dot = document.createElement('span');
        if (i === 0) dot.classList.add('active');
        dot.addEventListener('click', () => goToSlide(i));
        dots.appendChild(dot);
        carouselDots.push(dot);
    });

    slideIdx = 0;
    if (paths.length > 1) startCarousel();
}

function goToSlide(n) {
    if (!carouselImgs.length) return;
    carouselImgs[slideIdx].classList.remove('active');
    carouselDots[slideIdx].classList.remove('active');
    slideIdx = n;
    carouselImgs[slideIdx].classList.add('active');
    carouselDots[slideIdx].classList.add('active');
}

function startCarousel() {
    if (slideTimer) clearInterval(slideTimer);
    slideTimer = setInterval(() => {
        goToSlide((slideIdx + 1) % carouselImgs.length);
    }, 4000);
}

// ─── Music Controls ───────────────────────────────────
function updateNowPlaying() {
    const t = TRACKS[trackIdx];
    if (!t) return;
    document.getElementById('now-playing-name').textContent = `${t.name} — ${t.artist}`;
}

function updateActiveTrack() {
    document.querySelectorAll('.track-item').forEach((el, i) => {
        el.classList.toggle('active', i === trackIdx);
    });
}

function buildTrackList() {
    const list = document.getElementById('track-list');
    list.innerHTML = '';
    TRACKS.forEach((t, i) => {
        const el = document.createElement('div');
        el.className = 'track-item' + (i === trackIdx ? ' active' : '');
        el.innerHTML = `<span class="track-icon">🎵</span> <span>${t.name} — <em>${t.artist}</em></span>`;
        el.addEventListener('click', () => {
            trackIdx = i;
            loadTrack(true);
        });
        list.appendChild(el);
    });
}

function loadTrack(autoPlay = false) {
    const t = TRACKS[trackIdx];
    updateNowPlaying();
    updateActiveTrack();

    if (ytPlayerReady) {
        if (autoPlay) {
            ytPlayer.loadVideoById(t.id);
        } else {
            ytPlayer.cueVideoById(t.id);
        }
    }
}

function nextTrack() {
    trackIdx = (trackIdx + 1) % TRACKS.length;
    loadTrack(true);
}

function prevTrack() {
    trackIdx = (trackIdx - 1 + TRACKS.length) % TRACKS.length;
    loadTrack(true);
}

document.getElementById('btn-play').addEventListener('click', () => {
    if (isPlaying && ytPlayerReady) {
        ytPlayer.pauseVideo();
    } else {
        safePlay();
    }
});

document.getElementById('btn-next').addEventListener('click', nextTrack);
document.getElementById('btn-prev').addEventListener('click', prevTrack);

// ─── Physics Canvas ───────────────────────────────────
(function initCanvas() {
    const canvas = document.getElementById('physics-canvas');
    const ctx = canvas.getContext('2d');
    const resize = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
    window.addEventListener('resize', resize); resize();

    const particles = Array.from({ length: 28 }, () => ({
        x: Math.random() * innerWidth,
        y: Math.random() * innerHeight,
        r: Math.random() * 8 + 4,
        vy: Math.random() * 0.35 + 0.15,
        alpha: Math.random() * 0.25 + 0.1,
    }));

    (function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(194,30,86,${p.alpha})`;
            ctx.fill();
            p.y += p.vy;
            if (p.y > canvas.height + 20) { p.y = -20; p.x = Math.random() * canvas.width; }
        });
        requestAnimationFrame(draw);
    })();
})();

// ─── Scratch Card ─────────────────────────────────────
(function initScratch() {
    const sc = document.getElementById('scratch-canvas');
    if (!sc) return;
    const ctx = sc.getContext('2d');
    const box = document.getElementById('scratch-container');
    let down = false;

    const init = () => {
        sc.width  = box.offsetWidth;
        sc.height = box.offsetHeight;
        ctx.fillStyle = '#D4AF37';
        ctx.fillRect(0, 0, sc.width, sc.height);
        ctx.globalCompositeOperation = 'destination-out';
    };

    const getPos = (e) => {
        const r = sc.getBoundingClientRect();
        const src = e.touches ? e.touches[0] : e;
        return { x: src.clientX - r.left, y: src.clientY - r.top };
    };

    const scratch = (e) => {
        if (!down) return;
        const { x, y } = getPos(e);
        const guide = document.querySelector('.scratch-here-layer');
        if (guide) guide.style.display = 'none';
        ctx.beginPath(); ctx.arc(x, y, 38, 0, Math.PI * 2); ctx.fill();
        checkDone();
    };

    const checkDone = () => {
        const px = ctx.getImageData(0, 0, sc.width, sc.height).data;
        let cleared = 0;
        for (let i = 3; i < px.length; i += 4) if (px[i] === 0) cleared++;
        if (cleared / (px.length / 4) > 0.5) {
            gsap.to(sc, { opacity: 0, duration: 1, onComplete: () => sc.remove() });
            confetti({ particleCount: 220, spread: 90, origin: { y: 0.75 } });
        }
    };

    sc.addEventListener('mousedown',  ()  => down = true);
    window.addEventListener('mouseup', () => down = false);
    sc.addEventListener('mousemove',  scratch);
    sc.addEventListener('touchstart', e => { down = true; scratch(e); },             { passive: true });
    sc.addEventListener('touchmove',  e => { e.preventDefault(); scratch(e); },      { passive: false });
    sc.addEventListener('touchend',   ()  => down = false);
    init();
    window.addEventListener('resize', init);
})();

// ─── Love Bubbles ─────────────────────────────────────
(function initBubbles() {
    const container = document.getElementById('bubble-container');
    const isMobile  = window.matchMedia('(pointer: coarse)').matches;

    const reasons = [
        'Your contagious laugh', 'How you care for everyone', 'The sparkle in your eyes',
        'Your incredible strength', "You're my best friend", 'Your kindness',
        'How you make me better', 'Your beautiful soul', 'Our shared memories',
        'Your silly jokes', 'The way you look at me', 'Your intelligence'
    ];

    reasons.forEach(text => {
        const el = document.createElement('div');
        el.className = 'bubble';
        el.textContent = text;
        const sz = Math.random() * 45 + 100;
        el.style.cssText = `width:${sz}px;height:${sz}px;font-size:${sz / 10}px;left:${Math.random() * 82 + 4}%;top:${Math.random() * 72 + 4}%`;
        container.appendChild(el);

        // Only enable dragging on desktop — on mobile bubbles block scroll
        if (!isMobile) {
            Draggable.create(el, { bounds: container });
        }

        gsap.to(el, { y: '+=14', duration: 2.2 + Math.random() * 1.8, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    });
})();

// ─── Admin Modal ──────────────────────────────────────
const adminModal = document.getElementById('admin-modal');
document.getElementById('admin-trigger').addEventListener('click', openAdmin);

function openAdmin() { adminModal.classList.add('visible'); }
window.closeAdmin = () => { adminModal.classList.remove('visible'); };

adminModal.addEventListener('click', e => { if (e.target === adminModal) closeAdmin(); });

window.adminLogin = async () => {
    const pass = document.getElementById('admin-password').value.trim();
    if (!pass) return;
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pass })
        });
        const data = await res.json();
        if (data.status === 'success') {
            adminAuthed = true;
            document.getElementById('login-view').style.display    = 'none';
            document.getElementById('dashboard-view').style.display = 'block';
            loadAdminPhotos();
        } else {
            shake('#admin-password');
            alert('Wrong password! Try: love2026');
        }
    } catch { alert('Server error — is Flask running?'); }
};

async function loadAdminPhotos() {
    try {
        const res  = await fetch('/api/config');
        const data = await res.json();
        const grid = document.getElementById('admin-photo-list');
        grid.innerHTML = '';

        const photos = data.photos || [];

        if (photos.length === 0) {
            grid.innerHTML = '<p style="color:#aaa;font-size:.85rem;grid-column:1/-1;text-align:center;padding:10px;">No photos uploaded yet.</p>';
            return;
        }

        photos.forEach(p => {
            const div = document.createElement('div');
            div.className = 'admin-photo-item';

            const img = document.createElement('img');
            img.src = p.path;
            img.alt = 'memory';
            img.loading = 'lazy';

            const btn       = document.createElement('button');
            btn.className   = 'del-btn';
            btn.title       = 'Click to delete';
            btn.textContent = '✕';

            let confirmed  = false;
            let resetTimer = null;

            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!confirmed) {
                    confirmed            = true;
                    btn.textContent      = '?';
                    btn.style.background = '#e74c3c';
                    btn.title            = 'Click again to confirm delete';
                    resetTimer = setTimeout(() => {
                        confirmed            = false;
                        btn.textContent      = '✕';
                        btn.style.background = '';
                        btn.title            = 'Click to delete';
                    }, 2500);
                } else {
                    clearTimeout(resetTimer);
                    btn.textContent      = '⏳';
                    btn.disabled         = true;
                    btn.style.background = '#999';
                    try {
                        const r = await fetch(`/api/photo/${p.id}`, { method: 'DELETE' });
                        if (r.ok) {
                            div.style.transition = 'opacity .3s, transform .3s';
                            div.style.opacity    = '0';
                            div.style.transform  = 'scale(.8)';
                            setTimeout(() => { loadAdminPhotos(); fetchConfig(); }, 320);
                        } else {
                            btn.textContent      = '✕';
                            btn.disabled         = false;
                            btn.style.background = '';
                            alert('Delete failed — please try again.');
                        }
                    } catch {
                        btn.textContent      = '✕';
                        btn.disabled         = false;
                        btn.style.background = '';
                        alert('Network error.');
                    }
                }
            });

            div.appendChild(img);
            div.appendChild(btn);
            grid.appendChild(div);
        });
    } catch { /* silent */ }
}

window.deletePhoto = async (id) => {
    if (!confirm('Delete this memory?')) return;
    await fetch(`/api/photo/${id}`, { method: 'DELETE' });
    loadAdminPhotos();
    fetchConfig();
};

window.clearAllPhotos = async () => {
    if (!confirm('Are you sure you want to delete ALL photos? This cannot be undone!')) return;
    const btn = document.getElementById('clear-all-photos-btn');
    const oldText = btn.innerHTML;
    btn.innerHTML = '⏳ Clearing...';
    btn.disabled = true;
    try {
        const res = await fetch('/api/photo/all', { method: 'DELETE' });
        if (res.ok) {
            loadAdminPhotos();
            fetchConfig();
            alert('All photos cleared!');
        } else {
            alert('Failed to clear photos.');
        }
    } catch {
        alert('Network error.');
    }
    btn.innerHTML = oldText;
    btn.disabled = false;
};

window.uploadGfPhotos = async () => {
    const input = document.getElementById('admin-photo-upload');
    if (!input.files.length) { alert('Please select at least one photo!'); return; }
    const fd = new FormData();
    Array.from(input.files).forEach(f => fd.append('photos', f));
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (res.ok) { alert('✨ Photos uploaded!'); input.value = ''; loadAdminPhotos(); fetchConfig(); }
    else alert('Upload failed — check the server.');
};

window.updateDefaultSettings = async () => {
    const id = document.getElementById('admin-song-id').value.trim();
    if (!id) { alert('Enter a YouTube Video ID first!'); return; }
    const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song_id: id })
    });
    if (res.ok) {
        alert('Song updated! ✨');
        if (ytPlayerReady) {
            ytPlayer.loadVideoById(id);
        } else {
            TRACKS[trackIdx] = { id: id, name: 'Admin Pick', artist: '♥' };
        }
    } else alert('Failed to update song.');
};

function shake(selector) {
    gsap.to(selector, {
        x: -8, duration: .08, repeat: 5, yoyo: true,
        ease: 'power1.inOut', onComplete: () => gsap.set(selector, { x: 0 })
    });
}

// ─── Init ─────────────────────────────────────────────
fetchConfig();
buildTrackList();

// ─── Magical Custom Cursor ────────────────────────────
(function initCursor() {
    const cursor = document.getElementById('custom-cursor');
    if (!cursor) return;
    let cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    let heartTimer = null;

    document.addEventListener('mousemove', (e) => {
        cx = e.clientX; cy = e.clientY;
        cursor.style.left = cx + 'px';
        cursor.style.top  = cy + 'px';
    });

    // Spawn floating hearts on movement (throttled)
    document.addEventListener('mousemove', (e) => {
        if (heartTimer) return;
        heartTimer = setTimeout(() => {
            heartTimer = null;
            const symbols = ['💖', '✨', '💕', '🌸', '💗'];
            const h = document.createElement('span');
            h.className = 'cursor-heart';
            h.textContent = symbols[Math.floor(Math.random() * symbols.length)];
            h.style.left = (e.clientX + (Math.random() * 16 - 8)) + 'px';
            h.style.top  = (e.clientY + (Math.random() * 16 - 8)) + 'px';
            document.body.appendChild(h);
            setTimeout(() => h.remove(), 950);
        }, 120);
    });

    // Also show cursor on touch devices as a sparkle
    document.addEventListener('touchmove', (e) => {
        const t = e.touches[0];
        cursor.style.left = t.clientX + 'px';
        cursor.style.top  = t.clientY + 'px';
    }, { passive: true });
})();

// ─── 3D Tilt Effect on Glass Cards ───────────────────
(function initTilt() {
    document.querySelectorAll('.glass-container').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const r = card.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width  - 0.5;
            const y = (e.clientY - r.top)  / r.height - 0.5;
            card.style.transform = `perspective(800px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) scale(1.02)`;
            card.style.boxShadow = `${-x * 20}px ${y * 20}px 40px rgba(194,30,86,0.2), 0 8px 32px rgba(194,30,86,0.15)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform  = '';
            card.style.boxShadow  = '';
        });
    });
})();

// ─── Audio Visualizer ─────────────────────────────────
(function initVisualizer() {
    const bars = document.querySelectorAll('.viz-bar');
    function startViz() { bars.forEach(b => b.classList.add('dancing')); }
    function stopViz()  { bars.forEach(b => b.classList.remove('dancing')); }

    // Hook into the existing YT state change
    const origStateChange = window.onPlayerStateChange || function(){};
    window._vizStateHook = function(event) {
        if (event.data === YT.PlayerState.PLAYING) startViz();
        else stopViz();
    };

    // Patch onPlayerStateChange in script to also call our hook
    const _orig = onPlayerStateChange;
    window.onPlayerStateChange = function(event) {
        _orig(event);
        window._vizStateHook(event);
    };
})();

// ─── Typewriter Scroll Reveal ─────────────────────────
(function initTypewriterReveal() {
    const wraps = document.querySelectorAll('.typewriter-wrap');
    if (!wraps.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const idx = Array.from(wraps).indexOf(el);
                setTimeout(() => {
                    el.classList.add('visible');
                }, idx * 350);
                observer.unobserve(el);
            }
        });
    }, { threshold: 0.3 });

    wraps.forEach(w => observer.observe(w));
})();
