/**
 * OITH Payment Server
 * 
 * This server handles Stripe payment processing for subscriptions.
 * 
 * Setup:
 * 1. npm install express stripe cors dotenv
 * 2. Create .env file with your Stripe keys
 * 3. Run: node server.js
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Stripe setup - Use test keys for development
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_YOUR_SECRET_KEY');

// Your domain for redirects
const DOMAIN = process.env.DOMAIN || 'http://localhost:3000';

// ==========================================
// SUBSCRIPTION PLANS
// ==========================================
const SUBSCRIPTION_PLANS = {
    monthly: {
        name: 'OITH Premium Monthly',
        price: 999, // $9.99 in cents
        interval: 'month',
        features: [
            'Unlimited matches',
            'See who likes you',
            'Advanced filters',
            'Priority support'
        ]
    },
    yearly: {
        name: 'OITH Premium Yearly',
        price: 7999, // $79.99 in cents (saves ~33%)
        interval: 'year',
        features: [
            'All monthly features',
            'Save 33%',
            'Exclusive yearly badge',
            'Early access to features'
        ]
    }
};

// Store price IDs after creating products (set these after running /setup-products)
let priceIds = {
    monthly: process.env.STRIPE_PRICE_MONTHLY || null,
    yearly: process.env.STRIPE_PRICE_YEARLY || null
};

// ==========================================
// ROUTES
// ==========================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        mode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_live') ? 'live' : 'test',
        timestamp: new Date().toISOString()
    });
});

// Get subscription plans
app.get('/api/plans', (req, res) => {
    res.json(SUBSCRIPTION_PLANS);
});

// ==========================================
// STRIPE CHECKOUT (Recommended)
// ==========================================

// Create Stripe Checkout Session
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        const { plan, email, userId } = req.body;
        
        if (!SUBSCRIPTION_PLANS[plan]) {
            return res.status(400).json({ error: 'Invalid plan' });
        }

        const planDetails = SUBSCRIPTION_PLANS[plan];
        
        // Create or get Stripe customer
        let customer;
        if (email) {
            const customers = await stripe.customers.list({ email, limit: 1 });
            if (customers.data.length > 0) {
                customer = customers.data[0];
            } else {
                customer = await stripe.customers.create({ 
                    email,
                    metadata: { userId: userId || 'unknown' }
                });
            }
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'subscription',
            customer: customer?.id,
            customer_email: customer ? undefined : email,
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: planDetails.name,
                        description: planDetails.features.join(' • '),
                        images: ['https://your-domain.com/logo.png'], // Add your logo
                    },
                    unit_amount: planDetails.price,
                    recurring: {
                        interval: planDetails.interval
                    }
                },
                quantity: 1,
            }],
            success_url: `${DOMAIN}/index.html?payment=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${DOMAIN}/index.html?payment=cancelled`,
            metadata: {
                userId: userId || 'unknown',
                plan: plan
            }
        });

        res.json({ 
            sessionId: session.id, 
            url: session.url 
        });

    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Verify payment success
app.get('/api/verify-payment/:sessionId', async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
        
        if (session.payment_status === 'paid') {
            const subscription = await stripe.subscriptions.retrieve(session.subscription);
            
            res.json({
                success: true,
                subscription: {
                    id: subscription.id,
                    status: subscription.status,
                    plan: session.metadata.plan,
                    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                    cancelAtPeriodEnd: subscription.cancel_at_period_end
                },
                customer: {
                    id: session.customer,
                    email: session.customer_email
                }
            });
        } else {
            res.json({ success: false, status: session.payment_status });
        }
    } catch (error) {
        console.error('Verify error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// STRIPE PAYMENT LINKS (No-code option)
// ==========================================

// Create a payment link
app.post('/api/create-payment-link', async (req, res) => {
    try {
        const { plan } = req.body;
        const planDetails = SUBSCRIPTION_PLANS[plan];
        
        if (!planDetails) {
            return res.status(400).json({ error: 'Invalid plan' });
        }

        // First create a product
        const product = await stripe.products.create({
            name: planDetails.name,
            description: planDetails.features.join(' • ')
        });

        // Create a price for the product
        const price = await stripe.prices.create({
            product: product.id,
            unit_amount: planDetails.price,
            currency: 'usd',
            recurring: { interval: planDetails.interval }
        });

        // Create the payment link
        const paymentLink = await stripe.paymentLinks.create({
            line_items: [{ price: price.id, quantity: 1 }],
            after_completion: {
                type: 'redirect',
                redirect: { url: `${DOMAIN}/index.html?payment=success` }
            }
        });

        res.json({ 
            url: paymentLink.url,
            id: paymentLink.id
        });

    } catch (error) {
        console.error('Payment link error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// SUBSCRIPTION MANAGEMENT
// ==========================================

// Get customer's subscription
app.get('/api/subscription/:customerId', async (req, res) => {
    try {
        const subscriptions = await stripe.subscriptions.list({
            customer: req.params.customerId,
            status: 'active',
            limit: 1
        });

        if (subscriptions.data.length > 0) {
            const sub = subscriptions.data[0];
            res.json({
                active: true,
                subscription: {
                    id: sub.id,
                    status: sub.status,
                    currentPeriodEnd: new Date(sub.current_period_end * 1000),
                    cancelAtPeriodEnd: sub.cancel_at_period_end,
                    plan: sub.items.data[0]?.price?.recurring?.interval
                }
            });
        } else {
            res.json({ active: false });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cancel subscription
app.post('/api/cancel-subscription', async (req, res) => {
    try {
        const { subscriptionId } = req.body;
        
        // Cancel at period end (user keeps access until paid period ends)
        const subscription = await stripe.subscriptions.update(subscriptionId, {
            cancel_at_period_end: true
        });

        res.json({
            success: true,
            message: 'Subscription will be cancelled at the end of the billing period',
            cancelAt: new Date(subscription.current_period_end * 1000)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Resume subscription (if cancelled but still active)
app.post('/api/resume-subscription', async (req, res) => {
    try {
        const { subscriptionId } = req.body;
        
        const subscription = await stripe.subscriptions.update(subscriptionId, {
            cancel_at_period_end: false
        });

        res.json({
            success: true,
            message: 'Subscription resumed',
            subscription
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// WEBHOOKS (Important for production!)
// ==========================================

// Webhook endpoint to receive Stripe events
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            console.log('✅ Payment successful:', session.id);
            // TODO: Update user's subscription in your database
            // await updateUserSubscription(session.metadata.userId, session.subscription);
            break;

        case 'customer.subscription.updated':
            const subscription = event.data.object;
            console.log('📝 Subscription updated:', subscription.id);
            // TODO: Update subscription status in your database
            break;

        case 'customer.subscription.deleted':
            const deletedSub = event.data.object;
            console.log('❌ Subscription cancelled:', deletedSub.id);
            // TODO: Remove premium access from user
            break;

        case 'invoice.payment_failed':
            const invoice = event.data.object;
            console.log('⚠️ Payment failed:', invoice.id);
            // TODO: Notify user about failed payment
            break;

        default:
            console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
});

// ==========================================
// TEST MODE ENDPOINTS (For development)
// ==========================================

// Simulate successful payment (TEST MODE ONLY)
app.post('/api/test/simulate-payment', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Not available in production' });
    }

    const { userId, plan } = req.body;
    const planDetails = SUBSCRIPTION_PLANS[plan] || SUBSCRIPTION_PLANS.monthly;
    
    // Calculate expiry based on plan
    const now = new Date();
    const expiryDate = new Date(now);
    if (plan === 'yearly') {
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    } else {
        expiryDate.setMonth(expiryDate.getMonth() + 1);
    }

    res.json({
        success: true,
        testMode: true,
        subscription: {
            id: 'test_sub_' + Date.now(),
            userId,
            plan,
            status: 'active',
            startDate: now.toISOString(),
            expiryDate: expiryDate.toISOString(),
            amount: planDetails.price / 100,
            currency: 'usd'
        }
    });
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    OITH Payment Server                       ║
╠══════════════════════════════════════════════════════════════╣
║  Server running on: http://localhost:${PORT}                    ║
║  Mode: ${process.env.STRIPE_SECRET_KEY?.startsWith('sk_live') ? 'LIVE 🔴' : 'TEST 🟢'}                                            ║
║                                                              ║
║  Endpoints:                                                  ║
║  • GET  /api/health           - Health check                 ║
║  • GET  /api/plans            - Get subscription plans       ║
║  • POST /api/create-checkout-session - Start payment         ║
║  • POST /api/create-payment-link     - Create payment link   ║
║  • GET  /api/subscription/:id        - Get subscription      ║
║  • POST /api/cancel-subscription     - Cancel subscription   ║
║  • POST /webhook              - Stripe webhooks              ║
║  • POST /api/test/simulate-payment   - Test mode only        ║
╚══════════════════════════════════════════════════════════════╝
    `);
});

