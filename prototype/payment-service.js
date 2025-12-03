/**
 * OITH Payment Service
 * 
 * Client-side payment handling for Stripe integration.
 * Supports test mode, Stripe Checkout, and Payment Links.
 */

const PaymentService = {
    // Configuration
    config: {
        apiUrl: 'http://localhost:3000/api',
        stripePublishableKey: 'pk_test_YOUR_PUBLISHABLE_KEY', // Replace with your key
        testMode: true // Set to false for production
    },

    // Stripe instance
    stripe: null,

    // ==========================================
    // INITIALIZATION
    // ==========================================

    /**
     * Initialize the payment service
     */
    async init(publishableKey = null) {
        if (publishableKey) {
            this.config.stripePublishableKey = publishableKey;
        }

        // Load Stripe.js if not already loaded
        if (!window.Stripe) {
            await this.loadStripeJS();
        }

        // Initialize Stripe
        if (this.config.stripePublishableKey && !this.config.stripePublishableKey.includes('YOUR_')) {
            this.stripe = Stripe(this.config.stripePublishableKey);
            this.config.testMode = false;
            console.log('💳 Payment Service initialized with Stripe');
        } else {
            console.log('💳 Payment Service initialized in TEST MODE');
        }

        return this;
    },

    /**
     * Load Stripe.js dynamically
     */
    loadStripeJS() {
        return new Promise((resolve, reject) => {
            if (window.Stripe) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://js.stripe.com/v3/';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    // ==========================================
    // SUBSCRIPTION PLANS
    // ==========================================

    plans: {
        monthly: {
            id: 'monthly',
            name: 'Premium Monthly',
            price: 9.99,
            interval: 'month',
            features: [
                '💕 Unlimited matches per day',
                '👀 See who likes you',
                '🎯 Advanced preference filters',
                '⚡ Priority in matching queue',
                '💬 Read receipts in chat',
                '🔥 Boost profile visibility'
            ]
        },
        yearly: {
            id: 'yearly',
            name: 'Premium Yearly',
            price: 79.99,
            pricePerMonth: 6.67,
            savings: '33%',
            interval: 'year',
            features: [
                '✨ All Monthly features',
                '💰 Save 33% ($40/year)',
                '🏆 Exclusive yearly badge',
                '🚀 Early access to new features',
                '🎁 Special anniversary rewards'
            ],
            popular: true
        }
    },

    // ==========================================
    // STRIPE CHECKOUT (Recommended)
    // ==========================================

    /**
     * Start Stripe Checkout session
     */
    async startCheckout(planId, userEmail, userId) {
        // If in test mode, simulate payment
        if (this.config.testMode) {
            return this.simulatePayment(planId, userId);
        }

        try {
            const response = await fetch(`${this.config.apiUrl}/create-checkout-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan: planId,
                    email: userEmail,
                    userId: userId
                })
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            // Redirect to Stripe Checkout
            if (data.url) {
                window.location.href = data.url;
            } else if (this.stripe) {
                await this.stripe.redirectToCheckout({ sessionId: data.sessionId });
            }

            return { success: true, redirecting: true };

        } catch (error) {
            console.error('Checkout error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Verify payment after redirect
     */
    async verifyPayment(sessionId) {
        if (this.config.testMode) {
            return { success: true, testMode: true };
        }

        try {
            const response = await fetch(`${this.config.apiUrl}/verify-payment/${sessionId}`);
            return await response.json();
        } catch (error) {
            console.error('Verify error:', error);
            return { success: false, error: error.message };
        }
    },

    // ==========================================
    // PAYMENT LINKS (No-code option)
    // ==========================================

    /**
     * Get payment link for a plan
     */
    async getPaymentLink(planId) {
        if (this.config.testMode) {
            return { url: '#test-payment', testMode: true };
        }

        try {
            const response = await fetch(`${this.config.apiUrl}/create-payment-link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan: planId })
            });

            return await response.json();
        } catch (error) {
            console.error('Payment link error:', error);
            return { error: error.message };
        }
    },

    // ==========================================
    // SUBSCRIPTION MANAGEMENT
    // ==========================================

    /**
     * Get current subscription status
     */
    async getSubscription(customerId) {
        if (this.config.testMode) {
            return this.getTestSubscription();
        }

        try {
            const response = await fetch(`${this.config.apiUrl}/subscription/${customerId}`);
            return await response.json();
        } catch (error) {
            console.error('Get subscription error:', error);
            return { active: false, error: error.message };
        }
    },

    /**
     * Cancel subscription
     */
    async cancelSubscription(subscriptionId) {
        if (this.config.testMode) {
            return { success: true, testMode: true, message: 'Test subscription cancelled' };
        }

        try {
            const response = await fetch(`${this.config.apiUrl}/cancel-subscription`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptionId })
            });

            return await response.json();
        } catch (error) {
            console.error('Cancel error:', error);
            return { success: false, error: error.message };
        }
    },

    // ==========================================
    // TEST MODE (Development)
    // ==========================================

    /**
     * Simulate a successful payment (test mode only)
     */
    async simulatePayment(planId, userId) {
        console.log('🧪 Simulating payment in TEST MODE');

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        const plan = this.plans[planId] || this.plans.monthly;
        const now = new Date();
        const expiryDate = new Date(now);
        
        if (planId === 'yearly') {
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        } else {
            expiryDate.setMonth(expiryDate.getMonth() + 1);
        }

        const subscription = {
            id: 'test_sub_' + Date.now(),
            userId: userId,
            plan: planId,
            status: 'active',
            type: 'premium',
            startDate: now.toISOString(),
            expiryDate: expiryDate.toISOString(),
            autoRenew: true,
            amount: plan.price,
            currency: 'usd',
            testMode: true
        };

        // Store in localStorage for testing
        localStorage.setItem('oith_test_subscription', JSON.stringify(subscription));

        return {
            success: true,
            testMode: true,
            subscription
        };
    },

    /**
     * Get test subscription from localStorage
     */
    getTestSubscription() {
        const stored = localStorage.getItem('oith_test_subscription');
        if (stored) {
            const sub = JSON.parse(stored);
            const now = new Date();
            const expiry = new Date(sub.expiryDate);
            
            return {
                active: now < expiry,
                subscription: sub,
                testMode: true
            };
        }
        return { active: false, testMode: true };
    },

    /**
     * Clear test subscription
     */
    clearTestSubscription() {
        localStorage.removeItem('oith_test_subscription');
    },

    // ==========================================
    // HELPERS
    // ==========================================

    /**
     * Format price for display
     */
    formatPrice(amount, currency = 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(amount);
    },

    /**
     * Check if URL has payment result params
     */
    checkPaymentResult() {
        const params = new URLSearchParams(window.location.search);
        const payment = params.get('payment');
        const sessionId = params.get('session_id');

        if (payment === 'success') {
            return { status: 'success', sessionId };
        } else if (payment === 'cancelled') {
            return { status: 'cancelled' };
        }
        return null;
    },

    /**
     * Clear payment result from URL
     */
    clearPaymentResult() {
        const url = new URL(window.location.href);
        url.searchParams.delete('payment');
        url.searchParams.delete('session_id');
        window.history.replaceState({}, '', url);
    }
};

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PaymentService;
}

