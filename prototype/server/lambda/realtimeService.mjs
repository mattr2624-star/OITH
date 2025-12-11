/**
 * OITH Real-time Service
 * 
 * Handles WebSocket connections, real-time messaging, and push notifications.
 * Fixes issues: #1, #3, #5, #17 (push notifications, real-time unmatch, 
 * message delivery confirmation, replace polling)
 * 
 * For AWS API Gateway WebSocket API:
 * - $connect - User connects
 * - $disconnect - User disconnects
 * - sendMessage - Send chat message
 * - typing - Typing indicator
 * - readReceipt - Mark messages as read
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
    DynamoDBDocumentClient, 
    GetCommand, 
    PutCommand, 
    QueryCommand,
    UpdateCommand,
    DeleteCommand,
    ScanCommand
} from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

// Table names
const TABLES = {
    CONNECTIONS: 'oith-ws-connections',  // WebSocket connection IDs
    MESSAGES: 'oith-messages',           // Chat messages with delivery status
    NOTIFICATIONS: 'oith-notifications', // Push notifications queue
    PROFILES: 'oith-profiles',
    MATCHES: 'oith-matches'
};

// Message statuses
const MESSAGE_STATUS = {
    SENT: 'sent',
    DELIVERED: 'delivered',
    READ: 'read'
};

// ==========================================
// WEBSOCKET CONNECTION MANAGEMENT
// ==========================================

/**
 * Handle new WebSocket connection
 */
export async function handleConnect(event) {
    const connectionId = event.requestContext.connectionId;
    const userEmail = event.queryStringParameters?.email;
    
    if (!userEmail) {
        return { statusCode: 400, body: 'Missing email parameter' };
    }
    
    try {
        // Store connection
        await docClient.send(new PutCommand({
            TableName: TABLES.CONNECTIONS,
            Item: {
                email: userEmail.toLowerCase(),
                connectionId: connectionId,
                connectedAt: new Date().toISOString(),
                lastSeen: new Date().toISOString()
            }
        }));
        
        console.log(`🔌 Connected: ${userEmail} -> ${connectionId}`);
        
        // Send any pending notifications
        await deliverPendingNotifications(userEmail, connectionId, event);
        
        return { statusCode: 200, body: 'Connected' };
    } catch (error) {
        console.error('Connection error:', error);
        return { statusCode: 500, body: error.message };
    }
}

/**
 * Handle WebSocket disconnect
 */
export async function handleDisconnect(event) {
    const connectionId = event.requestContext.connectionId;
    
    try {
        // Find and remove connection by connectionId
        const connections = await docClient.send(new ScanCommand({
            TableName: TABLES.CONNECTIONS,
            FilterExpression: 'connectionId = :cid',
            ExpressionAttributeValues: { ':cid': connectionId }
        }));
        
        if (connections.Items && connections.Items.length > 0) {
            const email = connections.Items[0].email;
            await docClient.send(new DeleteCommand({
                TableName: TABLES.CONNECTIONS,
                Key: { email }
            }));
            console.log(`🔌 Disconnected: ${email}`);
        }
        
        return { statusCode: 200, body: 'Disconnected' };
    } catch (error) {
        console.error('Disconnect error:', error);
        return { statusCode: 500, body: error.message };
    }
}

/**
 * Get connection ID for a user
 */
async function getConnectionId(email) {
    try {
        const result = await docClient.send(new GetCommand({
            TableName: TABLES.CONNECTIONS,
            Key: { email: email.toLowerCase() }
        }));
        return result.Item?.connectionId;
    } catch (error) {
        return null;
    }
}

/**
 * Send message to a connected user via WebSocket
 */
async function sendToUser(email, data, event) {
    const connectionId = await getConnectionId(email);
    if (!connectionId) {
        console.log(`User ${email} not connected, queuing notification`);
        return false;
    }
    
    try {
        const endpoint = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
        const apiClient = new ApiGatewayManagementApiClient({ endpoint });
        
        await apiClient.send(new PostToConnectionCommand({
            ConnectionId: connectionId,
            Data: JSON.stringify(data)
        }));
        
        return true;
    } catch (error) {
        if (error.statusCode === 410) {
            // Connection is stale, remove it
            await docClient.send(new DeleteCommand({
                TableName: TABLES.CONNECTIONS,
                Key: { email: email.toLowerCase() }
            }));
        }
        console.log(`Failed to send to ${email}:`, error.message);
        return false;
    }
}

// ==========================================
// REAL-TIME MESSAGING
// ==========================================

/**
 * Handle sending a chat message
 * Includes delivery confirmation and read receipts
 */
export async function handleSendMessage(event) {
    const body = JSON.parse(event.body);
    const { matchId, fromEmail, toEmail, message } = body;
    
    if (!matchId || !fromEmail || !message) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
    }
    
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    
    // Create message with tracking
    const messageData = {
        pk: `CHAT#${matchId}`,
        sk: `MSG#${timestamp}#${messageId}`,
        messageId,
        matchId,
        fromEmail: fromEmail.toLowerCase(),
        toEmail: toEmail?.toLowerCase(),
        message: message.substring(0, 2000), // Limit message length
        status: MESSAGE_STATUS.SENT,
        createdAt: timestamp,
        deliveredAt: null,
        readAt: null
    };
    
    try {
        // Save message
        await docClient.send(new PutCommand({
            TableName: TABLES.MESSAGES,
            Item: messageData
        }));
        
        // Try to deliver via WebSocket
        const delivered = await sendToUser(toEmail, {
            type: 'new_message',
            messageId,
            matchId,
            fromEmail: fromEmail.toLowerCase(),
            message,
            timestamp
        }, event);
        
        if (delivered) {
            // Update delivery status
            await docClient.send(new UpdateCommand({
                TableName: TABLES.MESSAGES,
                Key: { pk: messageData.pk, sk: messageData.sk },
                UpdateExpression: 'SET #status = :status, deliveredAt = :time',
                ExpressionAttributeNames: { '#status': 'status' },
                ExpressionAttributeValues: {
                    ':status': MESSAGE_STATUS.DELIVERED,
                    ':time': new Date().toISOString()
                }
            }));
            
            // Notify sender of delivery
            await sendToUser(fromEmail, {
                type: 'message_delivered',
                messageId,
                matchId,
                deliveredAt: new Date().toISOString()
            }, event);
        } else {
            // Queue push notification for offline user
            await queuePushNotification(toEmail, {
                type: 'new_message',
                title: 'New Message',
                body: `${fromEmail.split('@')[0]}: ${message.substring(0, 50)}...`,
                data: { matchId, messageId, fromEmail }
            });
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                messageId,
                status: delivered ? MESSAGE_STATUS.DELIVERED : MESSAGE_STATUS.SENT
            })
        };
    } catch (error) {
        console.error('Send message error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
}

/**
 * Handle typing indicator
 */
export async function handleTyping(event) {
    const body = JSON.parse(event.body);
    const { matchId, fromEmail, toEmail, isTyping } = body;
    
    // Send typing status to recipient
    await sendToUser(toEmail, {
        type: 'typing',
        matchId,
        fromEmail: fromEmail.toLowerCase(),
        isTyping: !!isTyping
    }, event);
    
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
}

/**
 * Handle read receipt
 */
export async function handleReadReceipt(event) {
    const body = JSON.parse(event.body);
    const { matchId, readerEmail, messageIds } = body;
    
    if (!matchId || !readerEmail || !messageIds?.length) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
    }
    
    const readAt = new Date().toISOString();
    
    try {
        // Update all messages as read
        for (const messageId of messageIds) {
            // Find the message
            const messages = await docClient.send(new QueryCommand({
                TableName: TABLES.MESSAGES,
                KeyConditionExpression: 'pk = :pk',
                FilterExpression: 'messageId = :msgId',
                ExpressionAttributeValues: {
                    ':pk': `CHAT#${matchId}`,
                    ':msgId': messageId
                }
            }));
            
            if (messages.Items?.[0]) {
                const msg = messages.Items[0];
                
                // Only mark as read if not already read
                if (msg.status !== MESSAGE_STATUS.READ) {
                    await docClient.send(new UpdateCommand({
                        TableName: TABLES.MESSAGES,
                        Key: { pk: msg.pk, sk: msg.sk },
                        UpdateExpression: 'SET #status = :status, readAt = :time',
                        ExpressionAttributeNames: { '#status': 'status' },
                        ExpressionAttributeValues: {
                            ':status': MESSAGE_STATUS.READ,
                            ':time': readAt
                        }
                    }));
                    
                    // Notify sender that their message was read
                    await sendToUser(msg.fromEmail, {
                        type: 'message_read',
                        messageId,
                        matchId,
                        readAt,
                        readBy: readerEmail.toLowerCase()
                    }, event);
                }
            }
        }
        
        return { statusCode: 200, body: JSON.stringify({ success: true, readAt }) };
    } catch (error) {
        console.error('Read receipt error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
}

// ==========================================
// GET MESSAGES WITH PAGINATION
// ==========================================

/**
 * Get chat messages with pagination
 * Fixes issue #16 - Message pagination for long conversations
 */
export async function getMessages(event) {
    const matchId = event.queryStringParameters?.matchId;
    const limit = parseInt(event.queryStringParameters?.limit) || 50;
    const lastKey = event.queryStringParameters?.lastKey;
    
    if (!matchId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'matchId required' }) };
    }
    
    try {
        const params = {
            TableName: TABLES.MESSAGES,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: { ':pk': `CHAT#${matchId}` },
            ScanIndexForward: false, // Most recent first
            Limit: limit
        };
        
        if (lastKey) {
            params.ExclusiveStartKey = JSON.parse(Buffer.from(lastKey, 'base64').toString());
        }
        
        const result = await docClient.send(new QueryCommand(params));
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                messages: result.Items || [],
                hasMore: !!result.LastEvaluatedKey,
                nextKey: result.LastEvaluatedKey 
                    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
                    : null
            })
        };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
}

// ==========================================
// REAL-TIME NOTIFICATIONS
// ==========================================

/**
 * Send real-time notification (unmatch, match, etc.)
 */
export async function sendRealtimeNotification(email, notification, event) {
    const sent = await sendToUser(email, notification, event);
    
    if (!sent) {
        // User offline - queue for later
        await queuePushNotification(email, notification);
    }
    
    return sent;
}

/**
 * Notify user of unmatch in real-time
 * Fixes issue #3 - Real-time unmatch notification
 */
export async function notifyUnmatch(unmatchedByEmail, unmatchedEmail, event) {
    return sendRealtimeNotification(unmatchedEmail, {
        type: 'unmatched',
        message: 'Your match has ended',
        unmatchedBy: unmatchedByEmail.toLowerCase(),
        timestamp: new Date().toISOString()
    }, event);
}

/**
 * Notify user of mutual match in real-time
 */
export async function notifyMutualMatch(userEmail, matchData, event) {
    return sendRealtimeNotification(userEmail, {
        type: 'mutual_match',
        matchEmail: matchData.email,
        matchName: matchData.name,
        matchPhoto: matchData.photo,
        message: `You matched with ${matchData.name}!`,
        timestamp: new Date().toISOString()
    }, event);
}

/**
 * Notify user of profile update from their match
 * Fixes issue #6 - Profile update sync during active match
 */
export async function notifyProfileUpdate(matchEmail, updatedProfile, event) {
    return sendRealtimeNotification(matchEmail, {
        type: 'match_profile_updated',
        updatedFields: Object.keys(updatedProfile),
        profile: updatedProfile,
        timestamp: new Date().toISOString()
    }, event);
}

// ==========================================
// PUSH NOTIFICATION QUEUE
// ==========================================

/**
 * Queue push notification for offline user
 * Fixes issue #1 - Push notifications for offline users
 */
async function queuePushNotification(email, notification) {
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
        await docClient.send(new PutCommand({
            TableName: TABLES.NOTIFICATIONS,
            Item: {
                pk: `USER#${email.toLowerCase()}`,
                sk: `NOTIF#${notificationId}`,
                notificationId,
                email: email.toLowerCase(),
                type: notification.type,
                title: notification.title || 'OITH',
                body: notification.body || notification.message || '',
                data: notification.data || {},
                status: 'pending',
                priority: getPriority(notification.type),
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
            }
        }));
        
        console.log(`📬 Notification queued for ${email}: ${notification.type}`);
        return true;
    } catch (error) {
        console.error('Queue notification error:', error);
        return false;
    }
}

/**
 * Get notification priority
 * Fixes issue #9 - Notification priority system
 */
function getPriority(type) {
    const priorities = {
        'mutual_match': 1,      // Highest
        'new_message': 2,
        'unmatched': 3,
        'timer_warning': 3,
        'timer_expired': 2,
        'payment_failed': 1,
        'profile_updated': 5    // Lowest
    };
    return priorities[type] || 4;
}

/**
 * Deliver pending notifications when user connects
 */
async function deliverPendingNotifications(email, connectionId, event) {
    try {
        const result = await docClient.send(new QueryCommand({
            TableName: TABLES.NOTIFICATIONS,
            KeyConditionExpression: 'pk = :pk',
            FilterExpression: '#status = :pending',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
                ':pk': `USER#${email.toLowerCase()}`,
                ':pending': 'pending'
            },
            Limit: 50
        }));
        
        const notifications = result.Items || [];
        
        // Group notifications by type (fixes issue #9)
        const grouped = groupNotifications(notifications);
        
        // Deliver grouped notifications
        for (const notification of grouped) {
            await sendToUser(email, notification, event);
            
            // Mark as delivered
            if (notification.notificationIds) {
                for (const notifId of notification.notificationIds) {
                    await docClient.send(new UpdateCommand({
                        TableName: TABLES.NOTIFICATIONS,
                        Key: { 
                            pk: `USER#${email.toLowerCase()}`, 
                            sk: `NOTIF#${notifId}` 
                        },
                        UpdateExpression: 'SET #status = :delivered, deliveredAt = :time',
                        ExpressionAttributeNames: { '#status': 'status' },
                        ExpressionAttributeValues: {
                            ':delivered': 'delivered',
                            ':time': new Date().toISOString()
                        }
                    }));
                }
            }
        }
        
        console.log(`📬 Delivered ${grouped.length} grouped notifications to ${email}`);
    } catch (error) {
        console.error('Deliver pending notifications error:', error);
    }
}

/**
 * Group notifications by type
 * Fixes issue #9 - Notification grouping
 */
function groupNotifications(notifications) {
    const groups = {};
    
    for (const notif of notifications) {
        const type = notif.type;
        if (!groups[type]) {
            groups[type] = [];
        }
        groups[type].push(notif);
    }
    
    const result = [];
    
    for (const [type, items] of Object.entries(groups)) {
        if (items.length === 1) {
            result.push({
                ...items[0],
                notificationIds: [items[0].notificationId]
            });
        } else {
            // Group multiple notifications of same type
            result.push({
                type: type,
                title: getGroupedTitle(type, items.length),
                body: getGroupedBody(type, items),
                count: items.length,
                items: items.slice(0, 5), // Include first 5 for preview
                notificationIds: items.map(i => i.notificationId),
                priority: Math.min(...items.map(i => i.priority || 5)),
                createdAt: items[0].createdAt
            });
        }
    }
    
    // Sort by priority
    return result.sort((a, b) => (a.priority || 5) - (b.priority || 5));
}

function getGroupedTitle(type, count) {
    const titles = {
        'new_message': `${count} New Messages`,
        'mutual_match': `${count} New Matches!`,
        'unmatched': `${count} Match Updates`
    };
    return titles[type] || `${count} Notifications`;
}

function getGroupedBody(type, items) {
    if (type === 'new_message') {
        const senders = [...new Set(items.map(i => i.data?.fromEmail?.split('@')[0]))];
        return `Messages from ${senders.slice(0, 3).join(', ')}${senders.length > 3 ? ` and ${senders.length - 3} more` : ''}`;
    }
    return `You have ${items.length} new notifications`;
}

// ==========================================
// CONVERSATION ARCHIVE
// ==========================================

/**
 * Archive conversation before expiration
 * Fixes issue #13 - Conversation archive for expired matches
 */
export async function archiveConversation(matchId, user1Email, user2Email) {
    try {
        // Get all messages for this match
        const messages = await docClient.send(new QueryCommand({
            TableName: TABLES.MESSAGES,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: { ':pk': `CHAT#${matchId}` }
        }));
        
        if (!messages.Items?.length) return;
        
        const archiveData = {
            matchId,
            participants: [user1Email.toLowerCase(), user2Email.toLowerCase()],
            messageCount: messages.Items.length,
            archivedAt: new Date().toISOString(),
            messages: messages.Items.map(m => ({
                fromEmail: m.fromEmail,
                message: m.message,
                createdAt: m.createdAt
            }))
        };
        
        // Save archive for both users
        for (const email of [user1Email, user2Email]) {
            await docClient.send(new PutCommand({
                TableName: TABLES.MESSAGES,
                Item: {
                    pk: `ARCHIVE#${email.toLowerCase()}`,
                    sk: `MATCH#${matchId}`,
                    ...archiveData
                }
            }));
        }
        
        console.log(`📦 Archived ${messages.Items.length} messages for match ${matchId}`);
    } catch (error) {
        console.error('Archive conversation error:', error);
    }
}

/**
 * Get archived conversations for a user
 */
export async function getArchivedConversations(event) {
    const email = event.queryStringParameters?.email;
    
    if (!email) {
        return { statusCode: 400, body: JSON.stringify({ error: 'email required' }) };
    }
    
    try {
        const result = await docClient.send(new QueryCommand({
            TableName: TABLES.MESSAGES,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: { ':pk': `ARCHIVE#${email.toLowerCase()}` },
            ScanIndexForward: false,
            Limit: 20
        }));
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                archives: (result.Items || []).map(a => ({
                    matchId: a.matchId,
                    participants: a.participants,
                    messageCount: a.messageCount,
                    archivedAt: a.archivedAt,
                    preview: a.messages?.slice(-3) // Last 3 messages as preview
                }))
            })
        };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
}

// ==========================================
// DELETE CHAT ON BLOCK
// ==========================================

/**
 * Delete chat history when user blocks
 * Fixes issue #7 - Blocked user can still see old messages
 */
export async function deleteChatOnBlock(blockerEmail, blockedEmail, matchId) {
    try {
        // Get all messages
        const messages = await docClient.send(new QueryCommand({
            TableName: TABLES.MESSAGES,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: { ':pk': `CHAT#${matchId}` }
        }));
        
        // Delete all messages
        for (const msg of messages.Items || []) {
            await docClient.send(new DeleteCommand({
                TableName: TABLES.MESSAGES,
                Key: { pk: msg.pk, sk: msg.sk }
            }));
        }
        
        console.log(`🗑️ Deleted ${messages.Items?.length || 0} messages for blocked match ${matchId}`);
    } catch (error) {
        console.error('Delete chat on block error:', error);
    }
}

// ==========================================
// MAIN HANDLER
// ==========================================

export const handler = async (event) => {
    const routeKey = event.requestContext?.routeKey;
    
    switch (routeKey) {
        case '$connect':
            return handleConnect(event);
        case '$disconnect':
            return handleDisconnect(event);
        case 'sendMessage':
            return handleSendMessage(event);
        case 'typing':
            return handleTyping(event);
        case 'readReceipt':
            return handleReadReceipt(event);
        default:
            // HTTP API fallback
            const path = event.path || event.rawPath || '';
            const method = event.httpMethod || event.requestContext?.http?.method;
            
            if (method === 'GET' && path.includes('/messages')) {
                return getMessages(event);
            }
            if (method === 'GET' && path.includes('/archives')) {
                return getArchivedConversations(event);
            }
            
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Route not found' })
            };
    }
};

