// TORCH ATL Member Portal - Square Billing Integration
// =====================================================

// Square Configuration (loaded from localStorage or defaults)
const SquareBilling = {
    // Configuration
    config: {
        applicationId: '',
        locationId: '',
        environment: 'sandbox'
    },

    // State
    payments: null,
    card: null,
    initialized: false,

    // Load configuration from localStorage (shared with Operations Suite)
    loadConfig: function() {
        const savedConfig = localStorage.getItem('torch_square_config');
        if (savedConfig) {
            const config = JSON.parse(savedConfig);
            this.config.applicationId = config.applicationId || '';
            this.config.locationId = config.locationId || '';
            this.config.environment = config.environment || 'sandbox';
            return true;
        }
        return false;
    },

    // Initialize Square Payments
    init: async function() {
        // Load config
        if (!this.loadConfig()) {
            console.warn('[Square] No configuration found. Please configure Square in Operations Suite.');
            this.showConfigNotice();
            return false;
        }

        if (!this.config.applicationId) {
            console.warn('[Square] Application ID not set.');
            this.showConfigNotice();
            return false;
        }

        // Check if Square SDK is loaded
        if (typeof Square === 'undefined') {
            console.error('[Square] SDK not loaded.');
            return false;
        }

        try {
            // Initialize Square Payments
            this.payments = Square.payments(this.config.applicationId, this.config.locationId);
            this.initialized = true;
            console.log('[Square] Payments initialized successfully');
            return true;
        } catch (error) {
            console.error('[Square] Failed to initialize:', error);
            return false;
        }
    },

    // Show configuration notice
    showConfigNotice: function() {
        const notice = document.getElementById('square-config-notice');
        if (notice) {
            notice.style.display = 'block';
        }
    },

    // Initialize card input
    initCard: async function() {
        if (!this.initialized) {
            const success = await this.init();
            if (!success) return null;
        }

        try {
            // Create card payment method
            this.card = await this.payments.card();

            // Attach to container
            await this.card.attach('#card-container');

            console.log('[Square] Card input attached');
            return this.card;
        } catch (error) {
            console.error('[Square] Failed to initialize card:', error);
            this.showError('Failed to load payment form. Please try again.');
            return null;
        }
    },

    // Tokenize card
    tokenizeCard: async function() {
        if (!this.card) {
            this.showError('Payment form not initialized.');
            return null;
        }

        try {
            const result = await this.card.tokenize();

            if (result.status === 'OK') {
                console.log('[Square] Card tokenized:', result.token);
                return result.token;
            } else {
                let errorMessage = 'Payment failed.';
                if (result.errors && result.errors.length > 0) {
                    errorMessage = result.errors.map(e => e.message).join(', ');
                }
                this.showError(errorMessage);
                return null;
            }
        } catch (error) {
            console.error('[Square] Tokenization failed:', error);
            this.showError('Failed to process card. Please try again.');
            return null;
        }
    },

    // NOTE: Saving the card on file, creating the Square customer, and listing
    // saved cards all happen SERVER-SIDE now (POST /api/billing/payment-method).
    // The browser must never hold the Square secret access token, so those
    // Connect API calls were removed. The client only tokenizes the card (below)
    // and hands the nonce to the backend.

    // Show error message
    showError: function(message) {
        const errorEl = document.getElementById('card-errors');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    },

    // Clear error message
    clearError: function() {
        const errorEl = document.getElementById('card-errors');
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
        }
    }
};

// Handle payment method submission
async function handlePaymentMethod() {
    const button = document.getElementById('card-button');
    button.disabled = true;
    button.textContent = 'Processing...';

    SquareBilling.clearError();

    try {
        if (!currentMember) {
            SquareBilling.showError('Not logged in.');
            button.disabled = false;
            button.textContent = 'Save Card';
            return;
        }

        // Tokenize the card with the public Web Payments SDK.
        const token = await SquareBilling.tokenizeCard();

        if (!token) {
            button.disabled = false;
            button.textContent = 'Save Card';
            return;
        }

        // Hand the nonce to the backend, which creates the Square customer and
        // saves the card on file using the secret token (server-side only).
        const result = await TorchAPI.billing.updatePaymentMethod(token);

        updateCardDisplay(result);
        hideUpdatePayment();
        showToast('Payment method saved successfully!', 'success');

    } catch (error) {
        console.error('[Square] Payment method error:', error);
        SquareBilling.showError(error.message || 'An error occurred. Please try again.');
    }

    button.disabled = false;
    button.textContent = 'Save Card';
}

// Update card display in UI from the backend response ({ last4, brand }).
function updateCardDisplay(card) {
    const brandEl = document.querySelector('.card-brand');
    const numberEl = document.querySelector('.card-number');
    const expiryEl = document.querySelector('.card-expiry');

    if (brandEl) brandEl.textContent = card.brand || 'Card';
    if (numberEl) numberEl.textContent = `•••• •••• •••• ${card.last4 || '••••'}`;
    if (expiryEl) expiryEl.textContent = '';
}

// Override showUpdatePayment to initialize Square card
const originalShowUpdatePayment = window.showUpdatePayment;
window.showUpdatePayment = async function() {
    document.getElementById('payment-method-display').style.display = 'none';
    document.getElementById('update-payment-form').style.display = 'block';

    // Initialize Square card input
    if (!SquareBilling.card) {
        await SquareBilling.initCard();
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Wait a bit for Square SDK to load
    setTimeout(async () => {
        await SquareBilling.init();
    }, 1000);
});

console.log('[Square Billing] Module loaded');
