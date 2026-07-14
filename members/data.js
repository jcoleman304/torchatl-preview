// TORCH ATL Member Portal - Data Layer
// API-first with localStorage cache fallback

// Membership Tier Configuration (also served by backend, kept here for offline/instant UI)
// Torch ATL tiers (brochure model). 1 Torch Credit = 1 studio hour, engineer
// included. `hours` mirrors `credits` so existing credit math keeps working.
const TIERS = {
    Ember: {
        name: 'Ember',
        monthlyRate: 500,
        foundingRate: 500,
        hours: 8,
        credits: 8,
        studioValue: 960,
        access: 'Weekdays 10–6',
        bookingWindow: 7,
        guestLimit: 3,
        buyoutRate: 0,
        rosterArtists: 0,
        initiation: 500,
        builtFor: 'Podcasters & content creators',
        overageRate: 120,
        priority: 4,
        color: '#C2703D'
    },
    Flame: {
        name: 'Flame',
        monthlyRate: 1500,
        foundingRate: 1500,
        hours: 16,
        credits: 16,
        studioValue: 1920,
        access: 'Full calendar',
        bookingWindow: 14,
        guestLimit: 3,
        buyoutRate: 10,
        rosterArtists: 0,
        initiation: 500,
        builtFor: 'Working artists & writers',
        overageRate: 120,
        priority: 3,
        color: '#E0833A'
    },
    Blaze: {
        name: 'Blaze',
        monthlyRate: 3000,
        foundingRate: 3000,
        hours: 36,
        credits: 36,
        studioValue: 4320,
        access: 'Full calendar',
        bookingWindow: 21,
        guestLimit: 3,
        suitePrivileges: '4 credits / night',
        buyoutRate: 15,
        rosterArtists: 0,
        initiation: 1000,
        builtFor: 'Album mode & producer rosters',
        overageRate: 120,
        priority: 2,
        color: '#D4574A'
    },
    'The Torch': {
        name: 'The Torch',
        monthlyRate: 4500,
        foundingRate: 4500,
        hours: 56,
        credits: 56,
        studioValue: 6720,
        access: 'Full calendar',
        bookingWindow: 30,
        guestLimit: 3,
        suitePrivileges: '4 credits / night',
        buyoutRate: 20,
        rosterArtists: 2,
        initiation: 1000,
        builtFor: 'Labels, managers, exec producers',
        overageRate: 120,
        priority: 1,
        color: '#D4AF37'
    }
};

// Operating Hours
const OPERATING_HOURS = {
    start: 10, // 10 AM
    end: 26,   // 2 AM (next day)
    minSession: 4,
    maxSession: 12,
    transitionBuffer: 30 // minutes
};

// Concierge Responses (static, no backend needed)
const CONCIERGE_RESPONSES = {
    greetings: [
        "Hello! I'm Ember, your Torch Concierge. How can I assist you today?",
        "Welcome back! What can I help you with?",
        "Good to see you! How may I be of service?"
    ],
    booking: [
        "I can help you with booking! You can use the 'Book Session' tab to select your preferred date and time. Would you like me to walk you through it?",
        "To book a session, navigate to the 'Book Session' tab, select your date on the calendar, then choose your preferred time slot. Your hours will be automatically deducted from your monthly allocation."
    ],
    hours: [
        "You can view your hour balance in the 'My Hours' tab. Remember, unused hours don't roll over to the next month, so plan your sessions accordingly!",
        "Your hours are tracked in real-time. Check the 'My Hours' section for a detailed breakdown of used, scheduled, and available hours."
    ],
    guests: [
        "All guests must be pre-registered at least 24 hours before your session. Use the 'Guests' tab to register them. Don't forget, your tier determines your guest limit!",
        "To register guests, go to the 'Guests' tab, select your upcoming session, and enter your guest's information. They'll need to show valid ID upon arrival."
    ],
    rules: [
        "Our house rules are designed to protect every member's experience. You can review them in the 'House Rules' tab. Key points: no walk-ins, pre-register guests, maintain privacy at all times.",
        "The most important rules to remember: always book in advance, register guests 24 hours before, never share our address, and respect other members' privacy."
    ],
    general: [
        "I'm here to help! You can ask me about booking sessions, checking your hours, registering guests, or understanding our house rules.",
        "Feel free to explore the portal. If you need any assistance, I'm always here. Is there something specific you'd like help with?"
    ]
};

// ============================================
// STATE
// ============================================

let currentMember = null;       // Full member profile from backend
let memberProfile = null;       // Full dashboard data (hours, upcoming, subscription, announcements)
let engineersList = [];         // Engineers from backend
let selectedDate = null;
let currentCalendarMonth = new Date();
currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() + 1); // Next month for booking
currentCalendarMonth.setDate(1);

// Backend connectivity flag
let backendAvailable = false;

const STORAGE_KEYS = {
    currentMember: 'torch_portal_member',
    profile: 'torch_portal_profile',
    token: 'torch_api_token'
};

// ============================================
// DATA FUNCTIONS — API-first, localStorage cache
// ============================================

// Save current state to localStorage (cache)
function saveData() {
    if (currentMember) {
        localStorage.setItem(STORAGE_KEYS.currentMember, JSON.stringify(currentMember));
    }
    if (memberProfile) {
        localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(memberProfile));
    }
}

// Load from localStorage cache (for instant UI on reload)
function loadData() {
    const saved = localStorage.getItem(STORAGE_KEYS.currentMember);
    if (saved) {
        currentMember = JSON.parse(saved);
        const profile = localStorage.getItem(STORAGE_KEYS.profile);
        if (profile) memberProfile = JSON.parse(profile);
        return true;
    }
    return false;
}

// Clear session — logout
function clearSession() {
    currentMember = null;
    memberProfile = null;
    engineersList = [];
    localStorage.removeItem(STORAGE_KEYS.currentMember);
    localStorage.removeItem(STORAGE_KEYS.profile);
    if (typeof TorchAPI !== 'undefined') {
        TorchAPI.auth.logout();
    }
}

// Fetch fresh profile from backend and update local state
async function refreshProfile() {
    if (typeof TorchAPI === 'undefined' || !TorchAPI.auth.isAuthenticated()) return false;

    try {
        const data = await TorchAPI.members.getProfile();
        memberProfile = data;

        // Map backend profile to currentMember shape for UI compatibility
        currentMember = {
            id: data.member.id,
            email: data.member.email,
            name: data.member.name,
            tier: data.member.tier,
            founding: data.member.founding,
            joinDate: (data.member.joinDate || '').split('T')[0],
            phone: data.member.phone,
            company: data.member.company,
            hoursUsed: parseFloat(data.hours.used) || 0,
            hoursScheduled: parseFloat(data.hours.scheduled) || 0,
            sessions: (data.upcoming || []).map(b => ({
                id: b.id,
                date: (b.date || '').split('T')[0],
                startTime: (b.start_time || '').slice(0, 5),
                endTime: (b.end_time || '').slice(0, 5),
                type: b.type,
                hours: parseFloat(b.hours) || 0,
                guests: b.guest_count,
                notes: b.notes,
                status: b.status,
                engineerName: b.engineer_name
            })),
            guests: [],  // loaded separately
            history: (data.history || []).map(b => ({
                date: (b.date || '').split('T')[0],
                type: b.type,
                hours: parseFloat(b.hours) || 0
            })),
            tierConfig: data.tierConfig,
            subscription: data.subscription,
            announcements: data.announcements || []
        };

        // Load guests for each upcoming booking
        try {
            const allGuests = await TorchAPI.guests.list();
            currentMember.guests = allGuests.map(g => ({
                id: g.id,
                name: g.name,
                session: g.booking_id,
                email: g.email || '',
                phone: g.phone || ''
            }));
        } catch (e) {
            console.warn('[TORCH] Could not load guests:', e.message);
        }

        saveData();
        backendAvailable = true;
        return true;
    } catch (err) {
        console.warn('[TORCH] Backend unavailable, using cached data:', err.message);
        backendAvailable = false;
        return false;
    }
}

// Fetch engineers from backend
async function refreshEngineers() {
    if (typeof TorchAPI === 'undefined' || !TorchAPI.auth.isAuthenticated()) return;

    try {
        const engineers = await TorchAPI.engineers.list();
        engineersList = engineers.map(e => ({
            id: e.id,
            name: e.name,
            role: e.title || e.role || 'Engineer',
            specialties: e.specialties || [],
            bio: e.bio || '',
            photoUrl: e.photo_url || '',
            geniusUrl: e.genius_url || '',
            premiumRate: Number(e.premium_rate) || 0,
            available: e.available !== false
        }));
    } catch (e) {
        console.warn('[TORCH] Could not load engineers:', e.message);
        engineersList = [];  // no placeholder engineers — real ones come from the backend
    }
}

// Listen for auth expiration
if (typeof window !== 'undefined') {
    window.addEventListener('torch:auth:expired', () => {
        clearSession();
        if (document.getElementById('portal-screen')) {
            document.getElementById('portal-screen').classList.remove('active');
            document.getElementById('portal-screen').style.display = 'none';
            document.getElementById('login-screen').classList.add('active');
            document.getElementById('login-screen').style.display = '';
        }
        showToast('Session expired. Please log in again.', 'error');
    });
}

console.log('[TORCH] Data layer initialized (API-first mode)');
