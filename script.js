/* TORCH ATL — Redesign interactions */

document.addEventListener('DOMContentLoaded', () => {

    /* Preloader */
    const preloader = document.getElementById('preloader');
    const hidePreloader = () => { preloader?.classList.add('hidden'); document.body.classList.remove('loading'); };
    window.addEventListener('load', () => setTimeout(hidePreloader, 1400));
    setTimeout(hidePreloader, 2600); // fallback if 'load' already fired

    /* Navbar scroll state */
    const navbar = document.getElementById('navbar');
    if (navbar) {
        const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 60);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
    }

    /* Fullscreen menu overlay */
    const burger = document.getElementById('nav-burger');
    const overlay = document.getElementById('menu-overlay');
    const closeBtn = document.getElementById('menu-close');
    const openMenu = () => {
        overlay.classList.add('active');
        burger.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
    };
    const closeMenu = () => {
        overlay.classList.remove('active');
        burger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    };
    if (burger && overlay && closeBtn) {
        burger.addEventListener('click', openMenu);
        closeBtn.addEventListener('click', closeMenu);
        overlay.querySelectorAll('.menu-link, .menu-member').forEach(l => l.addEventListener('click', closeMenu));
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
    }

    /* Hero slideshow */
    const slides = Array.from(document.querySelectorAll('.hero-slide'));
    if (slides.length > 1) {
        let idx = 0;
        setInterval(() => {
            slides[idx].classList.remove('is-active');
            idx = (idx + 1) % slides.length;
            slides[idx].classList.add('is-active');
        }, 5500);
    }

    /* Reveal on scroll */
    const revealEls = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
            entries.forEach(en => {
                if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
        revealEls.forEach(el => io.observe(el));
    } else {
        revealEls.forEach(el => el.classList.add('in'));
    }

    /* Animated stat counters */
    const stats = document.querySelectorAll('.stat-number[data-target]');
    const animateStat = (el) => {
        const target = parseInt(el.dataset.target, 10);
        const dur = 1600, start = performance.now();
        const fmt = (n) => n.toLocaleString('en-US');
        const tick = (now) => {
            const p = Math.min((now - start) / dur, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = fmt(Math.round(target * eased));
            if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    };
    if ('IntersectionObserver' in window) {
        const so = new IntersectionObserver((entries) => {
            entries.forEach(en => { if (en.isIntersecting) { animateStat(en.target); so.unobserve(en.target); } });
        }, { threshold: 0.5 });
        stats.forEach(s => so.observe(s));
    } else {
        stats.forEach(s => s.textContent = parseInt(s.dataset.target, 10).toLocaleString('en-US'));
    }

    /* Carousels */
    document.querySelectorAll('.carousel').forEach((car) => {
        const track = car.querySelector('.carousel-track');
        if (!track) return;
        const slides = Array.from(track.children);
        const n = slides.length;
        // blurred fill behind each (contained) image so nothing is cropped
        slides.forEach((s) => {
            const im = s.querySelector('img');
            if (im && !s.querySelector('.carousel-bg')) {
                const bg = document.createElement('div');
                bg.className = 'carousel-bg';
                bg.style.backgroundImage = 'url("' + im.getAttribute('src') + '")';
                s.insertBefore(bg, s.firstChild);
            }
        });
        const dotsWrap = car.querySelector('.carousel-dots');
        const mq = window.matchMedia('(max-width: 768px)');
        let idx = 0, timer = null, scrollRAF = null;
        const delay = parseInt(car.dataset.autoplay, 10) || 0;
        const dots = [];
        // large galleries: a "n / total" counter reads cleaner than dozens of wrapping dots
        const manyDots = n > 16;
        let counter = null;
        if (dotsWrap) {
            if (manyDots) {
                counter = document.createElement('span');
                counter.className = 'carousel-count';
                counter.textContent = '1 / ' + n;
                dotsWrap.appendChild(counter);
            } else {
                slides.forEach((_, i) => {
                    const b = document.createElement('button');
                    b.className = 'carousel-dot' + (i === 0 ? ' active' : '');
                    b.setAttribute('aria-label', 'Go to slide ' + (i + 1));
                    b.addEventListener('click', () => { goTo(i); restart(); });
                    dotsWrap.appendChild(b);
                    dots.push(b);
                });
            }
        }
        function setActive(i) { idx = (i + n) % n; dots.forEach((d, j) => d.classList.toggle('active', j === idx)); if (counter) counter.textContent = (idx + 1) + ' / ' + n; }
        function goTo(i) {
            setActive(i);
            if (mq.matches) {
                const s = slides[idx];
                track.scrollTo({ left: s.offsetLeft - (track.clientWidth - s.clientWidth) / 2, behavior: 'smooth' });
            } else {
                track.style.transform = 'translateX(-' + (idx * 100) + '%)';
            }
        }
        function play() { stop(); if (delay && n > 1 && !mq.matches) timer = setInterval(() => goTo(idx + 1), delay); }
        function stop() { clearInterval(timer); }
        function restart() { stop(); play(); }
        car.querySelector('.carousel-prev')?.addEventListener('click', () => { goTo(idx - 1); restart(); });
        car.querySelector('.carousel-next')?.addEventListener('click', () => { goTo(idx + 1); restart(); });
        car.addEventListener('mouseenter', stop);
        car.addEventListener('mouseleave', play);
        // desktop-only swipe (mobile uses native scroll-snap)
        let x0 = null;
        track.addEventListener('touchstart', (e) => { if (mq.matches) return; x0 = e.touches[0].clientX; stop(); }, { passive: true });
        track.addEventListener('touchend', (e) => {
            if (mq.matches || x0 === null) return;
            const dx = e.changedTouches[0].clientX - x0;
            if (Math.abs(dx) > 40) goTo(idx + (dx < 0 ? 1 : -1));
            x0 = null; play();
        }, { passive: true });
        // mobile: keep dots in sync with native scroll position
        track.addEventListener('scroll', () => {
            if (!mq.matches || scrollRAF) return;
            scrollRAF = requestAnimationFrame(() => {
                scrollRAF = null;
                const step = slides[0].offsetWidth + 10;
                setActive(Math.round(track.scrollLeft / step));
            });
        }, { passive: true });
        // switch cleanly between desktop transform mode and mobile scroll mode
        const applyMode = () => {
            stop();
            if (mq.matches) { track.style.transform = ''; }
            else { track.scrollLeft = 0; goTo(idx); play(); }
        };
        mq.addEventListener('change', applyMode);
        if (!mq.matches) play();
    });

    /* Tabs */
    document.querySelectorAll('.tabs').forEach((tabs) => {
        const root = tabs.closest('section') || document;
        const btns = Array.from(tabs.querySelectorAll('.tab'));
        btns.forEach((b) => b.addEventListener('click', () => {
            btns.forEach((x) => x.classList.toggle('active', x === b));
            const t = b.dataset.tab;
            root.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === 'panel-' + t));
        }));
    });

    /* Crossfade media (split sections) */
    document.querySelectorAll('.media-fade').forEach((mf) => {
        const imgs = Array.from(mf.querySelectorAll('img'));
        if (imgs.length < 2) return;
        let i = 0, timer = null;
        const show = (n) => {
            imgs[i].classList.remove('is-active');
            i = (n + imgs.length) % imgs.length;
            imgs[i].classList.add('is-active');
        };
        const start = () => { timer = setInterval(() => show(i + 1), 5000); };
        const restart = () => { clearInterval(timer); start(); };
        const container = mf.closest('.split-media') || mf.parentElement;
        const prev = container ? container.querySelector('.media-prev') : null;
        const next = container ? container.querySelector('.media-next') : null;
        if (prev) prev.addEventListener('click', (e) => { e.preventDefault(); show(i - 1); restart(); });
        if (next) next.addEventListener('click', (e) => { e.preventDefault(); show(i + 1); restart(); });
        start();
    });

    /* Lightbox for gallery / photo grids / mosaic */
    const lightbox = document.getElementById('lightbox');
    const lbImg = document.getElementById('lightbox-img');
    const lbItems = Array.from(document.querySelectorAll('.carousel-slide img, .gallery-item img, .photo-grid img, .mosaic-item img'));
    let lbIndex = 0;
    const showLb = (i) => {
        lbIndex = (i + lbItems.length) % lbItems.length;
        lbImg.src = lbItems[lbIndex].src;
        lbImg.alt = lbItems[lbIndex].alt || '';
    };
    const openLb = (i) => { showLb(i); lightbox.classList.add('active'); document.body.style.overflow = 'hidden'; };
    const closeLb = () => { lightbox.classList.remove('active'); document.body.style.overflow = ''; };
    lbItems.forEach((img, i) => img.addEventListener('click', () => openLb(i)));
    if (lightbox) {
        document.getElementById('lightbox-close').addEventListener('click', closeLb);
        document.getElementById('lightbox-prev').addEventListener('click', (e) => { e.stopPropagation(); showLb(lbIndex - 1); });
        document.getElementById('lightbox-next').addEventListener('click', (e) => { e.stopPropagation(); showLb(lbIndex + 1); });
        lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLb(); });
        document.addEventListener('keydown', (e) => {
            if (!lightbox.classList.contains('active')) return;
            if (e.key === 'Escape') closeLb();
            else if (e.key === 'ArrowLeft') showLb(lbIndex - 1);
            else if (e.key === 'ArrowRight') showLb(lbIndex + 1);
        });
    }

    /* Request to Reserve — Create / Gather / Stay two-step intake */
    const rform = document.getElementById('reserve-form');
    const rrPurpose = document.getElementById('rr-purpose');
    const rrDuration = document.getElementById('rr-duration');
    const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    const USE_CASES = {
        Create: ['Music camp / album lock-in', 'Brand shoot / commercial', 'Film / photo production', 'Podcast', 'Livestream / Stream House', 'Podcast / stream hybrid', 'Reaction / watch-party content', 'Gaming session', 'Creator collab', 'Other production'],
        Gather: ['Team off-site', 'Private dinner / hosted evening', 'Workshop / mastermind', 'Launch / listening evening', 'Industry gathering', 'Creator meetup / summit', 'Watch party / premiere', 'Tournament / gaming night', 'Brand-hosted creator evening', 'Other gathering'],
        Stay: ['Artist residency', 'Creator residency', 'Executive stay', 'Production stay', 'Talent accommodations', 'Stream-house weekend', 'Content-batching stay', 'Partnership residency (label / publisher / management)', 'Other stay']
    };
    const DURATIONS = {
        Create: ['Estate Day (12 hours)', 'Multi-Day (2–7 days)', 'Extended production'],
        Gather: [],
        Stay: ['3-Night Lockout', '4–7 Nights', 'Multi-week residency']
    };
    const STUDIO_USES = /music|podcast|stream|hybrid|other production/i;
    const CREATOR_USES = /stream|creator|reaction|gaming|watch|content-batching/i;

    const verticalGroup = document.querySelector('.rr-verticals');
    const purposeGroup = document.getElementById('rr-purpose-group');
    const durationGroup = document.getElementById('rr-duration-group');
    const eventHours = document.getElementById('rr-event-hours');
    const roomGroup = document.getElementById('rr-room-group');
    const platformsGroup = document.getElementById('rr-platforms-group');
    const orgEl = document.getElementById('rr-org');

    const fill = (sel, opts, keep) => {
        if (!sel) return;
        const prev = keep ? sel.value : '';
        sel.innerHTML = '<option value="">Select…</option>' + opts.map((o) => '<option value="' + escapeHtml(o) + '">' + escapeHtml(o) + '</option>').join('');
        if (prev && opts.includes(prev)) sel.value = prev;
    };
    const getVertical = () => { const f = rform && rform.elements['vertical']; return f ? f.value : ''; };

    const onPurpose = () => {
        const v = getVertical(); const u = rrPurpose ? rrPurpose.value : '';
        if (roomGroup) roomGroup.style.display = (v === 'Create' && STUDIO_USES.test(u)) ? '' : 'none';
        const creator = CREATOR_USES.test(u) || (orgEl && orgEl.value === 'Creator / Talent Management');
        if (platformsGroup) platformsGroup.style.display = creator ? '' : 'none';
    };
    const onVertical = () => {
        const v = getVertical();
        if (verticalGroup) verticalGroup.classList.remove('is-invalid');
        if (purposeGroup) purposeGroup.style.display = v ? '' : 'none';
        fill(rrPurpose, USE_CASES[v] || [], true);
        fill(rrDuration, DURATIONS[v] || [], true);
        const hosted = v === 'Gather';
        if (durationGroup) durationGroup.style.display = (v && !hosted) ? '' : 'none';
        if (eventHours) eventHours.style.display = hosted ? '' : 'none';
        if (rrDuration) rrDuration.required = !!(v && !hosted);
        onPurpose();
    };
    const setVertical = (v, usecase) => {
        if (!rform || !v) return;
        const radio = rform.querySelector('input[name="vertical"][value="' + v + '"]');
        if (!radio) return;
        radio.checked = true; onVertical();
        if (usecase && rrPurpose) { rrPurpose.value = usecase; onPurpose(); }
    };

    /* Section CTAs preselect the vertical (and a use case where one is implied) */
    document.querySelectorAll('[data-inquiry]').forEach((el) => {
        el.addEventListener('click', () => {
            const v = { create: 'Create', gather: 'Gather', stay: 'Stay' }[el.dataset.inquiry];
            if (v) setVertical(v, el.dataset.usecase || '');
        });
    });
    /* Deep links from the creator page: /?v=create&u=Livestream%20%2F%20Stream%20House#inquire */
    try {
        const qs = new URLSearchParams(window.location.search);
        const v = { create: 'Create', gather: 'Gather', stay: 'Stay' }[(qs.get('v') || '').toLowerCase()];
        if (v) setVertical(v, qs.get('u') || '');
    } catch (e) { /* no-op */ }

    if (rform) {
        const stepItems = Array.from(document.querySelectorAll('.rr-stepitem'));
        const steps = Array.from(rform.querySelectorAll('.rr-step'));
        const showStep = (n) => {
            steps.forEach((s) => s.classList.toggle('active', s.dataset.step == n));
            stepItems.forEach((it) => { const d = +it.dataset.step; it.classList.toggle('active', d == n); it.classList.toggle('done', d < n); });
            const top = document.getElementById('inquire'); if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        const validate = (n) => {
            let ok = true;
            if (n == 1) {
                if (!getVertical()) { ok = false; if (verticalGroup) verticalGroup.classList.add('is-invalid'); }
                const reqs = ['purpose', 'start_date'];
                if (getVertical() !== 'Gather') reqs.push('duration');
                reqs.forEach((nm) => { const f = rform.elements[nm]; if (f) { const bad = !f.value.trim(); f.style.borderColor = bad ? '#ff5555' : ''; if (bad) ok = false; } });
            } else if (n == 2) {
                ['name', 'phone', 'email'].forEach((nm) => { const f = rform.elements[nm]; if (f) { const bad = !f.value.trim(); f.style.borderColor = bad ? '#ff5555' : ''; if (bad) ok = false; } });
            }
            return ok;
        };
        rform.querySelectorAll('input[name="vertical"]').forEach((r) => r.addEventListener('change', onVertical));
        if (rrPurpose) rrPurpose.addEventListener('change', onPurpose);
        if (orgEl) orgEl.addEventListener('change', onPurpose);
        onVertical();

        const lblToggle = document.getElementById('rr-label-toggle');
        const lblFields = document.getElementById('rr-label-fields');
        if (lblToggle && lblFields) lblToggle.addEventListener('change', () => lblFields.classList.toggle('show', lblToggle.checked));

        // Auto-calculate number of days from the selected dates
        const startEl = rform.elements['start_date'];
        const endEl = rform.elements['end_date'];
        const daysEl = rform.elements['days'];
        if (startEl && endEl && daysEl) {
            const updDays = () => {
                if (!startEl.value || !endEl.value) return;
                const diff = Math.round((new Date(endEl.value) - new Date(startEl.value)) / 86400000);
                if (diff >= 0) daysEl.value = Math.max(1, diff);
            };
            startEl.addEventListener('change', () => { if (startEl.value) endEl.min = startEl.value; updDays(); });
            endEl.addEventListener('change', updDays);
        }

        const g = (nm) => { const f = rform.elements[nm]; return f ? f.value : ''; };
        const isChecked = (nm) => { const f = rform.elements[nm]; return !!(f && f.checked); };
        const ADDONS = [['addon_engineer', 'Engineer'], ['addon_chef', 'Private Chef'], ['addon_catering', 'Catering'], ['addon_photographer', 'Photographer / Videographer'], ['addon_av', 'A/V & Livestream'], ['addon_lighting', 'Lighting Kit'], ['addon_security', 'Security'], ['addon_transport', 'Transportation']];
        const addonList = () => ADDONS.filter(([nm]) => isChecked(nm)).map(([, label]) => label);

        const buildSummary = () => {
            const v = getVertical();
            const addons = addonList();
            const rows = [
                ['Here to', [v, g('purpose')].filter(Boolean).join(' — ')],
                g('org_type') ? ['Organization', g('org_type')] : null,
                (platformsGroup && platformsGroup.style.display !== 'none' && g('platforms')) ? ['Platforms', g('platforms')] : null,
                v === 'Gather' ? (g('event_hours') ? ['Hours', g('event_hours')] : null) : ['Duration', g('duration')],
                (roomGroup && roomGroup.style.display !== 'none' && g('room')) ? ['Studio', g('room')] : null,
                ['Dates', g('start_date') + (g('end_date') ? ' → ' + g('end_date') : '')],
                ['Days / Guests', g('days') + ' day(s) · ' + g('guests') + ' guest(s)'],
                addons.length ? ['Add-ons', addons.join(', ')] : null,
                ['Name', g('name')],
                ['Contact', [g('email'), g('phone')].filter(Boolean).join(' · ')],
                (g('label_name') || g('company')) ? ['Company', g('label_name') || g('company')] : null,
            ].filter(Boolean);
            document.getElementById('rr-summary').innerHTML = '<h4>Your Request</h4>' +
                rows.map((r) => '<div class="rr-summary-row"><span>' + r[0] + '</span><span>' + escapeHtml(r[1] || '—') + '</span></div>').join('');
        };

        rform.querySelectorAll('[data-next]').forEach((b) => b.addEventListener('click', () => {
            const cur = +b.closest('.rr-step').dataset.step;
            if (!validate(cur)) return;
            const next = +b.dataset.next;
            if (next == 3) buildSummary();
            showStep(next);
        }));
        rform.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => showStep(+b.dataset.back)));

        rform.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!validate(1)) { showStep(1); return; }
            if (!validate(2)) { showStep(2); return; }
            const btn = document.getElementById('rr-submit');
            btn.textContent = 'Submitting…'; btn.disabled = true;

            // ---- Map the intake to the Torch booking API contract ----
            // session_type enum: half_day | full_day | estate_daily | estate_weekly
            //   | estate_biweekly | estate_monthly | writing_camp | private_event
            const v = getVertical();
            const purpose = g('purpose');
            const duration = g('duration');
            let sessionType;
            if (v === 'Gather') sessionType = 'private_event';
            else if (v === 'Stay') sessionType = (duration === 'Multi-week residency') ? 'estate_monthly' : 'estate_daily';
            else if (duration === 'Multi-Day (2–7 days)') sessionType = 'estate_daily';
            else if (duration === 'Extended production') sessionType = 'estate_monthly';
            else sessionType = 'full_day';
            const roomMap = { 'Studio B': 'b_room', 'Studio C': 'c_room', 'Both Studios': 'both' };
            const room = (roomGroup && roomGroup.style.display !== 'none') ? (roomMap[g('room')] || null) : null;

            // Fold everything the API has no dedicated field for into special_requests
            const extras = [];
            extras.push('Vertical: ' + (v || '—'));
            extras.push('Use case: ' + (purpose || '—'));
            if (g('org_type')) extras.push('Organization: ' + g('org_type'));
            if (platformsGroup && platformsGroup.style.display !== 'none' && g('platforms')) extras.push('Platforms / audience: ' + g('platforms'));
            if (v !== 'Gather' && duration) extras.push('Duration: ' + duration);
            if (v === 'Gather' && g('event_hours')) extras.push('Event hours: ' + g('event_hours'));
            addonList().filter((l) => l !== 'Engineer' && l !== 'Catering').forEach((l) => extras.push('Add-on: ' + l));
            if (g('message')) extras.push('Notes: ' + g('message'));

            const body = {
                session_type: sessionType,
                room: room,
                start_date: g('start_date'),
                end_date: g('end_date') || null,
                start_time: null,
                end_time: null,
                duration_days: parseInt(g('days'), 10) || 1,
                guest_count: parseInt(g('guests'), 10) || 1,
                client_name: g('name'),
                client_email: g('email'),
                client_phone: g('phone'),
                artist_name: g('artist') || null,
                company: g('company') || null,
                is_label_booking: isChecked('is_label_booking'),
                label_name: g('label_name') || null,
                ar_contact_name: g('ar_contact') || null,
                ar_email: g('ar_email') || null,
                po_number: g('po_number') || null,
                engineer_needed: isChecked('addon_engineer'),
                engineer_hours: null,
                catering_needed: isChecked('addon_catering'),
                catering_notes: null,
                special_requests: extras.join(' | ') || null
            };

            const showSuccess = (conf) => {
                rform.style.display = 'none';
                const st = document.querySelector('.rr-steps'); if (st) st.style.display = 'none';
                if (conf) {
                    const c = document.getElementById('rr-conf');
                    if (c) { c.textContent = 'Confirmation number: ' + conf; c.style.display = ''; }
                }
                document.getElementById('rr-success').classList.add('show');
            };

            fetch('https://bookings.torchatl.com/api/booking-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            }).then((res) => res.json().then((d) => ({ ok: res.ok, d }))).then(({ ok, d }) => {
                if (!ok) {
                    btn.textContent = 'Submit Reservation Request'; btn.disabled = false;
                    const errEl = document.getElementById('rr-submit-err');
                    const msg = (d && d.error) ? d.error : 'Something went wrong. Please try again or email bookings@torchatl.com.';
                    if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
                    else { alert(msg); }
                    return;
                }
                showSuccess(d && d.confirmation_number);
            }).catch(() => {
                // Network failure — still confirm receipt so the user isn't stuck; ops fallback via email.
                showSuccess(null);
            });
        });
    }
});

/* Member login modal (preview stub) */
function showLoginModal(e) {
    if (e) e.preventDefault();
    document.getElementById('login-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
}
function closeLoginModal() {
    document.getElementById('login-modal').classList.remove('active');
    document.body.style.overflow = '';
}
function handleMemberLogin(e) {
    e.preventDefault();
    const err = document.getElementById('login-error');
    err.textContent = 'Member portal opens at launch. Contact bookings@torchatl.com for access.';
    err.classList.add('visible');
}

/* Newsletter signup */
function handleNewsletterSignup(e) {
    e.preventDefault();
    const form = e.target;
    const input = form.querySelector('input[name="email"]');
    const btn = form.querySelector('button');
    const note = document.getElementById('newsletter-note');
    btn.disabled = true; btn.textContent = 'Subscribing…';
    fetch('https://api.torchatl.com/api/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: input.value, source: 'torchatl.com footer' })
    }).then((r) => r.json().then((d) => ({ ok: r.ok, d }))).then(({ ok, d }) => {
        if (ok) {
            note.textContent = 'You’re on the list. Welcome to the fire.';
            input.value = ''; btn.textContent = 'Subscribed';
        } else {
            note.textContent = (d && d.error) || 'Something went wrong — please try again.';
            btn.disabled = false; btn.textContent = 'Subscribe';
        }
        note.classList.add('visible');
    }).catch(() => {
        note.textContent = 'Network error — please try again.';
        note.classList.add('visible');
        btn.disabled = false; btn.textContent = 'Subscribe';
    });
    return false;
}

/* A Room waitlist signup */
function handleAroomSignup(e) {
    e.preventDefault();
    const form = e.target;
    const email = form.querySelector('input[name="email"]').value;
    const note = document.getElementById('aroom-note');
    const btn = form.querySelector('button');
    if (btn) { btn.textContent = 'Added'; btn.disabled = true; }
    fetch('https://formsubmit.co/ajax/bookings@torchatl.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ email: email, _subject: 'A Room Waitlist — TORCH ATL' })
    }).catch(() => {});
    if (note) note.classList.add('visible');
    form.querySelector('input[name="email"]').style.display = 'none';
    return false;
}

/* Ambient videos — lazy play/pause on visibility + Shinola-style toggle */
document.addEventListener('DOMContentLoaded', () => {
    const vids = document.querySelectorAll('video.bg-video');
    if (!vids.length) return;

    if ('IntersectionObserver' in window) {
        const vo = new IntersectionObserver((entries) => {
            entries.forEach((en) => {
                const v = en.target;
                if (en.isIntersecting) {
                    if (!v.dataset.userPaused) v.play().catch(() => {});
                } else if (!v.paused) {
                    v.pause();
                }
            });
        }, { threshold: 0.2 });
        vids.forEach(v => vo.observe(v));
    } else {
        vids.forEach(v => v.play().catch(() => {}));
    }

    document.querySelectorAll('.video-toggle').forEach((btn) => {
        const scope = btn.closest('.video-wrap, .video-banner, .motion-item, .hero') || document;
        const v = scope.querySelector('video.bg-video');
        if (!v) return;
        btn.addEventListener('click', () => {
            if (v.paused) {
                delete v.dataset.userPaused;
                v.play().catch(() => {});
                btn.classList.remove('is-paused');
                btn.setAttribute('aria-label', 'Pause video');
            } else {
                v.dataset.userPaused = '1';
                v.pause();
                btn.classList.add('is-paused');
                btn.setAttribute('aria-label', 'Play video');
            }
        });
    });
});
