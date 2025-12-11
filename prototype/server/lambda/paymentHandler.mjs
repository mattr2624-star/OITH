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

// CORS headers
const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

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
    
    // Handle CORS preflight
    if (method === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
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
            
            // Create subscription with incomplete status
            const subscription = await stripeClient.subscriptions.create({
                customer: customer.id,
                items: [{
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: planDetails.name,
                        },
                        unit_amount: planDetails.price,
                        recurring: {
                            interval: planDetails.interval
                        }
                    }
                }],
                payment_behavior: 'default_incomplete',
                payment_settings: { save_default_payment_method: 'on_subscription' },
                expand: ['latest_invoice.payment_intent'],
                metadata: {
                    userId: userId || 'unknown',
                    plan: plan
                }
            });
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    subscriptionId: subscription.id,
                    clientSecret: subscription.latest_invoice.payment_intent.client_secret,
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
            
            // Create checkout session
            const session = await stripeClient.checkout.sessions.create({
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
                        },
                        unit_amount: planDetails.price,
                        recurring: { interval: planDetails.interval }
                    },
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
                            plan: session.metadata.plan,
                            currentPeriodEnd: subscription.current_period_end
                        });
                    }
                    break;
                }
                
                case 'customer.subscription.updated': {
                    const subscription = stripeEvent.data.object;
                    console.log('📝 Subscription updated:', subscription.id);
                    break;
                }
                
                case 'customer.subscription.deleted': {
                    const subscription = stripeEvent.data.object;
                    console.log('❌ Subscription cancelled:', subscription.id);
                    // Update subscription status in DynamoDB
                    break;
                }
                
                case 'invoice.payment_failed': {
                    const invoice = stripeEvent.data.object;
                    console.log('⚠️ Payment failed:', invoice.id);
                    break;
                }
                
                case 'invoice.paid': {
                    const invoice = stripeEvent.data.object;
                    console.log('💰 Invoice paid:', invoice.id);
                    break;
                }
            }
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ received: true })
            };
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

