/**
 * AWS Lambda Function for OITH Stripe Payments
 * Handles: Payment intents, subscriptions, webhooks
 * 
 * Required Environment Variables:
 * - STRIPE_SECRET_KEY: Your Stripe secret key (sk_test_xxx or sk_live_xxx)
 * - DYNAMODB_TABLE: DynamoDB table name (default: oith-users)
 * - DOMAIN: Your app domain for redirects
 * 
 * Required Lambda Layer or bundled dependency:
 * - stripe (npm package)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

// Initialize DynamoDB
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMODB_TABLE || 'oith-users';
const DOMAIN = process.env.DOMAIN || 'https://main.d3cpep2ztx08x2.amplifyapp.com';

// Stripe will be initialized dynamically
let stripe = null;

// Subscription plans (monthly only - $10/month)
const SUBSCRIPTION_PLANS = {
    monthly: {
        name: 'OITH Premium Monthly',
        price: 1000, // $10.00 in cents
        interval: 'month',
        features: ['Unlimited matches', 'See who likes you', 'Advanced filters', 'Priority support']
    }
};

// CORS headers - formatted for HTTP API v2 compatibility
const corsHeaders = {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, authorization, x-amz-date, x-api-key, x-amz-security-token',
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'access-control-max-age': '86400'
};

// Wrapper to ensure headers work with both HTTP API v1 and v2
const headers = corsHeaders;

// Initialize Stripe
async function getStripe() {
    if (!stripe) {
        // Dynamic import for Lambda compatibility
        const Stripe = (await import('stripe')).default;
        stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    }
    return stripe;
}

export const handler = async (event) => {
    const method = event.httpMethod || event.requestContext?.http?.method;
    const path = event.path || event.rawPath || '';
    
    // Handle CORS preflight - explicit response for HTTP API v2
    if (method === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Max-Age': '86400',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: 'CORS preflight successful' })
        };
    }
    
    try {
        // ============ HEALTH CHECK ============
        if (method === 'GET' && path.includes('/health')) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    status: 'ok',
                    service: 'oith-payments',
                    mode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_live') ? 'live' : 'test',
                    timestamp: new Date().toISOString()
                })
            };
        }
        
        // ============ GET PLANS ============
        if (method === 'GET' && path.includes('/plans')) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(SUBSCRIPTION_PLANS)
            };
        }
        
        // ============ SUBSCRIPTION STATS (Admin Dashboard) ============
        if (method === 'GET' && path.includes('/subscription-stats')) {
            const stripeClient = await getStripe();
            
            try {
                // Get all subscriptions (active and canceled for churn calculation)
                const [activeSubscriptions, canceledSubscriptions, pastDueSubscriptions] = await Promise.all([
                    stripeClient.subscriptions.list({ status: 'active', limit: 100 }),
                    stripeClient.subscriptions.list({ status: 'canceled', limit: 100 }),
                    stripeClient.subscriptions.list({ status: 'past_due', limit: 100 })
                ]);
                
                const activeCount = activeSubscriptions.data.length;
                const canceledCount = canceledSubscriptions.data.length;
                const pastDueCount = pastDueSubscriptions.data.length;
                
                // Calculate MRR from active subscriptions
                let mrr = 0;
                for (const sub of activeSubscriptions.data) {
                    for (const item of sub.items.data) {
                        // Get the recurring amount per month
                        const amount = item.price.unit_amount / 100; // Convert cents to dollars
                        const interval = item.price.recurring?.interval;
                        const intervalCount = item.price.recurring?.interval_count || 1;
                        
                        if (interval === 'month') {
                            mrr += amount / intervalCount;
                        } else if (interval === 'year') {
                            mrr += amount / (12 * intervalCount);
                        } else if (interval === 'week') {
                            mrr += (amount * 52) / (12 * intervalCount);
                        }
                    }
                }
                
                // Calculate churn rate (last 30 days)
                const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
                const recentCancellations = canceledSubscriptions.data.filter(
                    sub => sub.canceled_at && sub.canceled_at >= thirtyDaysAgo
                ).length;
                
                // Churn = cancellations / (active + cancellations) over period
                const totalSubscribersInPeriod = activeCount + recentCancellations;
                const monthlyChurnRate = totalSubscribersInPeriod > 0 
                    ? (recentCancellations / totalSubscribersInPeriod) * 100 
                    : 0;
                
                // Get customer count for conversion rate
                const customers = await stripeClient.customers.list({ limit: 100 });
                const totalCustomers = customers.data.length;
                const conversionRate = totalCustomers > 0 
                    ? (activeCount / totalCustomers) * 100 
                    : 0;
                
                // Get revenue history for chart (last 6 months)
                const revenueByMonth = {};
                const now = new Date();
                for (let i = 5; i >= 0; i--) {
                    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    const monthKey = monthDate.toISOString().slice(0, 7); // YYYY-MM format
                    revenueByMonth[monthKey] = 0;
                }
                
                // Get charges for revenue history
                const charges = await stripeClient.charges.list({ 
                    limit: 100,
                    created: { gte: Math.floor(new Date(now.getFullYear(), now.getMonth() - 5, 1).getTime() / 1000) }
                });
                
                for (const charge of charges.data) {
                    if (charge.status === 'succeeded' && !charge.refunded) {
                        const chargeDate = new Date(charge.created * 1000);
                        const monthKey = chargeDate.toISOString().slice(0, 7);
                        if (revenueByMonth.hasOwnProperty(monthKey)) {
                            revenueByMonth[monthKey] += charge.amount / 100;
                        }
                    }
                }
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        mrr: Math.round(mrr * 100) / 100,
                        activeSubscriptions: activeCount,
                        canceledSubscriptions: canceledCount,
                        pastDueSubscriptions: pastDueCount,
                        monthlyChurnRate: Math.round(monthlyChurnRate * 10) / 10,
                        conversionRate: Math.round(conversionRate * 10) / 10,
                        totalCustomers: totalCustomers,
                        revenueByMonth: revenueByMonth,
                        lastUpdated: new Date().toISOString()
                    })
                };
                
            } catch (error) {
                console.error('Error fetching subscription stats:', error);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ error: error.message })
                };
            }
        }
        
        // ============ CREATE PAYMENT INTENT (Embedded Checkout) ============
        if (method === 'POST' && path.includes('/create-payment-intent')) {
            const stripeClient = await getStripe();
            const body = JSON.parse(event.body || '{}');
            const { plan, email, userId } = body;
            
            if (!SUBSCRIPTION_PLANS[plan]) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid plan' })
                };
            }
            
            const planDetails = SUBSCRIPTION_PLANS[plan];
            
            // Create or get Stripe customer
            let customer;
            if (email) {
                const customers = await stripeClient.customers.list({ email, limit: 1 });
                if (customers.data.length > 0) {
                    customer = customers.data[0];
                } else {
                    customer = await stripeClient.customers.create({
                        email,
                        metadata: { userId: userId || 'unknown' }
                    });
                }
            }
            
            // Get or create the OITH Premium product
            let product;
            const existingProducts = await stripeClient.products.list({ 
                limit: 1, 
                active: true 
            });
            
            const oithProduct = existingProducts.data.find(p => p.name === 'OITH Premium Monthly');
            if (oithProduct) {
                product = oithProduct;
            } else {
                product = await stripeClient.products.create({
                    name: 'OITH Premium Monthly',
                    description: planDetails.features.join(' • ')
                });
            }
            
            // Get or create the price for this product
            let price;
            const existingPrices = await stripeClient.prices.list({
                product: product.id,
                active: true,
                limit: 1
            });
            
            if (existingPrices.data.length > 0) {
                price = existingPrices.data[0];
            } else {
                price = await stripeClient.prices.create({
                    product: product.id,
                    unit_amount: planDetails.price,
                    currency: 'usd',
                    recurring: { interval: planDetails.interval }
                });
            }
            
            // Create subscription with the price
            const subscription = await stripeClient.subscriptions.create({
                customer: customer.id,
                items: [{ price: price.id }],
                payment_behavior: 'default_incomplete',
                payment_settings: { save_default_payment_method: 'on_subscription' },
                expand: ['latest_invoice.payment_intent'],
                metadata: {
                    userId: userId || 'unknown',
                    plan: plan
                }
            });
            
            // Get the client secret from the payment intent
            const paymentIntent = subscription.latest_invoice?.payment_intent;
            
            if (!paymentIntent || !paymentIntent.client_secret) {
                // If no payment intent, the subscription might already be active or needs different handling
                console.log('Subscription created but no payment intent:', subscription.status);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        subscriptionId: subscription.id,
                        status: subscription.status,
                        customerId: customer.id,
                        message: 'Subscription created successfully'
                    })
                };
            }
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    subscriptionId: subscription.id,
                    clientSecret: paymentIntent.client_secret,
                    customerId: customer.id
                })
            };
        }
        
        // ============ CREATE CHECKOUT SESSION (Redirect) ============
        if (method === 'POST' && path.includes('/create-checkout-session')) {
            const stripeClient = await getStripe();
            const body = JSON.parse(event.body || '{}');
            const { plan, email, userId } = body;
            
            if (!SUBSCRIPTION_PLANS[plan]) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid plan' })
                };
            }
            
            const planDetails = SUBSCRIPTION_PLANS[plan];
            
            // Create or get customer
            let customer;
            if (email) {
                const customers = await stripeClient.customers.list({ email, limit: 1 });
                if (customers.data.length > 0) {
                    customer = customers.data[0];
                } else {
                    customer = await stripeClient.customers.create({
                        email,
                        metadata: { userId: userId || 'unknown' }
                    });
                }
            }
            
            // Get or create the OITH Premium product
            let product;
            const existingProducts = await stripeClient.products.list({ 
                limit: 10, 
                active: true 
            });
            
            const oithProduct = existingProducts.data.find(p => p.name === 'OITH Premium Monthly');
            if (oithProduct) {
                product = oithProduct;
            } else {
                product = await stripeClient.products.create({
                    name: 'OITH Premium Monthly',
                    description: planDetails.features.join(' • ')
                });
            }
            
            // Get or create the price for this product
            let price;
            const existingPrices = await stripeClient.prices.list({
                product: product.id,
                active: true,
                limit: 1
            });
            
            if (existingPrices.data.length > 0) {
                price = existingPrices.data[0];
            } else {
                price = await stripeClient.prices.create({
                    product: product.id,
                    unit_amount: planDetails.price,
                    currency: 'usd',
                    recurring: { interval: planDetails.interval }
                });
            }
            
            // Create checkout session with the price
            const session = await stripeClient.checkout.sessions.create({
                payment_method_types: ['card'],
                mode: 'subscription',
                customer: customer?.id,
                customer_email: customer ? undefined : email,
                line_items: [{
                    price: price.id,
                    quantity: 1,
                }],
                success_url: `${DOMAIN}/prototype/index.html?payment=success&session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${DOMAIN}/prototype/index.html?payment=cancelled`,
                metadata: {
                    userId: userId || 'unknown',
                    plan: plan
                }
            });
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ sessionId: session.id, url: session.url })
            };
        }
        
        // ============ VERIFY PAYMENT ============
        if (method === 'GET' && path.includes('/verify-payment/')) {
            const stripeClient = await getStripe();
            const sessionId = path.split('/verify-payment/')[1];
            
            const session = await stripeClient.checkout.sessions.retrieve(sessionId);
            
            if (session.payment_status === 'paid') {
                const subscription = await stripeClient.subscriptions.retrieve(session.subscription);
                
                // Save subscription to DynamoDB
                await saveSubscriptionToDynamoDB(session.metadata.userId, session.customer, {
                    id: subscription.id,
                    status: subscription.status,
                    plan: session.metadata.plan,
                    currentPeriodEnd: subscription.current_period_end
                });
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        subscription: {
                            id: subscription.id,
                            status: subscription.status,
                            plan: session.metadata.plan,
                            currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString()
                        }
                    })
                };
            }
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: false, status: session.payment_status })
            };
        }
        
        // ============ GET SUBSCRIPTION ============
        if (method === 'GET' && path.includes('/subscription/')) {
            const stripeClient = await getStripe();
            const customerId = path.split('/subscription/')[1];
            
            const subscriptions = await stripeClient.subscriptions.list({
                customer: customerId,
                status: 'active',
                limit: 1
            });
            
            if (subscriptions.data.length > 0) {
                const sub = subscriptions.data[0];
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        active: true,
                        subscription: {
                            id: sub.id,
                            status: sub.status,
                            currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
                            cancelAtPeriodEnd: sub.cancel_at_period_end
                        }
                    })
                };
            }
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ active: false })
            };
        }
        
        // ============ LIST TRANSACTIONS (Admin Dashboard) ============
        if (method === 'GET' && path.includes('/transactions')) {
            const stripeClient = await getStripe();
            
            try {
                // Get recent payment intents (successful charges)
                const paymentIntents = await stripeClient.paymentIntents.list({
                    limit: 100,
                });
                
                // Get recent invoices for subscription payments
                const invoices = await stripeClient.invoices.list({
                    limit: 100,
                    status: 'paid'
                });
                
                // Get charges for more details
                const charges = await stripeClient.charges.list({
                    limit: 100
                });
                
                // Combine and format transactions
                const transactions = [];
                
                // Process charges (most reliable for transaction history)
                for (const charge of charges.data) {
                    // Get customer email
                    let customerEmail = charge.billing_details?.email || '';
                    let customerName = charge.billing_details?.name || '';
                    
                    if (charge.customer && !customerEmail) {
                        try {
                            const customer = await stripeClient.customers.retrieve(charge.customer);
                            customerEmail = customer.email || '';
                            customerName = customerName || customer.name || '';
                        } catch (e) {
                            // Customer may have been deleted
                        }
                    }
                    
                    transactions.push({
                        id: charge.id,
                        date: new Date(charge.created * 1000).toISOString(),
                        amount: charge.amount / 100, // Convert cents to dollars
                        currency: charge.currency.toUpperCase(),
                        status: charge.status === 'succeeded' ? 'paid' : charge.status,
                        description: charge.description || 'Subscription Payment',
                        customerEmail: customerEmail,
                        customerName: customerName,
                        paymentMethod: charge.payment_method_details?.card?.brand || 'card',
                        last4: charge.payment_method_details?.card?.last4 || '****',
                        receiptUrl: charge.receipt_url,
                        refunded: charge.refunded,
                        metadata: charge.metadata
                    });
                }
                
                // Sort by date descending
                transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
                
                // Calculate summary stats
                const now = new Date();
                const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const startOfYear = new Date(now.getFullYear(), 0, 1);
                
                const paidTransactions = transactions.filter(t => t.status === 'paid' && !t.refunded);
                
                const dailyRevenue = paidTransactions
                    .filter(t => new Date(t.date) >= startOfDay)
                    .reduce((sum, t) => sum + t.amount, 0);
                    
                const monthlyRevenue = paidTransactions
                    .filter(t => new Date(t.date) >= startOfMonth)
                    .reduce((sum, t) => sum + t.amount, 0);
                    
                const yearlyRevenue = paidTransactions
                    .filter(t => new Date(t.date) >= startOfYear)
                    .reduce((sum, t) => sum + t.amount, 0);
                
                const totalRevenue = paidTransactions
                    .reduce((sum, t) => sum + t.amount, 0);
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        transactions: transactions,
                        summary: {
                            totalTransactions: transactions.length,
                            paidTransactions: paidTransactions.length,
                            dailyRevenue: dailyRevenue,
                            monthlyRevenue: monthlyRevenue,
                            yearlyRevenue: yearlyRevenue,
                            totalRevenue: totalRevenue
                        },
                        lastUpdated: new Date().toISOString()
                    })
                };
                
            } catch (error) {
                console.error('Error fetching transactions:', error);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ error: error.message })
                };
            }
        }
        
        // ============ CANCEL SUBSCRIPTION ============
        if (method === 'POST' && path.includes('/cancel-subscription')) {
            const stripeClient = await getStripe();
            const body = JSON.parse(event.body || '{}');
            const { subscriptionId } = body;
            
            const subscription = await stripeClient.subscriptions.update(subscriptionId, {
                cancel_at_period_end: true
            });
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Subscription will be cancelled at the end of the billing period',
                    cancelAt: new Date(subscription.current_period_end * 1000).toISOString()
                })
            };
        }
        
        // ============ STRIPE WEBHOOK ============
        if (method === 'POST' && path.includes('/webhook')) {
            const stripeClient = await getStripe();
            const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
            const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
            
            let stripeEvent;
            
            try {
                stripeEvent = stripeClient.webhooks.constructEvent(
                    event.body,
                    sig,
                    endpointSecret
                );
            } catch (err) {
                console.error('Webhook signature verification failed:', err.message);
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: `Webhook Error: ${err.message}` })
                };
            }
            
            // Handle the event
            switch (stripeEvent.type) {
                case 'checkout.session.completed': {
                    const session = stripeEvent.data.object;
                    console.log('✅ Payment successful:', session.id);
                    
                    // Save subscription to DynamoDB
                    if (session.subscription) {
                        const subscription = await stripeClient.subscriptions.retrieve(session.subscription);
                        await saveSubscriptionToDynamoDB(session.metadata.userId, session.customer, {
                            id: subscription.id,
                            status: 'active',
                            plan: session.metadata.plan || 'monthly',
                            currentPeriodEnd: subscription.current_period_end
                        });
                    }
                    break;
                }
                
                case 'customer.subscription.updated': {
                    const subscription = stripeEvent.data.object;
                    console.log('📝 Subscription updated:', subscription.id, 'Status:', subscription.status);
                    
                    // Update subscription status in DynamoDB
                    await updateSubscriptionByStripeId(subscription.id, {
                        status: subscription.status,
                        currentPeriodEnd: subscription.current_period_end,
                        cancelAtPeriodEnd: subscription.cancel_at_period_end
                    });
                    break;
                }
                
                case 'customer.subscription.deleted': {
                    const subscription = stripeEvent.data.object;
                    console.log('❌ Subscription cancelled:', subscription.id);
                    
                    // Mark subscription as cancelled in DynamoDB
                    await updateSubscriptionByStripeId(subscription.id, {
                        status: 'canceled',
                        canceledAt: new Date().toISOString()
                    });
                    break;
                }
                
                case 'invoice.payment_failed': {
                    const invoice = stripeEvent.data.object;
                    console.log('⚠️ Payment failed:', invoice.id, 'Customer:', invoice.customer);
                    
                    // Update subscription status to past_due
                    if (invoice.subscription) {
                        await updateSubscriptionByStripeId(invoice.subscription, {
                            status: 'past_due',
                            lastPaymentFailed: new Date().toISOString(),
                            failureReason: invoice.last_finalization_error?.message || 'Payment failed'
                        });
                    }
                    break;
                }
                
                case 'invoice.paid': {
                    const invoice = stripeEvent.data.object;
                    console.log('💰 Invoice paid:', invoice.id);
                    
                    // Reactivate subscription if it was past_due
                    if (invoice.subscription) {
                        await updateSubscriptionByStripeId(invoice.subscription, {
                            status: 'active',
                            lastPaymentSucceeded: new Date().toISOString()
                        });
                    }
                    break;
                }
            }
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ received: true })
            };
        }
        
        // ============ REGISTER DEVICE (Single Device Limit) ============
        if (method === 'POST' && path.includes('/register-device')) {
            const body = JSON.parse(event.body || '{}');
            const { email, device } = body;
            
            if (!email || !device?.id) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Missing email or device ID' })
                };
            }
            
            try {
                // Get current active device for this user
                const getResult = await docClient.send(new GetCommand({
                    TableName: TABLE_NAME,
                    Key: { pk: `USER#${email.toLowerCase()}`, sk: 'DEVICE' }
                }));
                
                const previousDevice = getResult.Item?.deviceId;
                
                // Update active device
                await docClient.send(new PutCommand({
                    TableName: TABLE_NAME,
                    Item: {
                        pk: `USER#${email.toLowerCase()}`,
                        sk: 'DEVICE',
                        deviceId: device.id,
                        deviceInfo: device,
                        registeredAt: new Date().toISOString()
                    }
                }));
                
                console.log(`📱 Device registered for ${email}: ${device.id}`);
                if (previousDevice && previousDevice !== device.id) {
                    console.log(`📱 Previous device logged out: ${previousDevice}`);
                }
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        deviceId: device.id,
                        previousDevice: previousDevice !== device.id ? previousDevice : null
                    })
                };
            } catch (error) {
                console.error('Device registration error:', error);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ error: error.message })
                };
            }
        }
        
        // ============ VERIFY DEVICE ============
        if (method === 'POST' && path.includes('/verify-device')) {
            const body = JSON.parse(event.body || '{}');
            const { email, deviceId } = body;
            
            if (!email || !deviceId) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Missing email or device ID' })
                };
            }
            
            try {
                const getResult = await docClient.send(new GetCommand({
                    TableName: TABLE_NAME,
                    Key: { pk: `USER#${email.toLowerCase()}`, sk: 'DEVICE' }
                }));
                
                const activeDeviceId = getResult.Item?.deviceId;
                const isActive = activeDeviceId === deviceId;
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        isActive: isActive,
                        message: isActive ? 'Device is active' : 'Another device is active'
                    })
                };
            } catch (error) {
                console.error('Device verification error:', error);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ isActive: true }) // Allow access on error
                };
            }
        }
        
        // ============ 404 NOT FOUND ============
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Not found', path, method })
        };
        
    } catch (error) {
        console.error('Lambda error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

// Helper: Save subscription to DynamoDB
async function saveSubscriptionToDynamoDB(userId, customerId, subscription) {
    if (!userId || userId === 'unknown') return;
    
    try {
        await docClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                pk: `USER#${userId}`,
                sk: 'SUBSCRIPTION',
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscription.id,
                plan: subscription.plan || 'monthly',
                status: subscription.status,
                currentPeriodEnd: new Date(subscription.currentPeriodEnd * 1000).toISOString(),
                updatedAt: new Date().toISOString()
            }
        }));
        console.log('✅ Subscription saved to DynamoDB for user:', userId);
    } catch (error) {
        console.error('Error saving subscription to DynamoDB:', error);
    }
}

// Helper: Update subscription by Stripe Subscription ID
// This is used by webhooks where we only have the Stripe subscription ID
async function updateSubscriptionByStripeId(stripeSubscriptionId, updates) {
    if (!stripeSubscriptionId) {
        console.error('No Stripe subscription ID provided');
        return;
    }
    
    try {
        // First, find the subscription record by Stripe subscription ID
        // We need to scan since we're searching by a non-key attribute
        const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
        
        const scanResult = await docClient.send(new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: 'stripeSubscriptionId = :subId AND sk = :sk',
            ExpressionAttributeValues: {
                ':subId': stripeSubscriptionId,
                ':sk': 'SUBSCRIPTION'
            }
        }));
        
        if (!scanResult.Items || scanResult.Items.length === 0) {
            console.log('⚠️ No subscription found for Stripe ID:', stripeSubscriptionId);
            return;
        }
        
        const subscription = scanResult.Items[0];
        console.log('📝 Found subscription for user:', subscription.pk);
        
        // Build update expression dynamically
        const updateParts = ['updatedAt = :updatedAt'];
        const expressionValues = { ':updatedAt': new Date().toISOString() };
        const expressionNames = {};
        
        if (updates.status !== undefined) {
            updateParts.push('#status = :status');
            expressionValues[':status'] = updates.status;
            expressionNames['#status'] = 'status';
        }
        
        if (updates.currentPeriodEnd !== undefined) {
            updateParts.push('currentPeriodEnd = :periodEnd');
            expressionValues[':periodEnd'] = new Date(updates.currentPeriodEnd * 1000).toISOString();
        }
        
        if (updates.cancelAtPeriodEnd !== undefined) {
            updateParts.push('cancelAtPeriodEnd = :cancelAt');
            expressionValues[':cancelAt'] = updates.cancelAtPeriodEnd;
        }
        
        if (updates.canceledAt !== undefined) {
            updateParts.push('canceledAt = :canceledAt');
            expressionValues[':canceledAt'] = updates.canceledAt;
        }
        
        if (updates.lastPaymentFailed !== undefined) {
            updateParts.push('lastPaymentFailed = :payFailed');
            expressionValues[':payFailed'] = updates.lastPaymentFailed;
        }
        
        if (updates.failureReason !== undefined) {
            updateParts.push('failureReason = :failReason');
            expressionValues[':failReason'] = updates.failureReason;
        }
        
        if (updates.lastPaymentSucceeded !== undefined) {
            updateParts.push('lastPaymentSucceeded = :paySuccess');
            expressionValues[':paySuccess'] = updates.lastPaymentSucceeded;
        }
        
        // Update the subscription record
        await docClient.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { pk: subscription.pk, sk: 'SUBSCRIPTION' },
            UpdateExpression: 'SET ' + updateParts.join(', '),
            ExpressionAttributeValues: expressionValues,
            ...(Object.keys(expressionNames).length > 0 && { ExpressionAttributeNames: expressionNames })
        }));
        
        console.log('✅ Subscription updated for:', subscription.pk, 'New status:', updates.status || 'unchanged');
        
        // Send email notification for status changes
        const userEmail = subscription.pk.replace('USER#', '');
        if (updates.status === 'past_due') {
            await sendPaymentFailedEmail(userEmail, updates.failureReason);
        } else if (updates.status === 'canceled') {
            await sendSubscriptionCanceledEmail(userEmail);
        } else if (updates.status === 'active' && updates.lastPaymentSucceeded) {
            await sendPaymentSuccessEmail(userEmail);
        }
    } catch (error) {
        console.error('Error updating subscription by Stripe ID:', error);
    }
}

// ==========================================
// Email Notification Functions
// ==========================================

const EMAIL_API_URL = process.env.EMAIL_API_URL || 'https://your-email-api.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'OITH <noreply@oith.com>';

/**
 * Send payment failed notification email
 */
async function sendPaymentFailedEmail(userEmail, reason = 'Payment could not be processed') {
    const subject = '⚠️ OITH Payment Failed - Action Required';
    const body = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { text-align: center; padding: 20px 0; }
                .logo { font-size: 24px; font-weight: bold; color: #C4584A; }
                .content { background: #f9f9f9; border-radius: 12px; padding: 24px; margin: 20px 0; }
                .alert { background: #fff3cd; border-left: 4px solid #f39c12; padding: 16px; margin: 16px 0; border-radius: 4px; }
                .btn { display: inline-block; background: #C4584A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0; }
                .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">💕 OITH</div>
                </div>
                <div class="content">
                    <h2>Payment Issue with Your Subscription</h2>
                    <div class="alert">
                        <strong>⚠️ Your last payment couldn't be processed.</strong><br>
                        Reason: ${reason}
                    </div>
                    <p>To keep your Premium access and continue finding meaningful connections, please update your payment method.</p>
                    <p><strong>What happens next?</strong></p>
                    <ul>
                        <li>Your Premium access is currently at risk</li>
                        <li>Update your payment method to avoid interruption</li>
                        <li>No action needed if you've already updated</li>
                    </ul>
                    <center>
                        <a href="${DOMAIN}/prototype/index.html#manage-subscription" class="btn">Update Payment Method</a>
                    </center>
                </div>
                <div class="footer">
                    <p>Questions? Reply to this email or visit our Help Center.</p>
                    <p>© ${new Date().getFullYear()} OITH - One Is the Hero</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    await sendEmail(userEmail, subject, body, 'payment_failed');
}

/**
 * Send subscription canceled notification email
 */
async function sendSubscriptionCanceledEmail(userEmail) {
    const subject = '😢 Your OITH Subscription Has Been Canceled';
    const body = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { text-align: center; padding: 20px 0; }
                .logo { font-size: 24px; font-weight: bold; color: #C4584A; }
                .content { background: #f9f9f9; border-radius: 12px; padding: 24px; margin: 20px 0; }
                .btn { display: inline-block; background: #C4584A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0; }
                .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">💕 OITH</div>
                </div>
                <div class="content">
                    <h2>We're Sorry to See You Go</h2>
                    <p>Your OITH Premium subscription has been canceled.</p>
                    <p>We hope we helped you find some meaningful connections. If you ever want to come back, we'll be here!</p>
                    <p><strong>What you'll miss:</strong></p>
                    <ul>
                        <li>One quality match per day</li>
                        <li>AI-powered compatibility matching</li>
                        <li>Unlimited messaging with matches</li>
                        <li>AI date planning assistance</li>
                    </ul>
                    <center>
                        <a href="${DOMAIN}/prototype/index.html#payment" class="btn">Resubscribe Anytime</a>
                    </center>
                </div>
                <div class="footer">
                    <p>We'd love to hear why you left. Reply to this email with feedback.</p>
                    <p>© ${new Date().getFullYear()} OITH - One Is the Hero</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    await sendEmail(userEmail, subject, body, 'subscription_canceled');
}

/**
 * Send payment success notification email
 */
async function sendPaymentSuccessEmail(userEmail) {
    const subject = '✅ OITH Payment Received - Thank You!';
    const body = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { text-align: center; padding: 20px 0; }
                .logo { font-size: 24px; font-weight: bold; color: #C4584A; }
                .content { background: #f9f9f9; border-radius: 12px; padding: 24px; margin: 20px 0; }
                .success { background: #d4edda; border-left: 4px solid #28a745; padding: 16px; margin: 16px 0; border-radius: 4px; }
                .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">💕 OITH</div>
                </div>
                <div class="content">
                    <h2>Payment Received!</h2>
                    <div class="success">
                        <strong>✅ Your subscription has been renewed.</strong><br>
                        Amount: $10.00 USD
                    </div>
                    <p>Thank you for continuing with OITH Premium! Your subscription is active and you have full access to all features.</p>
                    <p>Keep focusing on who's in front of you! 💕</p>
                </div>
                <div class="footer">
                    <p>Questions about your billing? Reply to this email.</p>
                    <p>© ${new Date().getFullYear()} OITH - One Is the Hero</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    await sendEmail(userEmail, subject, body, 'payment_success');
}

/**
 * Send email via AWS SES or email API
 */
async function sendEmail(to, subject, htmlBody, emailType) {
    try {
        // Store email in queue for sending
        await docClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                pk: 'EMAIL#QUEUE',
                sk: `${Date.now()}_${emailType}`,
                to: to,
                subject: subject,
                body: htmlBody,
                type: emailType,
                status: 'pending',
                createdAt: new Date().toISOString()
            }
        }));
        
        console.log(`📧 Email queued: ${emailType} to ${to}`);
        
        // Try to send via SES if configured
        if (process.env.AWS_SES_ENABLED === 'true') {
            const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
            const sesClient = new SESClient({});
            
            await sesClient.send(new SendEmailCommand({
                Source: FROM_EMAIL,
                Destination: { ToAddresses: [to] },
                Message: {
                    Subject: { Data: subject },
                    Body: { Html: { Data: htmlBody } }
                }
            }));
            
            // Update status to sent
            await docClient.send(new UpdateCommand({
                TableName: TABLE_NAME,
                Key: { pk: 'EMAIL#QUEUE', sk: `${Date.now()}_${emailType}` },
                UpdateExpression: 'SET #status = :status, sentAt = :time',
                ExpressionAttributeNames: { '#status': 'status' },
                ExpressionAttributeValues: { ':status': 'sent', ':time': new Date().toISOString() }
            }));
            
            console.log(`📧 Email sent via SES: ${emailType} to ${to}`);
        }
        
        return true;
    } catch (error) {
        console.error(`Error sending ${emailType} email:`, error);
        return false;
    }
}

