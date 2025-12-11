/**
 * OITH Push Notification Service
 * 
 * Handles Firebase Cloud Messaging (FCM) for push notifications
 * Fixes issue #16 - Push notification integration
 * 
 * Required Environment Variables:
 * - FCM_SERVER_KEY: Firebase Cloud Messaging server key
 * - FCM_PROJECT_ID: Firebase project ID
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
    DynamoDBDocumentClient, 
    GetCommand, 
    PutCommand, 
    UpdateCommand,
    QueryCommand,
    DeleteCommand
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'oith-users';
const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY;
const FCM_API_URL = 'https://fcm.googleapis.com/fcm/send';

// ==========================================
// DEVICE TOKEN MANAGEMENT
// ==========================================

/**
 * Register device token for push notifications
 */
export async function registerDeviceToken(event) {
    const body = JSON.parse(event.body || '{}');
    const { email, token, platform, deviceInfo } = body;
    
    if (!email || !token) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'email and token are required' })
        };
    }
    
    try {
        await docClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                pk: `PUSH#${email.toLowerCase()}`,
                sk: `TOKEN#${token}`,
                email: email.toLowerCase(),
                token,
                platform: platform || 'unknown', // 'ios', 'android', 'web'
                deviceInfo: deviceInfo || {},
                registeredAt: new Date().toISOString(),
                lastUsed: new Date().toISOString()
            }
        }));
        
        console.log(`📱 Push token registered for ${email}: ${token.substring(0, 20)}...`);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true })
        };
    } catch (error) {
        console.error('Register token error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message })
        };
    }
}

/**
 * Unregister device token
 */
export async function unregisterDeviceToken(event) {
    const body = JSON.parse(event.body || '{}');
    const { email, token } = body;
    
    if (!email || !token) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'email and token are required' })
        };
    }
    
    try {
        await docClient.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
                pk: `PUSH#${email.toLowerCase()}`,
                sk: `TOKEN#${token}`
            }
        }));
        
        console.log(`📱 Push token unregistered for ${email}`);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true })
        };
    } catch (error) {
        console.error('Unregister token error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message })
        };
    }
}

/**
 * Get all device tokens for a user
 */
async function getDeviceTokens(email) {
    try {
        const result = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: { ':pk': `PUSH#${email.toLowerCase()}` }
        }));
        
        return (result.Items || []).map(item => ({
            token: item.token,
            platform: item.platform
        }));
    } catch (error) {
        console.error('Get tokens error:', error);
        return [];
    }
}

// ==========================================
// SEND PUSH NOTIFICATIONS
// ==========================================

/**
 * Send push notification to a user
 */
export async function sendPushNotification(email, notification) {
    if (!FCM_SERVER_KEY) {
        console.log('⚠️ FCM not configured, skipping push notification');
        return false;
    }
    
    const tokens = await getDeviceTokens(email);
    
    if (tokens.length === 0) {
        console.log(`📱 No push tokens registered for ${email}`);
        return false;
    }
    
    const results = [];
    
    for (const { token, platform } of tokens) {
        try {
            const payload = buildNotificationPayload(notification, platform, token);
            
            const response = await fetch(FCM_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `key=${FCM_SERVER_KEY}`
                },
                body: JSON.stringify(payload)
            });
            
            const result = await response.json();
            
            if (result.success === 1) {
                console.log(`📱 Push sent to ${email} on ${platform}`);
                results.push({ token, success: true });
                
                // Update last used timestamp
                await docClient.send(new UpdateCommand({
                    TableName: TABLE_NAME,
                    Key: { pk: `PUSH#${email.toLowerCase()}`, sk: `TOKEN#${token}` },
                    UpdateExpression: 'SET lastUsed = :time',
                    ExpressionAttributeValues: { ':time': new Date().toISOString() }
                }));
            } else {
                console.log(`📱 Push failed to ${email}:`, result);
                results.push({ token, success: false, error: result.results?.[0]?.error });
                
                // Remove invalid tokens
                if (result.results?.[0]?.error === 'NotRegistered' || 
                    result.results?.[0]?.error === 'InvalidRegistration') {
                    await docClient.send(new DeleteCommand({
                        TableName: TABLE_NAME,
                        Key: { pk: `PUSH#${email.toLowerCase()}`, sk: `TOKEN#${token}` }
                    }));
                    console.log(`📱 Removed invalid token for ${email}`);
                }
            }
        } catch (error) {
            console.error(`Push notification error for ${email}:`, error);
            results.push({ token, success: false, error: error.message });
        }
    }
    
    return results.some(r => r.success);
}

/**
 * Build FCM notification payload based on platform
 */
function buildNotificationPayload(notification, platform, token) {
    const base = {
        to: token,
        priority: 'high',
        content_available: true
    };
    
    // Common notification content
    const notificationContent = {
        title: notification.title || 'OITH',
        body: notification.body || notification.message || '',
        sound: 'default',
        badge: 1
    };
    
    // Platform-specific data
    const data = {
        type: notification.type,
        ...notification.data,
        click_action: getClickAction(notification.type)
    };
    
    if (platform === 'ios') {
        // iOS uses notification + data
        return {
            ...base,
            notification: {
                ...notificationContent,
                mutable_content: true
            },
            data
        };
    } else if (platform === 'android') {
        // Android can use data-only for more control
        return {
            ...base,
            data: {
                ...data,
                title: notificationContent.title,
                body: notificationContent.body
            },
            android: {
                priority: 'high',
                notification: {
                    ...notificationContent,
                    channel_id: getChannelId(notification.type),
                    icon: 'ic_notification'
                }
            }
        };
    } else {
        // Web/default
        return {
            ...base,
            notification: notificationContent,
            data,
            webpush: {
                headers: {
                    Urgency: 'high'
                },
                notification: {
                    ...notificationContent,
                    icon: '/icons/icon-192.png',
                    badge: '/icons/badge-72.png'
                }
            }
        };
    }
}

/**
 * Get click action based on notification type
 */
function getClickAction(type) {
    const actions = {
        'mutual_match': 'OPEN_CHAT',
        'new_message': 'OPEN_CHAT',
        'unmatched': 'OPEN_MATCHES',
        'connection_warning': 'OPEN_CHAT',
        'connection_expired': 'OPEN_MATCHES',
        'decision_warning': 'OPEN_MATCH',
        'decision_expired': 'OPEN_MATCHES',
        'payment_failed': 'OPEN_SUBSCRIPTION',
        'new_user_nearby': 'OPEN_MATCHES'
    };
    return actions[type] || 'OPEN_APP';
}

/**
 * Get Android notification channel ID based on type
 */
function getChannelId(type) {
    const channels = {
        'mutual_match': 'matches',
        'new_message': 'messages',
        'unmatched': 'matches',
        'connection_warning': 'timers',
        'connection_expired': 'timers',
        'decision_warning': 'timers',
        'decision_expired': 'timers',
        'payment_failed': 'account',
        'new_user_nearby': 'matches'
    };
    return channels[type] || 'general';
}

// ==========================================
// NOTIFICATION TYPES
// ==========================================

/**
 * Send new message notification
 */
export async function notifyNewMessage(toEmail, fromName, messagePreview) {
    return sendPushNotification(toEmail, {
        type: 'new_message',
        title: `💬 ${fromName}`,
        body: messagePreview.length > 50 ? messagePreview.substring(0, 50) + '...' : messagePreview,
        data: { fromName }
    });
}

/**
 * Send mutual match notification
 */
export async function notifyMutualMatch(toEmail, matchName, matchPhoto) {
    return sendPushNotification(toEmail, {
        type: 'mutual_match',
        title: '🎉 It\'s a Match!',
        body: `You and ${matchName} liked each other! Start chatting now.`,
        data: { matchName, matchPhoto }
    });
}

/**
 * Send unmatch notification
 */
export async function notifyUnmatched(toEmail) {
    return sendPushNotification(toEmail, {
        type: 'unmatched',
        title: '💔 Match Ended',
        body: 'Your match has ended. Find someone new!',
        data: {}
    });
}

/**
 * Send timer warning notification
 */
export async function notifyTimerWarning(toEmail, matchName, hoursRemaining, timerType) {
    const title = timerType === 'connection' 
        ? `⏰ ${hoursRemaining}h left with ${matchName}!`
        : `⏰ ${hoursRemaining}h to decide on ${matchName}!`;
    
    const body = timerType === 'connection'
        ? 'Plan a date before time runs out!'
        : 'Accept or pass before time expires.';
    
    return sendPushNotification(toEmail, {
        type: `${timerType}_warning`,
        title,
        body,
        data: { matchName, hoursRemaining, timerType }
    });
}

/**
 * Send timer expired notification
 */
export async function notifyTimerExpired(toEmail, matchName, timerType) {
    const title = timerType === 'connection'
        ? '⏰ Connection Expired'
        : '⏰ Decision Time Expired';
    
    const body = timerType === 'connection'
        ? `Your 24h with ${matchName} ended. Finding someone new!`
        : `Time ran out. Finding your next match!`;
    
    return sendPushNotification(toEmail, {
        type: `${timerType}_expired`,
        title,
        body,
        data: { matchName, timerType }
    });
}

/**
 * Send payment failed notification
 */
export async function notifyPaymentFailed(toEmail) {
    return sendPushNotification(toEmail, {
        type: 'payment_failed',
        title: '⚠️ Payment Issue',
        body: 'Your payment couldn\'t be processed. Update your payment method.',
        data: {}
    });
}

/**
 * Send new user nearby notification
 */
export async function notifyNewUserNearby(toEmail, distance) {
    return sendPushNotification(toEmail, {
        type: 'new_user_nearby',
        title: '🆕 New Match Available!',
        body: `Someone new just joined ${distance ? `${distance} miles away` : 'near you'}!`,
        data: { distance }
    });
}

// ==========================================
// BATCH NOTIFICATION PROCESSING
// ==========================================

/**
 * Process pending notifications from queue
 * Called by scheduled Lambda or EventBridge
 */
export async function processPendingNotifications(event) {
    try {
        // Get pending notifications
        const result = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'status-createdAt-index', // Needs GSI
            KeyConditionExpression: '#status = :pending',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':pending': 'pending' },
            Limit: 100
        }));
        
        const notifications = result.Items || [];
        console.log(`📱 Processing ${notifications.length} pending notifications`);
        
        let successCount = 0;
        let failCount = 0;
        
        for (const notif of notifications) {
            const sent = await sendPushNotification(notif.email, {
                type: notif.type,
                title: notif.title,
                body: notif.body,
                data: notif.data
            });
            
            // Update status
            await docClient.send(new UpdateCommand({
                TableName: TABLE_NAME,
                Key: { pk: notif.pk, sk: notif.sk },
                UpdateExpression: 'SET #status = :status, processedAt = :time',
                ExpressionAttributeNames: { '#status': 'status' },
                ExpressionAttributeValues: {
                    ':status': sent ? 'sent' : 'failed',
                    ':time': new Date().toISOString()
                }
            }));
            
            if (sent) successCount++;
            else failCount++;
        }
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                processed: notifications.length,
                success: successCount,
                failed: failCount
            })
        };
    } catch (error) {
        console.error('Process notifications error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message })
        };
    }
}

// ==========================================
// MAIN HANDLER
// ==========================================

export const handler = async (event) => {
    const path = event.path || event.rawPath || '';
    const method = event.httpMethod || event.requestContext?.http?.method;
    
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
    };
    
    if (method === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    if (method === 'POST' && path.includes('/register-token')) {
        return registerDeviceToken(event);
    }
    
    if (method === 'POST' && path.includes('/unregister-token')) {
        return unregisterDeviceToken(event);
    }
    
    if (method === 'POST' && path.includes('/process-pending')) {
        return processPendingNotifications(event);
    }
    
    return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Not found' })
    };
};

