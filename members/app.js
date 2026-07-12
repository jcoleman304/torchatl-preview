// TORCH ATL Member Portal - Application Logic
// Wired to backend API (TorchAPI client)

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Hide preloader after short delay
    setTimeout(() => {
        document.getElementById('preloader').classList.add('hidden');
    }, 1500);

    // Check for existing session (cached login)
    if (loadData() && currentMember && TorchAPI.auth.isAuthenticated()) {
        showPortal();
        // Refresh from backend in background
        refreshProfile().then(() => {
            populateDashboard();
            renderCalendar();
            populateGuestSessions();
            populateRegisteredGuests();
            populateSessionHistory();
            populateBilling();
        });
        // Engineers aren't persisted across reloads — reload them so the
        // Engineers tab and booking dropdown aren't stuck empty on resume.
        refreshEngineers().then(() => {
            populateEngineers();
            populateEngineerDropdown();
        });
    }

    // Setup navigation
    setupNavigation();

    // Setup booking form listeners
    setupBookingListeners();
});

// Setup Navigation
function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            showSection(section);

            // Update active state
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });
}

// Handle Login — now async, calls backend API
async function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('login-email').value.toLowerCase().trim();
    const code = document.getElementById('login-code').value;
    const submitBtn = event.target.querySelector('button[type="submit"]');

    if (!email || !code) {
        showToast('Please enter email and access code.', 'error');
        return;
    }

    // Disable button during login
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in...';
    }

    try {
        const { token, user } = await TorchAPI.auth.login(email, code);

        // Map API user to currentMember shape
        currentMember = {
            id: user.id,
            email: user.email,
            name: user.name,
            tier: user.tier,
            founding: user.founding,
            joinDate: (user.joinDate || '').split('T')[0],
            phone: user.phone,
            company: user.company,
            hoursUsed: user.hours ? parseFloat(user.hours.used) || 0 : 0,
            hoursScheduled: user.hours ? parseFloat(user.hours.scheduled) || 0 : 0,
            sessions: [],
            guests: [],
            history: [],
            tierConfig: user.tierConfig
        };

        backendAvailable = true;
        saveData();

        // Fetch full profile in background
        await refreshProfile();
        await refreshEngineers();

        showPortal();
        showToast('Welcome back, ' + user.name.split(' ')[0] + '!', 'success');
    } catch (err) {
        console.error('[TORCH] Login failed:', err);
        showToast(err.message || 'Invalid credentials. Please try again.', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign In';
        }
    }
}

// Show Portal
function showPortal() {
    try {
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('portal-screen').classList.add('active');
        document.getElementById('portal-screen').style.display = 'block';
        populateDashboard();
        renderCalendar();
        populateGuestSessions();
        populateRegisteredGuests();
        populateSessionHistory();
        populateBilling();
        populateEngineers();
        populateEngineerDropdown();
    } catch (error) {
        console.error('[TORCH] Portal error:', error);
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('portal-screen').style.display = 'block';
    }
}

// Logout
function logout() {
    clearSession();
    document.getElementById('portal-screen').classList.remove('active');
    document.getElementById('portal-screen').style.display = 'none';
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('login-screen').style.display = '';
    document.getElementById('login-form').reset();
    showToast('You have been logged out.', 'info');
}

// Show Section
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');

    // Update nav
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.toggle('active', l.dataset.section === sectionId);
    });
}

// Populate Dashboard
function populateDashboard() {
    if (!currentMember) return;

    const tier = currentMember.tierConfig || TIERS[currentMember.tier];
    const hoursRemaining = (tier.hours || 0) - currentMember.hoursUsed - currentMember.hoursScheduled;

    // Header info
    document.getElementById('header-member-name').textContent = currentMember.name.split(' ')[0];
    document.getElementById('header-member-tier').textContent = currentMember.tier;

    // Welcome banner
    document.getElementById('welcome-name').textContent = currentMember.name.split(' ')[0];
    document.getElementById('hours-remaining').textContent = hoursRemaining;

    // Next session
    const todayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    const nextSession = currentMember.sessions.find(s => parseLocalDate(s.date) >= todayStart);
    if (nextSession) {
        const date = parseLocalDate(nextSession.date);
        document.getElementById('next-session').textContent = formatShortDate(date);
    } else {
        document.getElementById('next-session').textContent = 'None';
    }

    // Membership card
    document.getElementById('tier-badge').textContent = currentMember.tier.toUpperCase();
    document.getElementById('member-avatar').textContent = getInitials(currentMember.name);
    document.getElementById('member-full-name').textContent = currentMember.name;
    document.getElementById('member-since').textContent = 'Member since ' + formatMonthYear(parseLocalDate(currentMember.joinDate));
    document.getElementById('monthly-hours').textContent = tier.hours;
    document.getElementById('booking-window').textContent = tier.bookingWindow;
    document.getElementById('guest-limit').textContent = tier.guestLimit;
    document.getElementById('access-code').textContent = '••••••';

    // Hours circle
    const usedPercent = (currentMember.hoursUsed / tier.hours) * 100;
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (usedPercent / 100) * circumference;

    document.getElementById('hours-progress').style.strokeDasharray = circumference;
    document.getElementById('hours-progress').style.strokeDashoffset = offset;
    document.getElementById('hours-used').textContent = currentMember.hoursUsed;
    document.getElementById('hours-total').textContent = tier.hours;

    // Hours breakdown
    document.getElementById('breakdown-used').textContent = currentMember.hoursUsed + ' credits';
    document.getElementById('breakdown-scheduled').textContent = currentMember.hoursScheduled + ' credits';
    document.getElementById('breakdown-available').textContent = hoursRemaining + ' credits';

    // Upcoming sessions
    const upcomingHtml = currentMember.sessions.map(s => `
        <div class="session-item">
            <div>
                <div class="session-date">${formatDate(parseLocalDate(s.date))}</div>
                <div class="session-time">${formatTime(s.startTime)} - ${formatTime(s.endTime)}${s.engineerName ? ' — ' + s.engineerName : ''}</div>
            </div>
            <div class="session-item-right">
                <span class="session-hours">${s.hours} credits</span>
                <button type="button" class="btn-cancel-session" onclick="cancelBooking('${s.id}')">Cancel</button>
            </div>
        </div>
    `).join('');
    document.getElementById('upcoming-list').innerHTML = upcomingHtml || '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No upcoming sessions</p>';

    // Hours page stats
    document.getElementById('hours-remaining-big').textContent = hoursRemaining;
    document.getElementById('stat-allocated').textContent = tier.hours;
    document.getElementById('stat-used').textContent = currentMember.hoursUsed;
    document.getElementById('stat-scheduled').textContent = currentMember.hoursScheduled;
    document.getElementById('stat-available').textContent = hoursRemaining;

    // Large hours circle
    const progressLarge = document.getElementById('hours-progress-large');
    if (progressLarge) {
        progressLarge.style.strokeDasharray = circumference;
        progressLarge.style.strokeDashoffset = offset;
    }

    // Announcements (from backend when available). Markup matches the static
    // structure the CSS styles: .announcement > .announcement-date + .announcement-content.
    const announcements = currentMember.announcements || [];
    const announcementsContainer = document.getElementById('announcement-list');
    if (announcementsContainer) {
        if (announcements.length > 0) {
            announcementsContainer.innerHTML = announcements.map(a => `
                <div class="announcement">
                    <span class="announcement-date">${formatShortDate(parseLocalDate(a.created_at || a.date))}</span>
                    <div class="announcement-content">
                        <h4>${escapeHtml(a.title)}</h4>
                        <p>${escapeHtml(a.content)}</p>
                    </div>
                </div>
            `).join('');
        } else if (backendAvailable) {
            // Backend reachable but nothing posted — don't leave stale placeholders up.
            announcementsContainer.innerHTML = '<p style="color: var(--text-muted); padding: 8px 0;">No announcements right now.</p>';
        }
        // else (offline/cached): leave the static placeholder content in place.
    }
}

// Render Calendar
function renderCalendar() {
    const year = currentCalendarMonth.getFullYear();
    const month = currentCalendarMonth.getMonth();

    document.getElementById('calendar-month-year').textContent =
        new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    let html = '';
    const today = new Date();

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        html += `<div class="calendar-day other-month disabled">${day}</div>`;
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateStr = formatDateISO(date);
        const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const isToday = date.toDateString() === today.toDateString();
        const isBooked = currentMember?.sessions.some(s => s.date === dateStr);
        const isSelected = selectedDate === dateStr;

        let classes = 'calendar-day';
        if (isPast) classes += ' disabled';
        if (isToday) classes += ' today';
        if (isBooked) classes += ' booked';
        if (isSelected) classes += ' selected';

        html += `<div class="${classes}" onclick="selectDate('${dateStr}', ${!isPast})">${day}</div>`;
    }

    // Next month days
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    const remainingCells = totalCells - firstDay - daysInMonth;
    for (let i = 1; i <= remainingCells; i++) {
        html += `<div class="calendar-day other-month disabled">${i}</div>`;
    }

    document.getElementById('calendar-days').innerHTML = html;
}

// Change Calendar Month
function changeCalendarMonth(delta) {
    currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() + delta);
    renderCalendar();
}

// Select Date
function selectDate(dateStr, enabled) {
    if (!enabled) return;

    selectedDate = dateStr;
    renderCalendar();

    const date = parseLocalDate(dateStr);
    document.getElementById('selected-date-text').textContent =
        date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    // Pull real availability for this date so the member can see what's free.
    loadAvailability(dateStr);
}

// Load booked windows for a date and refresh the availability hint.
let dayAvailability = null;
async function loadAvailability(dateStr) {
    dayAvailability = null;
    try {
        dayAvailability = await TorchAPI.bookings.getAvailability(dateStr);
    } catch (err) {
        console.warn('[TORCH] Could not load availability:', err.message);
    }
    updateBookingSummary();
}

// Returns { full: bool, remaining: N } for the currently selected start/end.
function checkSelectedSlot() {
    if (!dayAvailability) return null;
    const startTime = document.getElementById('booking-start').value;
    const endTime = document.getElementById('booking-end').value;
    if (!startTime || !endTime) return null;

    const toWin = (s, e) => {
        const [sh, sm] = s.split(':').map(Number);
        const [eh, em] = e.split(':').map(Number);
        let start = sh * 60 + sm, end = eh * 60 + em;
        if (end <= start) end += 24 * 60;
        return { start, end };
    };
    const req = toWin(startTime, endTime);
    const overlap = (dayAvailability.existingBookings || []).filter(b => {
        const w = toWin(b.startTime, b.endTime);
        return req.start < w.end && w.start < req.end;
    });
    const capacity = dayAvailability.capacity || 2;
    return { full: overlap.length >= capacity, remaining: Math.max(0, capacity - overlap.length) };
}

// Setup Booking Listeners
function setupBookingListeners() {
    const startSelect = document.getElementById('booking-start');
    const endSelect = document.getElementById('booking-end');

    if (startSelect && endSelect) {
        startSelect.addEventListener('change', updateBookingSummary);
        endSelect.addEventListener('change', updateBookingSummary);
    }
}

// Update Booking Summary
function updateBookingSummary() {
    const startTime = document.getElementById('booking-start').value;
    const endTime = document.getElementById('booking-end').value;

    const hintEl = document.getElementById('availability-hint');
    const submitBtn = document.querySelector('#booking-form button[type="submit"]');

    const creditsEl = document.getElementById('summary-credits');

    if (startTime && endTime) {
        const start = parseInt(startTime.split(':')[0]);
        let end = parseInt(endTime.split(':')[0]);
        if (end < start) end += 24;

        const hours = end - start;
        const validBlock = hours >= 4 && hours <= 16 && hours % 4 === 0;
        // Credit cost is peak-weighted for the selected date.
        const credits = selectedDate ? calcCredits(selectedDate, startTime, endTime) : hours;

        document.getElementById('summary-duration').textContent = hours + ' hrs';
        if (creditsEl) creditsEl.textContent = credits + ' credits' + (credits > hours ? ' (peak)' : '');

        if (currentMember) {
            const tier = currentMember.tierConfig || TIERS[currentMember.tier];
            const remaining = tier.hours - currentMember.hoursUsed - currentMember.hoursScheduled - credits;
            document.getElementById('summary-remaining').textContent = remaining + ' credits remaining';
        }

        // Availability + block validation share the hint line.
        const slot = checkSelectedSlot();
        if (hintEl) {
            if (!validBlock) {
                hintEl.textContent = '● Sessions book in 4-hour blocks (4, 8, 12, or 16 hours)';
                hintEl.className = 'availability-hint full';
            } else if (!slot) {
                hintEl.textContent = credits > hours ? '● Peak evening — 1.25 credits/hour' : '';
                hintEl.className = 'availability-hint' + (credits > hours ? ' free' : '');
            } else if (slot.full) {
                hintEl.textContent = '● Fully booked at this time — please choose another slot';
                hintEl.className = 'availability-hint full';
            } else {
                hintEl.textContent = `● ${slot.remaining} of ${dayAvailability.capacity || 2} rooms free`
                    + (credits > hours ? ' · peak pricing (1.25 cr/hr)' : '');
                hintEl.className = 'availability-hint free';
            }
        }
        if (submitBtn) submitBtn.disabled = !validBlock || !!(slot && slot.full);
    } else {
        if (creditsEl) creditsEl.textContent = '0 credits';
        if (hintEl) { hintEl.textContent = ''; hintEl.className = 'availability-hint'; }
        if (submitBtn) submitBtn.disabled = false;
    }
}

// Submit Booking — async, sends to backend API
async function submitBooking(event) {
    event.preventDefault();

    if (!selectedDate) {
        showToast('Please select a date first.', 'error');
        return;
    }

    const startTime = document.getElementById('booking-start').value;
    const endTime = document.getElementById('booking-end').value;
    const type = document.getElementById('booking-type').value;
    const guestCount = parseInt(document.getElementById('booking-guests').value) || 0;
    const notes = document.getElementById('booking-notes').value;
    const engineerId = document.getElementById('booking-engineer')?.value || null;

    if (!startTime || !endTime) {
        showToast('Please select start and end times.', 'error');
        return;
    }

    // Calculate hours + peak-weighted credits for UI validation
    const start = parseInt(startTime.split(':')[0]);
    let end = parseInt(endTime.split(':')[0]);
    if (end < start) end += 24;
    const hours = end - start;
    const credits = calcCredits(selectedDate, startTime, endTime);

    const tier = currentMember.tierConfig || TIERS[currentMember.tier];

    // Quick client-side checks
    if (hours < 4 || hours > 16 || hours % 4 !== 0) {
        showToast('Sessions book in 4-hour blocks (4, 8, 12, or 16 hours).', 'error');
        return;
    }
    if (guestCount > tier.guestLimit) {
        showToast(`Your tier allows up to ${tier.guestLimit} collaborators per session.`, 'error');
        return;
    }

    const available = tier.hours - currentMember.hoursUsed - currentMember.hoursScheduled;
    if (credits > available) {
        showToast(`You only have ${available} credits available (this session costs ${credits}).`, 'error');
        return;
    }

    // Submit to backend
    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Booking...'; }

    try {
        const booking = await TorchAPI.bookings.create({
            date: selectedDate,
            startTime: startTime,
            endTime: endTime,
            type: type,
            guestCount: guestCount,
            engineerId: engineerId || undefined,
            notes: notes || undefined
        });

        // Refresh profile to get updated hours and sessions
        await refreshProfile();

        // Reset form
        document.getElementById('booking-form').reset();
        selectedDate = null;
        document.getElementById('selected-date-text').textContent = 'Select a date';

        showToast('Session booked successfully!', 'success');
        // Surface any billable overage the backend flagged (no longer silent).
        if (booking && booking.overage && booking.overage.credits > 0) {
            showToast(`Heads up: ${booking.overage.credits} credit(s) over your monthly allocation will bill at $${booking.overage.rate}/credit.`, 'info');
        }
        populateDashboard();
        renderCalendar();
        populateGuestSessions();
    } catch (err) {
        console.error('[TORCH] Booking failed:', err);
        showToast(err.message || 'Booking failed. Please try again.', 'error');
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Confirm Booking'; }
    }
}

// Cancel an upcoming booking
async function cancelBooking(bookingId) {
    const session = currentMember?.sessions.find(s => s.id === bookingId);
    const when = session ? `${formatDate(parseLocalDate(session.date))} at ${formatTime(session.startTime)}` : 'this session';
    if (!confirm(`Cancel ${when}?\n\nNote: cancellations within 24 hours forfeit the booked hours.`)) return;

    try {
        const result = await TorchAPI.bookings.cancel(bookingId);
        await refreshProfile();
        populateDashboard();
        renderCalendar();
        populateGuestSessions();
        populateSessionHistory();
        if (result && result.lateCancellation) {
            showToast('Session cancelled. Hours were not refunded (within 24 hours).', 'info');
        } else {
            showToast('Session cancelled and hours returned.', 'success');
        }
    } catch (err) {
        console.error('[TORCH] Cancel failed:', err);
        showToast(err.message || 'Could not cancel session. Please try again.', 'error');
    }
}

// Populate Guest Sessions Dropdown
function populateGuestSessions() {
    if (!currentMember) return;

    const select = document.getElementById('guest-session');
    if (!select) return;

    const options = currentMember.sessions.map(s =>
        `<option value="${s.id}">${formatDate(parseLocalDate(s.date))} - ${formatTime(s.startTime)}</option>`
    ).join('');

    select.innerHTML = '<option value="">Choose a session</option>' + options;
}

// Register Guest — async, sends to backend API
async function registerGuest(event) {
    event.preventDefault();

    const sessionId = document.getElementById('guest-session').value;
    const name = document.getElementById('guest-name').value;
    const email = document.getElementById('guest-email').value;
    const phone = document.getElementById('guest-phone').value;

    if (!sessionId || !name) {
        showToast('Please select a session and enter guest name.', 'error');
        return;
    }

    try {
        await TorchAPI.guests.register(sessionId, { name, email, phone });
        await refreshProfile();

        document.getElementById('guest-form').reset();
        showToast('Guest registered successfully!', 'success');
        populateRegisteredGuests();
        populateGuestSessions();
    } catch (err) {
        console.error('[TORCH] Guest registration failed:', err);
        showToast(err.message || 'Failed to register guest.', 'error');
    }
}

// Populate Registered Guests
function populateRegisteredGuests() {
    if (!currentMember) return;

    const container = document.getElementById('registered-guests');
    if (!container) return;

    if (!currentMember.guests || currentMember.guests.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No guests registered</p>';
        return;
    }

    const html = currentMember.guests.map(g => {
        const session = currentMember.sessions.find(s => s.id === g.session);
        return `
            <div class="guest-item">
                <div>
                    <div class="guest-name">${g.name}</div>
                    <div class="guest-session">${session ? formatDate(parseLocalDate(session.date)) : 'Unknown session'}</div>
                </div>
                <button class="btn-icon" onclick="removeGuest('${g.id}')">✕</button>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

// Remove Guest — async, calls backend API
async function removeGuest(guestId) {
    try {
        await TorchAPI.guests.remove(guestId);
        await refreshProfile();
        populateRegisteredGuests();
        showToast('Guest removed.', 'info');
    } catch (err) {
        console.error('[TORCH] Guest removal failed:', err);
        showToast(err.message || 'Failed to remove guest.', 'error');
    }
}

// Populate Session History
function populateSessionHistory() {
    if (!currentMember) return;

    const container = document.getElementById('session-history');
    if (!container) return;

    if (!currentMember.history || currentMember.history.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No session history</p>';
        return;
    }

    const html = currentMember.history.map(h => `
        <div class="history-item">
            <div>
                <div class="history-date">${formatDate(parseLocalDate(h.date))}</div>
                <div class="history-type">${h.type}</div>
            </div>
            <span class="history-hours">${h.hours} credits</span>
        </div>
    `).join('');

    container.innerHTML = html;
}

// Concierge Functions
function openConcierge() {
    document.getElementById('concierge-modal').classList.add('active');
}

function closeConcierge() {
    document.getElementById('concierge-modal').classList.remove('active');
}

function sendMessage(event) {
    event.preventDefault();

    const input = document.getElementById('chat-input');
    const message = input.value.trim();

    if (!message) return;

    addChatMessage(message, 'user');
    input.value = '';

    setTimeout(() => {
        const response = generateConciergeResponse(message);
        addChatMessage(response, 'bot');
    }, 500);
}

function addChatMessage(text, sender) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    div.innerHTML = `<p>${text}</p>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function generateConciergeResponse(message) {
    const lower = message.toLowerCase();

    if (lower.includes('book') || lower.includes('session') || lower.includes('reserve')) {
        return CONCIERGE_RESPONSES.booking[Math.floor(Math.random() * CONCIERGE_RESPONSES.booking.length)];
    }
    if (lower.includes('hour') || lower.includes('time') || lower.includes('allocation')) {
        return CONCIERGE_RESPONSES.hours[Math.floor(Math.random() * CONCIERGE_RESPONSES.hours.length)];
    }
    if (lower.includes('guest') || lower.includes('visitor') || lower.includes('bring')) {
        return CONCIERGE_RESPONSES.guests[Math.floor(Math.random() * CONCIERGE_RESPONSES.guests.length)];
    }
    if (lower.includes('rule') || lower.includes('policy') || lower.includes('allowed')) {
        return CONCIERGE_RESPONSES.rules[Math.floor(Math.random() * CONCIERGE_RESPONSES.rules.length)];
    }
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
        return CONCIERGE_RESPONSES.greetings[Math.floor(Math.random() * CONCIERGE_RESPONSES.greetings.length)];
    }

    return CONCIERGE_RESPONSES.general[Math.floor(Math.random() * CONCIERGE_RESPONSES.general.length)];
}

// Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
        <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Utility Functions
function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatShortDate(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMonthYear(date) {
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatDateISO(date) {
    return date.toISOString().split('T')[0];
}

function formatTime(timeStr) {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes || '00'} ${ampm}`;
}

// Parse a backend date value as LOCAL time. `new Date('YYYY-MM-DD')` parses as
// UTC midnight, which renders the previous day in Atlanta (UTC-4/-5). Date-only
// strings are built from local components; full timestamps keep their offset.
function parseLocalDate(value) {
    if (value instanceof Date) return value;
    if (typeof value === 'string' && !value.includes('T')) {
        const [y, m, d] = value.split('-').map(Number);
        return new Date(y, (m || 1) - 1, d || 1);
    }
    return new Date(value);
}

// Peak-weighted credit cost (mirrors backend): Thu–Sun after 6 PM = 1.25 cr/hr.
// dateStr is 'YYYY-MM-DD'; whole-hour sessions (4-hour blocks).
const PEAK_MULTIPLIER = 1.25;
const PEAK_DAYS = [4, 5, 6, 0]; // Thu, Fri, Sat, Sun (UTC day)
function calcCredits(dateStr, startTime, endTime) {
    const peakDay = PEAK_DAYS.indexOf(new Date(dateStr).getUTCDay()) >= 0;
    let s = parseInt(startTime.split(':')[0], 10);
    let e = parseInt(endTime.split(':')[0], 10);
    if (e <= s) e += 24;
    let credits = 0;
    for (let h = s; h < e; h++) {
        credits += (peakDay && (h % 24) >= 18) ? PEAK_MULTIPLIER : 1;
    }
    return Math.round(credits * 100) / 100;
}

// Escape user/remote strings before injecting via innerHTML.
function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }
});

// ============================================
// BILLING FUNCTIONS
// ============================================

function populateBilling() {
    if (!currentMember) return;

    const tier = currentMember.tierConfig || TIERS[currentMember.tier];
    const rate = currentMember.founding ? tier.foundingRate : tier.monthlyRate;

    const tierNameEl = document.getElementById('billing-tier-name');
    const amountEl = document.getElementById('billing-amount');
    const memberSinceEl = document.getElementById('billing-member-since');

    if (tierNameEl) tierNameEl.textContent = currentMember.tier + ' Membership';
    if (amountEl) amountEl.textContent = '$' + rate.toLocaleString();
    if (memberSinceEl) memberSinceEl.textContent = formatDate(parseLocalDate(currentMember.joinDate));

    // Membership Value breakdown — driven by the member's actual tier.
    const valueEl = document.getElementById('membership-value');
    if (valueEl) {
        const credits = tier.credits || tier.hours || 0;
        const rows = [
            [`Monthly Credits (${credits} credits)`, tier.studioValue ? '$' + tier.studioValue.toLocaleString() + ' value' : 'Included'],
            [`Booking Window (${tier.bookingWindow} days)`, 'Included'],
            [`Collaborators (${tier.guestLimit} per session)`, 'Included']
        ];
        if (tier.suitePrivileges) rows.push(['Suite Privileges', tier.suitePrivileges]);
        if (tier.buyoutRate > 0) rows.push(['Estate Buyout — member rate', tier.buyoutRate + '% off']);
        if (tier.rosterArtists > 0) rows.push(['Roster Artists', tier.rosterArtists + ' on your account']);
        rows.push(['A&R Office Hours & Events', 'Included']);
        valueEl.innerHTML = rows.map(([label, val]) =>
            `<div class="value-item"><span>${escapeHtml(label)}</span><span class="value-amount">${escapeHtml(val)}</span></div>`
        ).join('') +
            `<div class="value-total"><span>You Pay${currentMember.founding ? ' (Founding — locked)' : ''}</span><span class="value-amount gold">$${rate.toLocaleString()}/mo</span></div>`;
    }

    // Show subscription details from backend
    if (currentMember.subscription) {
        const sub = currentMember.subscription;
        const nextBilling = document.getElementById('billing-next-date');
        if (nextBilling && sub.nextBillingDate) {
            nextBilling.textContent = formatDate(parseLocalDate(sub.nextBillingDate));
        }
        const statusEl = document.getElementById('billing-status');
        if (statusEl && sub.status) {
            const label = sub.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            statusEl.textContent = label;
            // Keep the styled base class; append the status modifier (active/past_due/…).
            statusEl.className = 'subscription-status ' + sub.status;
        }
        // Payment method
        if (sub.paymentMethodLast4) {
            const cardEl = document.querySelector('.card-number');
            if (cardEl) cardEl.textContent = '•••• •••• •••• ' + sub.paymentMethodLast4;
            const brandEl = document.querySelector('.card-brand');
            if (brandEl) brandEl.textContent = sub.paymentMethodBrand || '';
        }
    }

    // Real payment history (replaces the hardcoded rows).
    loadPaymentHistory();
}

// Load and render the member's real payment history from the backend.
async function loadPaymentHistory() {
    const container = document.getElementById('payment-history');
    if (!container) return;
    try {
        const payments = await TorchAPI.billing.getPayments(50);
        if (!payments || payments.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No payments yet.</p>';
            return;
        }
        container.innerHTML = payments.map(p => {
            const statusClass = p.status === 'completed' ? 'paid' : (p.status || '');
            const label = String(p.status || '').replace(/\b\w/g, c => c.toUpperCase());
            const amount = Number(p.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return `
            <div class="payment-item">
                <div class="payment-info">
                    <span class="payment-date">${formatDate(parseLocalDate(p.created_at))}</span>
                    <span class="payment-desc">${escapeHtml(p.description || p.type || 'Payment')}</span>
                </div>
                <div class="payment-right">
                    <span class="payment-amount">$${amount}</span>
                    <span class="payment-status ${statusClass}">${escapeHtml(label)}</span>
                </div>
            </div>`;
        }).join('');
    } catch (err) {
        console.warn('[TORCH] Could not load payment history:', err.message);
        // Leave whatever is currently shown; don't blank the section on a transient error.
    }
}

function showUpdatePayment() {
    document.getElementById('payment-method-display').style.display = 'none';
    document.getElementById('update-payment-form').style.display = 'block';
}

function hideUpdatePayment() {
    document.getElementById('payment-method-display').style.display = 'flex';
    document.getElementById('update-payment-form').style.display = 'none';
}

// CSV-escape a single cell.
function csvCell(v) {
    const s = String(v == null ? '' : v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Download the member's full payment history as a CSV file.
async function downloadInvoices() {
    showToast('Preparing your payment history…', 'info');
    try {
        const payments = await TorchAPI.billing.getPayments(200);
        if (!payments || payments.length === 0) {
            showToast('No payments to download yet.', 'info');
            return;
        }
        const rows = [['Date', 'Description', 'Type', 'Amount (USD)', 'Status']];
        payments.forEach(p => rows.push([
            formatDate(parseLocalDate(p.created_at)),
            p.description || '',
            p.type || '',
            Number(p.amount || 0).toFixed(2),
            p.status || ''
        ]));
        const csv = rows.map(r => r.map(csvCell).join(',')).join('\r\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `torch-payment-history-${formatDateISO(new Date())}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Payment history downloaded.', 'success');
    } catch (err) {
        console.error('[TORCH] Download failed:', err);
        showToast(err.message || 'Could not download payment history.', 'error');
    }
}

// Format card number with spaces
document.addEventListener('DOMContentLoaded', () => {
    const cardInput = document.getElementById('new-card-number');
    if (cardInput) {
        cardInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\s/g, '').replace(/\D/g, '');
            value = value.match(/.{1,4}/g)?.join(' ') || value;
            e.target.value = value;
        });
    }

    const expiryInput = document.getElementById('new-card-expiry');
    if (expiryInput) {
        expiryInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length >= 2) {
                value = value.slice(0, 2) + '/' + value.slice(2);
            }
            e.target.value = value;
        });
    }
});

// ============================================
// ENGINEERS SECTION
// ============================================

function populateEngineers() {
    const container = document.getElementById('engineers-grid');
    if (!container) return;

    const engineers = engineersList.length > 0 ? engineersList : [];

    if (engineers.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">Loading engineers...</p>';
        return;
    }

    container.innerHTML = engineers.map(eng => `
        <div class="engineer-card">
            <div class="engineer-avatar">
                ${eng.photoUrl ? `<img src="${eng.photoUrl}" alt="${eng.name}">` : getInitials(eng.name)}
            </div>
            <div class="engineer-info">
                <h3>${eng.name}</h3>
                <span class="engineer-role">${eng.role}</span>
                <div class="engineer-specialties">
                    ${eng.specialties.map(s => `<span class="specialty-tag">${s}</span>`).join('')}
                </div>
                <p class="engineer-bio">${eng.bio}</p>
                <div class="engineer-availability">
                    <span class="availability-badge ${eng.available ? 'available' : 'unavailable'}">
                        ${eng.available ? 'Available' : 'Unavailable'}
                    </span>
                </div>
            </div>
        </div>
    `).join('');
}

function populateEngineerDropdown() {
    const select = document.getElementById('booking-engineer');
    if (!select) return;

    const engineers = engineersList.length > 0 ? engineersList : [];

    select.innerHTML = '<option value="">No engineer preference</option>' +
        engineers.filter(e => e.available).map(eng =>
            `<option value="${eng.id}">${eng.name} - ${eng.role}</option>`
        ).join('');
}

console.log('[TORCH] Member Portal initialized (backend-wired)');
