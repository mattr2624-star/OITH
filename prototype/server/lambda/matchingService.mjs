/**
 * OITH Matching Service - Server-Side Matching Algorithm
 * 
 * This Lambda handles all matching logic server-side for scalability:
 * - Geohash-based location filtering
 * - Mutual preference matching
 * - Compatibility scoring
 * - Returns best match sorted by compatibility
 * 
 * Endpoints:
 * - POST /api/match/next - Get next match for user
 * - POST /api/match/accept - Accept a match
 * - POST /api/match/pass - Pass on a match
 * - GET /api/match/status - Get current match status
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
    DynamoDBDocumentClient, 
    GetCommand, 
    PutCommand, 
    QueryCommand,
    UpdateCommand,
    ScanCommand,
    DeleteCommand
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

// Table names - split by domain for clarity and scalability
const TABLES = {
    PROFILES: 'oith-profiles',           // Dating user profiles (email as key)
    MATCHES: 'oith-matches',             // Active match pairings
    MATCH_HISTORY: 'oith-match-history', // Pass/accept history
    CONVERSATIONS: 'oith-conversations', // Chat messages
    NOTIFICATIONS: 'oith-notifications', // Push/in-app notifications
    REPORTS: 'oith-reports',             // User reports (harassment, fake, etc.)
    BLOCKS: 'oith-blocks',               // Blocked users
    COMPANY: 'oith-users'                // Company/admin data (legacy name)
};

// ==========================================
// MATCHING CONFIGURATION
// ==========================================
const CONFIG = {
    // Match expiration - auto-pass if no response in 24 hours
    MATCH_EXPIRATION_HOURS: 24,
    
    // Connection timer - how long users have to chat and plan a date
    CONNECTION_TIMER_HOURS: 24,
    
    // Decision timer - how long users have to accept/pass on a match
    DECISION_TIMER_HOURS: 24,
    
    // Only show users active within this many days
    ACTIVE_USER_DAYS: 14,
    
    // Maximum profiles to scan per request (pagination for scale)
    MAX_SCAN_LIMIT: 500,
    
    // Geohash precision for location queries (4 = ~40km, 5 = ~5km)
    GEOHASH_PRECISION: 4,
    
    // Rate limiting: max requests per minute per user
    RATE_LIMIT_REQUESTS: 20,
    RATE_LIMIT_WINDOW_SECONDS: 60,
    
    // Location refresh - prompt users to update location every N days
    LOCATION_REFRESH_DAYS: 7
};

// GSI name for geohash-based queries (create this GSI on oith-profiles)
const GEOHASH_GSI_NAME = 'geohash-lastSeen-index';

// In-memory rate limit cache (resets on Lambda cold start, but still helps)
const rateLimitCache = new Map();

// ==========================================
// SERVER-SIDE TIMER ENFORCEMENT
// Fixes issues #2, #10, #11 - Timers enforced server-side
// ==========================================

/**
 * Set server-side connection timer when match is created
 */
async function setConnectionTimer(userEmail, matchEmail, matchId) {
    const expiresAt = new Date(Date.now() + CONFIG.CONNECTION_TIMER_HOURS * 60 * 60 * 1000).toISOString();
    
    // Store timer for both users
    await Promise.all([
        docClient.send(new PutCommand({
            TableName: TABLES.MATCHES,
            Item: {
                pk: `TIMER#${userEmail.toLowerCase()}`,
                sk: `CONNECTION#${matchId}`,
                matchId,
                matchEmail: matchEmail.toLowerCase(),
                type: 'connection',
                expiresAt,
                createdAt: new Date().toISOString(),
                warningsSent: []
            }
        })),
        docClient.send(new PutCommand({
            TableName: TABLES.MATCHES,
            Item: {
                pk: `TIMER#${matchEmail.toLowerCase()}`,
                sk: `CONNECTION#${matchId}`,
                matchId,
                matchEmail: userEmail.toLowerCase(),
                type: 'connection',
                expiresAt,
                createdAt: new Date().toISOString(),
                warningsSent: []
            }
        }))
    ]);
    
    console.log(`⏰ Connection timer set for ${matchId}, expires at ${expiresAt}`);
    return expiresAt;
}

/**
 * Set server-side decision timer when match is presented
 */
async function setDecisionTimer(userEmail, matchEmail) {
    const expiresAt = new Date(Date.now() + CONFIG.DECISION_TIMER_HOURS * 60 * 60 * 1000).toISOString();
    
    await docClient.send(new PutCommand({
        TableName: TABLES.MATCHES,
        Item: {
            pk: `TIMER#${userEmail.toLowerCase()}`,
            sk: `DECISION#${matchEmail.toLowerCase()}`,
            matchEmail: matchEmail.toLowerCase(),
            type: 'decision',
            expiresAt,
            createdAt: new Date().toISOString()
        }
    }));
    
    console.log(`⏰ Decision timer set for ${userEmail} -> ${matchEmail}, expires at ${expiresAt}`);
    return expiresAt;
}

/**
 * Get remaining time on a timer
 */
async function getTimerStatus(userEmail, type, matchId) {
    const sk = type === 'connection' ? `CONNECTION#${matchId}` : `DECISION#${matchId}`;
    
    try {
        const result = await docClient.send(new GetCommand({
            TableName: TABLES.MATCHES,
            Key: { pk: `TIMER#${userEmail.toLowerCase()}`, sk }
        }));
        
        if (!result.Item) return null;
        
        const expiresAt = new Date(result.Item.expiresAt);
        const now = new Date();
        const remainingMs = expiresAt - now;
        
        return {
            expiresAt: result.Item.expiresAt,
            remainingMs: Math.max(0, remainingMs),
            remainingHours: Math.max(0, remainingMs / (1000 * 60 * 60)),
            isExpired: remainingMs <= 0,
            warningsSent: result.Item.warningsSent || []
        };
    } catch (error) {
        console.error('Get timer status error:', error);
        return null;
    }
}

/**
 * Check and enforce timer expiration
 * Called periodically and on user actions
 */
async function enforceTimerExpiration(userEmail) {
    const now = new Date().toISOString();
    
    try {
        // Get all timers for this user
        const timers = await docClient.send(new QueryCommand({
            TableName: TABLES.MATCHES,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: { ':pk': `TIMER#${userEmail.toLowerCase()}` }
        }));
        
        const expiredTimers = [];
        
        for (const timer of timers.Items || []) {
            if (timer.expiresAt < now) {
                expiredTimers.push(timer);
            }
        }
        
        // Handle expired timers
        for (const timer of expiredTimers) {
            if (timer.type === 'decision') {
                await handleExpiredDecisionTimer(userEmail, timer);
            } else if (timer.type === 'connection') {
                await handleExpiredConnectionTimer(userEmail, timer);
            }
        }
        
        return expiredTimers;
    } catch (error) {
        console.error('Enforce timer error:', error);
        return [];
    }
}

/**
 * Handle expired decision timer - auto-pass the match
 * Fixes issue #10 - Decision timer race condition
 */
async function handleExpiredDecisionTimer(userEmail, timer) {
    console.log(`⏰ Decision timer expired: ${userEmail} -> ${timer.matchEmail}`);
    
    // Use conditional update to prevent race condition
    try {
        await docClient.send(new UpdateCommand({
            TableName: TABLES.MATCHES,
            Key: { pk: timer.pk, sk: timer.sk },
            UpdateExpression: 'SET #status = :expired, processedAt = :time',
            ConditionExpression: 'attribute_not_exists(#status)',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
                ':expired': 'expired',
                ':time': new Date().toISOString()
            }
        }));
        
        // We won the race - process the expiration
        // Record as auto-pass
        await docClient.send(new PutCommand({
            TableName: TABLES.MATCH_HISTORY,
            Item: {
                userEmail: userEmail.toLowerCase(),
                matchEmail: timer.matchEmail,
                action: 'auto_pass',
                reason: 'decision_timer_expired',
                timestamp: new Date().toISOString()
            }
        }));
        
        // Make user visible again
        await docClient.send(new UpdateCommand({
            TableName: TABLES.PROFILES,
            Key: { email: userEmail.toLowerCase() },
            UpdateExpression: 'SET isVisible = :true REMOVE presentedMatchEmail, presentedAt',
            ExpressionAttributeValues: { ':true': true }
        }));
        
        // Create notification
        await createNotification(userEmail, 'decision_expired', {
            matchEmail: timer.matchEmail,
            message: 'Time expired on your match. Finding someone new!'
        });
        
        console.log(`✅ Auto-passed ${timer.matchEmail} for ${userEmail} due to timer expiry`);
    } catch (error) {
        if (error.name === 'ConditionalCheckFailedException') {
            console.log(`⏭️ Timer already processed for ${userEmail} -> ${timer.matchEmail}`);
        } else {
            console.error('Handle expired decision timer error:', error);
        }
    }
}

/**
 * Handle expired connection timer - end the match
 * Fixes issue #2 - Server-side timer enforcement
 */
async function handleExpiredConnectionTimer(userEmail, timer) {
    console.log(`⏰ Connection timer expired: ${userEmail} <-> ${timer.matchEmail}`);
    
    // Use conditional update to prevent race condition
    try {
        await docClient.send(new UpdateCommand({
            TableName: TABLES.MATCHES,
            Key: { pk: timer.pk, sk: timer.sk },
            UpdateExpression: 'SET #status = :expired, processedAt = :time',
            ConditionExpression: 'attribute_not_exists(#status)',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
                ':expired': 'expired',
                ':time': new Date().toISOString()
            }
        }));
        
        // We won the race - archive conversation before ending
        const { archiveConversation } = await import('./realtimeService.mjs');
        await archiveConversation(timer.matchId, userEmail, timer.matchEmail);
        
        // Record in history
        await Promise.all([
            docClient.send(new PutCommand({
                TableName: TABLES.MATCH_HISTORY,
                Item: {
                    userEmail: userEmail.toLowerCase(),
                    matchEmail: timer.matchEmail,
                    action: 'connection_expired',
                    reason: 'timer_expired',
                    timestamp: new Date().toISOString()
                }
            })),
            docClient.send(new PutCommand({
                TableName: TABLES.MATCH_HISTORY,
                Item: {
                    userEmail: timer.matchEmail,
                    matchEmail: userEmail.toLowerCase(),
                    action: 'connection_expired',
                    reason: 'timer_expired',
                    timestamp: new Date().toISOString()
                }
            }))
        ]);
        
        // Make BOTH users visible again
        await Promise.all([
            docClient.send(new UpdateCommand({
                TableName: TABLES.PROFILES,
                Key: { email: userEmail.toLowerCase() },
                UpdateExpression: 'SET isVisible = :true REMOVE activeMatchEmail, matchedAt',
                ExpressionAttributeValues: { ':true': true }
            })),
            docClient.send(new UpdateCommand({
                TableName: TABLES.PROFILES,
                Key: { email: timer.matchEmail },
                UpdateExpression: 'SET isVisible = :true REMOVE activeMatchEmail, matchedAt',
                ExpressionAttributeValues: { ':true': true }
            }))
        ]);
        
        // Notify BOTH users
        await Promise.all([
            createNotification(userEmail, 'connection_expired', {
                matchEmail: timer.matchEmail,
                message: 'Your 24-hour connection has ended. Time to find someone new!'
            }),
            createNotification(timer.matchEmail, 'connection_expired', {
                matchEmail: userEmail,
                message: 'Your 24-hour connection has ended. Time to find someone new!'
            })
        ]);
        
        console.log(`✅ Connection ended between ${userEmail} and ${timer.matchEmail}`);
    } catch (error) {
        if (error.name === 'ConditionalCheckFailedException') {
            console.log(`⏭️ Connection timer already processed`);
        } else {
            console.error('Handle expired connection timer error:', error);
        }
    }
}

/**
 * Send timer warning notifications (1 hour remaining)
 */
async function sendTimerWarning(userEmail, timer, hoursRemaining) {
    const warningKey = `${hoursRemaining}h`;
    
    if (timer.warningsSent?.includes(warningKey)) {
        return; // Already sent this warning
    }
    
    const messageType = timer.type === 'connection' ? 'connection_warning' : 'decision_warning';
    
    await createNotification(userEmail, messageType, {
        matchEmail: timer.matchEmail,
        hoursRemaining,
        message: `Only ${hoursRemaining} hour${hoursRemaining > 1 ? 's' : ''} left with your match!`
    });
    
    // Mark warning as sent
    await docClient.send(new UpdateCommand({
        TableName: TABLES.MATCHES,
        Key: { pk: timer.pk, sk: timer.sk },
        UpdateExpression: 'SET warningsSent = list_append(if_not_exists(warningsSent, :empty), :warning)',
        ExpressionAttributeValues: {
            ':empty': [],
            ':warning': [warningKey]
        }
    }));
    
    console.log(`⚠️ Timer warning sent to ${userEmail}: ${hoursRemaining}h remaining`);
}

// CORS headers
const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

// ==========================================
// NOTIFICATION UTILITIES
// ==========================================

/**
 * Create a notification for a user
 * Notifications are stored and retrieved when user comes online
 */
async function createNotification(userEmail, type, data) {
    const notificationId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const notification = {
        notificationId,
        userEmail: userEmail.toLowerCase(),
        type,  // 'mutual_match', 'new_message', 'like_received', etc.
        data,  // Additional context (matchEmail, matchName, etc.)
        read: false,
        createdAt: new Date().toISOString()
    };
    
    try {
        await docClient.send(new PutCommand({
            TableName: TABLES.NOTIFICATIONS,
            Item: notification
        }));
        console.log(`📬 Notification created for ${userEmail}: ${type}`);
        return notification;
    } catch (error) {
        console.log(`⚠️ Could not create notification (table may not exist): ${error.message}`);
        return null;
    }
}

/**
 * Get all unread notifications for a user
 */
async function getUnreadNotifications(userEmail) {
    try {
        const result = await docClient.send(new QueryCommand({
            TableName: TABLES.NOTIFICATIONS,
            KeyConditionExpression: 'userEmail = :email',
            FilterExpression: '#read = :unread',
            ExpressionAttributeNames: { '#read': 'read' },
            ExpressionAttributeValues: {
                ':email': userEmail.toLowerCase(),
                ':unread': false
            }
        }));
        return result.Items || [];
    } catch (error) {
        console.log(`Could not fetch notifications: ${error.message}`);
        return [];
    }
}

// ==========================================
// MATCH EXPIRATION UTILITIES
// ==========================================

// ==========================================
// MATCH POOL EXHAUSTION HANDLING
// Fixes issue #8 - Match pool exhaustion
// ==========================================

/**
 * Analyze why no matches were found and provide helpful suggestions
 */
async function getMatchPoolExhaustionInfo(userEmail, poolSize, excludedCount) {
    const suggestions = [];
    let status = 'no_matches';
    let message = 'No matches found at the moment.';
    
    // Get user's preferences to analyze
    const userResult = await docClient.send(new GetCommand({
        TableName: TABLES.PROFILES,
        Key: { email: userEmail.toLowerCase() }
    }));
    const user = userResult.Item || {};
    const prefs = user.matchPreferences || user.preferences || {};
    
    // Check various reasons for no matches
    
    // 1. Too restrictive preferences
    if (poolSize > 0 && excludedCount > poolSize * 0.8) {
        status = 'too_restrictive';
        message = 'You\'ve seen most available matches in your area.';
        suggestions.push({
            type: 'expand_preferences',
            title: 'Expand Your Preferences',
            description: 'Try widening your age range or distance to see more people.',
            action: 'open_preferences'
        });
    }
    
    // 2. Very small pool overall
    if (poolSize < 10) {
        status = 'small_pool';
        message = 'Not many users in your area yet.';
        suggestions.push({
            type: 'increase_distance',
            title: 'Increase Search Distance',
            description: `Try increasing from ${prefs.maxDistance || 25} miles to see more matches.`,
            action: 'open_preferences'
        });
        suggestions.push({
            type: 'check_back',
            title: 'Check Back Later',
            description: 'New users join every day! Check back soon.',
            action: 'set_reminder'
        });
    }
    
    // 3. Exhausted all matches
    if (excludedCount > 50) {
        status = 'exhausted';
        message = 'You\'ve been through everyone! New matches will appear as users join.';
        suggestions.push({
            type: 'new_users_notification',
            title: 'Get Notified',
            description: 'We\'ll notify you when new compatible users join in your area.',
            action: 'enable_new_user_alerts'
        });
    }
    
    // 4. Location might be stale
    const lastLocationUpdate = user.locationUpdatedAt ? new Date(user.locationUpdatedAt) : null;
    const daysSinceUpdate = lastLocationUpdate 
        ? (Date.now() - lastLocationUpdate) / (1000 * 60 * 60 * 24)
        : 999;
    
    if (daysSinceUpdate > CONFIG.LOCATION_REFRESH_DAYS) {
        suggestions.push({
            type: 'update_location',
            title: 'Update Your Location',
            description: 'Your location may be outdated. Update it to find nearby matches.',
            action: 'update_location'
        });
    }
    
    // Register for new user notifications if pool is exhausted
    if (status === 'exhausted' || status === 'small_pool') {
        await registerForNewUserAlert(userEmail, user.coordinates, prefs);
    }
    
    return {
        status,
        message,
        suggestions,
        stats: {
            poolSize,
            excludedCount,
            daysSinceLocationUpdate: Math.floor(daysSinceUpdate)
        }
    };
}

/**
 * Register user to be notified when new compatible users join
 */
async function registerForNewUserAlert(userEmail, coordinates, preferences) {
    try {
        await docClient.send(new PutCommand({
            TableName: TABLES.COMPANY,
            Item: {
                pk: 'ALERT#NEW_USERS',
                sk: userEmail.toLowerCase(),
                email: userEmail.toLowerCase(),
                coordinates,
                preferences,
                registeredAt: new Date().toISOString()
            }
        }));
        console.log(`📬 Registered ${userEmail} for new user alerts`);
    } catch (error) {
        console.log('Could not register for new user alert:', error.message);
    }
}

/**
 * Notify users who were waiting for new matches in an area
 * Called when a new user signs up
 */
async function notifyWaitingUsersOfNewMatch(newUserEmail, newUserCoords, newUserProfile) {
    try {
        const waitingUsers = await docClient.send(new QueryCommand({
            TableName: TABLES.COMPANY,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: { ':pk': 'ALERT#NEW_USERS' }
        }));
        
        for (const waitingUser of waitingUsers.Items || []) {
            // Check if new user is within their distance preference
            const distance = calculateDistance(
                waitingUser.coordinates?.lat, waitingUser.coordinates?.lng,
                newUserCoords?.lat, newUserCoords?.lng
            );
            
            const maxDistance = waitingUser.preferences?.maxDistance || 50;
            
            if (distance <= maxDistance) {
                await createNotification(waitingUser.email, 'new_user_nearby', {
                    message: 'A new user just joined near you! Check your matches.',
                    distance: Math.round(distance)
                });
                
                console.log(`📬 Notified ${waitingUser.email} of new user ${newUserEmail}`);
            }
        }
    } catch (error) {
        console.log('Error notifying waiting users:', error.message);
    }
}

// ==========================================
// LOCATION REFRESH
// Fixes issue #12 - Location accuracy
// ==========================================

/**
 * Check if user should update their location
 */
function shouldPromptLocationUpdate(user) {
    if (!user.locationUpdatedAt) return true;
    
    const daysSinceUpdate = (Date.now() - new Date(user.locationUpdatedAt)) / (1000 * 60 * 60 * 24);
    return daysSinceUpdate > CONFIG.LOCATION_REFRESH_DAYS;
}

/**
 * Update user location
 */
async function updateUserLocation(userEmail, coordinates) {
    const geohash = encodeGeohash(coordinates.lat, coordinates.lng, CONFIG.GEOHASH_PRECISION);
    
    await docClient.send(new UpdateCommand({
        TableName: TABLES.PROFILES,
        Key: { email: userEmail.toLowerCase() },
        UpdateExpression: 'SET coordinates = :coords, geohash = :geohash, locationUpdatedAt = :time',
        ExpressionAttributeValues: {
            ':coords': coordinates,
            ':geohash': geohash,
            ':time': new Date().toISOString()
        }
    }));
    
    console.log(`📍 Location updated for ${userEmail}: ${coordinates.lat}, ${coordinates.lng}`);
}

// ==========================================
// RATE LIMITING
// ==========================================

/**
 * Check if user is rate limited
 * Returns { limited: boolean, remaining: number, resetIn: number }
 */
function checkRateLimit(userEmail) {
    const now = Date.now();
    const key = userEmail.toLowerCase();
    const windowMs = CONFIG.RATE_LIMIT_WINDOW_SECONDS * 1000;
    
    // Get or create rate limit entry
    let entry = rateLimitCache.get(key);
    
    if (!entry || (now - entry.windowStart) > windowMs) {
        // New window
        entry = { windowStart: now, count: 0 };
    }
    
    entry.count++;
    rateLimitCache.set(key, entry);
    
    const remaining = Math.max(0, CONFIG.RATE_LIMIT_REQUESTS - entry.count);
    const resetIn = Math.ceil((entry.windowStart + windowMs - now) / 1000);
    
    if (entry.count > CONFIG.RATE_LIMIT_REQUESTS) {
        console.log(`🚫 Rate limited: ${userEmail} (${entry.count} requests in window)`);
        return { limited: true, remaining: 0, resetIn };
    }
    
    return { limited: false, remaining, resetIn };
}

/**
 * Clean up old rate limit entries (call periodically)
 */
function cleanupRateLimitCache() {
    const now = Date.now();
    const windowMs = CONFIG.RATE_LIMIT_WINDOW_SECONDS * 1000;
    
    for (const [key, entry] of rateLimitCache.entries()) {
        if ((now - entry.windowStart) > windowMs * 2) {
            rateLimitCache.delete(key);
        }
    }
}

// ==========================================
// MATCH EXPIRATION
// ==========================================

/**
 * Auto-pass matches that were presented but not acted on within 24 hours
 * This prevents users from seeing the same match forever
 */
async function autoPassExpiredMatches(userEmail) {
    const expirationTime = new Date(Date.now() - CONFIG.MATCH_EXPIRATION_HOURS * 60 * 60 * 1000).toISOString();
    
    try {
        // Find matches that are still "presented" and older than expiration time
        const matchesResult = await docClient.send(new ScanCommand({
            TableName: TABLES.MATCHES,
            FilterExpression: 'userEmail = :email AND #status = :presented AND presentedAt < :expiry',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
                ':email': userEmail,
                ':presented': 'presented',
                ':expiry': expirationTime
            }
        }));
        
        const expiredMatches = matchesResult.Items || [];
        
        if (expiredMatches.length > 0) {
            console.log(`⏰ Auto-passing ${expiredMatches.length} expired matches for ${userEmail}`);
            
            // Auto-pass each expired match
            for (const match of expiredMatches) {
                await docClient.send(new PutCommand({
                    TableName: TABLES.MATCH_HISTORY,
                    Item: {
                        userEmail: userEmail,
                        matchEmail: match.matchEmail,
                        action: 'auto_pass',
                        reason: 'expired',
                        timestamp: new Date().toISOString()
                    }
                }));
                
                // Update match status to expired
                await docClient.send(new UpdateCommand({
                    TableName: TABLES.MATCHES,
                    Key: { matchId: match.matchId },
                    UpdateExpression: 'SET #status = :status, expiredAt = :time',
                    ExpressionAttributeNames: { '#status': 'status' },
                    ExpressionAttributeValues: {
                        ':status': 'expired',
                        ':time': new Date().toISOString()
                    }
                }));
            }
        }
        
        return expiredMatches.length;
    } catch (error) {
        console.log(`Could not check expired matches: ${error.message}`);
        return 0;
    }
}

// ==========================================
// GEOHASH UTILITIES
// ==========================================

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encode lat/lng to geohash
 * Precision 4 = ~20km radius, 5 = ~5km radius, 6 = ~1km radius
 */
function encodeGeohash(lat, lng, precision = 5) {
    let idx = 0;
    let bit = 0;
    let evenBit = true;
    let geohash = '';
    
    let latMin = -90, latMax = 90;
    let lngMin = -180, lngMax = 180;
    
    while (geohash.length < precision) {
        if (evenBit) {
            const lngMid = (lngMin + lngMax) / 2;
            if (lng >= lngMid) {
                idx = idx * 2 + 1;
                lngMin = lngMid;
            } else {
                idx = idx * 2;
                lngMax = lngMid;
            }
        } else {
            const latMid = (latMin + latMax) / 2;
            if (lat >= latMid) {
                idx = idx * 2 + 1;
                latMin = latMid;
            } else {
                idx = idx * 2;
                latMax = latMid;
            }
        }
        evenBit = !evenBit;
        
        if (++bit === 5) {
            geohash += BASE32[idx];
            bit = 0;
            idx = 0;
        }
    }
    
    return geohash;
}

/**
 * Get neighboring geohashes for a given geohash
 * Used to find matches in adjacent areas
 */
function getNeighboringGeohashes(geohash) {
    const neighbors = [];
    const precision = geohash.length;
    
    // For simplicity, we'll use prefix matching
    // In production, use proper neighbor calculation
    const prefix = geohash.substring(0, precision - 1);
    
    BASE32.split('').forEach(char => {
        neighbors.push(prefix + char);
    });
    
    return neighbors;
}

// ==========================================
// DISTANCE CALCULATION
// ==========================================

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in miles
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    if (!lat1 || !lng1 || !lat2 || !lng2) return 9999;
    
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return Math.round(R * c);
}

// ==========================================
// PREFERENCE MATCHING
// ==========================================

/**
 * Check if a profile fits a set of preferences
 */
function checkPreferenceMatch(profile, prefs, viewerProfile) {
    // Gender preference
    const interestedIn = prefs.interestedIn || 'everyone';
    if (interestedIn !== 'everyone') {
        const profileGender = profile.gender?.toLowerCase();
        const wantsGender = interestedIn.toLowerCase();
        const genderMap = { 'men': 'male', 'women': 'female', 'male': 'male', 'female': 'female' };
        const targetGender = genderMap[wantsGender] || wantsGender;
        if (profileGender !== targetGender) {
            return { matches: false, reason: 'gender_mismatch' };
        }
    }
    
    // Age range
    const ageMin = prefs.ageMin || 18;
    const ageMax = prefs.ageMax || 99;
    const profileAge = profile.age || 25;
    if (profileAge < ageMin || profileAge > ageMax) {
        return { matches: false, reason: 'age_out_of_range' };
    }
    
    // Distance (calculated from coordinates)
    const maxDistance = prefs.maxDistance || 100;
    const viewerCoords = viewerProfile.coordinates || {};
    const profileCoords = profile.coordinates || {};
    const distance = calculateDistance(
        viewerCoords.lat, viewerCoords.lng,
        profileCoords.lat, profileCoords.lng
    );
    if (distance > maxDistance) {
        return { matches: false, reason: 'too_far', distance };
    }
    
    // Smoking preference
    if (prefs.smoking && prefs.smoking.length > 0) {
        const profileSmoking = profile.smoking?.toLowerCase();
        if (profileSmoking && !prefs.smoking.map(s => s.toLowerCase()).includes(profileSmoking)) {
            return { matches: false, reason: 'smoking_mismatch' };
        }
    }
    
    // Drinking preference
    if (prefs.drinking && prefs.drinking.length > 0) {
        const profileDrinking = profile.drinking?.toLowerCase();
        if (profileDrinking && !prefs.drinking.map(d => d.toLowerCase()).includes(profileDrinking)) {
            return { matches: false, reason: 'drinking_mismatch' };
        }
    }
    
    // Religion preference
    if (prefs.religion && prefs.religion !== '' && prefs.religion !== 'any') {
        if (profile.religion?.toLowerCase() !== prefs.religion.toLowerCase()) {
            return { matches: false, reason: 'religion_mismatch' };
        }
    }
    
    // Children preference
    if (prefs.children && prefs.children !== '' && prefs.children !== 'any') {
        if (profile.children !== prefs.children) {
            return { matches: false, reason: 'children_mismatch' };
        }
    }
    
    return { matches: true, distance };
}

/**
 * Calculate compatibility score between two profiles
 */
function calculateCompatibility(profile1, profile2) {
    let score = 50; // Base score
    
    // Interest overlap (up to +25)
    const interests1 = profile1.interests || [];
    const interests2 = profile2.interests || [];
    if (interests1.length > 0 && interests2.length > 0) {
        const overlap = interests1.filter(i => 
            interests2.some(i2 => i2.toLowerCase() === i.toLowerCase())
        ).length;
        const maxPossible = Math.min(interests1.length, interests2.length);
        score += maxPossible > 0 ? (overlap / maxPossible) * 25 : 0;
    }
    
    // Lifestyle alignment (up to +15)
    if (profile1.drinking?.toLowerCase() === profile2.drinking?.toLowerCase()) score += 3;
    if (profile1.smoking?.toLowerCase() === profile2.smoking?.toLowerCase()) score += 3;
    if (profile1.exercise?.toLowerCase() === profile2.exercise?.toLowerCase()) score += 3;
    if (profile1.children === profile2.children) score += 3;
    if (profile1.religion?.toLowerCase() === profile2.religion?.toLowerCase()) score += 3;
    
    // Looking for alignment (+10)
    if (profile1.lookingFor?.toLowerCase() === profile2.lookingFor?.toLowerCase()) {
        score += 10;
    }
    
    return Math.min(100, Math.max(0, Math.round(score)));
}

// ==========================================
// MAIN HANDLER
// ==========================================

export const handler = async (event) => {
    console.log('📥 Matching Service Request:', JSON.stringify(event, null, 2));
    
    // Handle OPTIONS (CORS preflight)
    if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    const path = event.path || event.rawPath || '';
    const method = event.httpMethod || event.requestContext?.http?.method;
    
    // Health check endpoint (works for any method)
    if (path.includes('/health') || path.includes('/ping')) {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                status: 'ok', 
                timestamp: new Date().toISOString(),
                path,
                method,
                version: '2.0.0'
            })
        };
    }
    
    try {
        // POST /api/match/next - Get next match
        if (path.includes('/match/next') && method === 'POST') {
            return await getNextMatch(event);
        }
        
        // POST /api/match/accept - Accept a match
        if (path.includes('/match/accept') && method === 'POST') {
            return await acceptMatch(event);
        }
        
        // POST /api/match/pass - Pass on a match
        if (path.includes('/match/pass') && method === 'POST') {
            return await passMatch(event);
        }
        
        // GET /api/match/status - Get match status
        if (path.includes('/match/status') && method === 'GET') {
            return await getMatchStatus(event);
        }
        
        // GET /api/match/pool-stats - Get matching pool statistics
        if (path.includes('/match/pool-stats') && method === 'GET') {
            return await getPoolStats(event);
        }
        
        // POST /api/match/unmatch - End a match and restore visibility
        if (path.includes('/match/unmatch') && method === 'POST') {
            return await unmatch(event);
        }
        
        // GET /api/notifications - Get unread notifications for user
        if (path.includes('/notifications') && method === 'GET') {
            return await getNotifications(event);
        }
        
        // POST /api/notifications/read - Mark notifications as read
        if (path.includes('/notifications/read') && method === 'POST') {
            return await markNotificationsRead(event);
        }
        
        // POST /api/notifications/token - Register push notification token
        if (path.includes('/notifications/token') && method === 'POST') {
            return await registerPushToken(event);
        }
        
        // ============ SAFETY & MODERATION ============
        
        // POST /api/report - Report a user
        if (path.includes('/report') && method === 'POST') {
            return await reportUser(event);
        }
        
        // POST /api/block - Block a user
        if (path.includes('/block') && method === 'POST') {
            return await blockUser(event);
        }
        
        // DELETE /api/block - Unblock a user
        if (path.includes('/block') && method === 'DELETE') {
            return await unblockUser(event);
        }
        
        // GET /api/blocks - Get blocked users list
        if (path.includes('/blocks') && method === 'GET') {
            return await getBlockedUsers(event);
        }
        
        // ============ ACCOUNT MANAGEMENT ============
        
        // DELETE /api/account - Delete account (GDPR)
        if (path.includes('/account') && method === 'DELETE') {
            return await deleteAccount(event);
        }
        
        // ============ STRIPE WEBHOOKS ============
        
        // POST /api/stripe/webhook - Handle Stripe events
        if (path.includes('/stripe/webhook') && method === 'POST') {
            return await handleStripeWebhook(event);
        }
        
        // ============ DIAGNOSTICS ============
        
        // POST /api/match/diagnose - Diagnose why two users aren't matching
        if (path.includes('/match/diagnose') && method === 'POST') {
            return await diagnoseMatch(event);
        }
        
        // POST /api/match/activate-all - Make all profiles active (admin)
        if (path.includes('/match/activate-all') && method === 'POST') {
            return await activateAllProfiles(event);
        }
        
        // POST /api/profiles/update - Update a user profile (admin)
        if (path.includes('/profiles/update') && method === 'POST') {
            return await updateUserProfile(event);
        }
        
        // ============ ADMIN ACTIVITY LOG ============
        
        // POST /admin/activity-log - Log admin activity
        if (path.includes('/admin/activity-log') && method === 'POST') {
            return await logAdminActivity(event);
        }
        
        // GET /admin/activity-log - Get admin activity logs
        if (path.includes('/admin/activity-log') && method === 'GET') {
            return await getAdminActivityLogs(event);
        }
        
        // DELETE /admin/activity-log - Clear admin activity logs
        if (path.includes('/admin/activity-log') && method === 'DELETE') {
            return await clearAdminActivityLogs(event);
        }
        
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Endpoint not found', path, method })
        };
        
    } catch (error) {
        console.error('❌ Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

// ==========================================
// GET NEXT MATCH
// ==========================================

async function getNextMatch(event) {
    const body = JSON.parse(event.body || '{}');
    const { userEmail } = body;
    
    if (!userEmail) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'userEmail is required' })
        };
    }
    
    // Check rate limit
    const rateLimit = checkRateLimit(userEmail);
    if (rateLimit.limited) {
        return {
            statusCode: 429,
            headers: {
                ...headers,
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': rateLimit.resetIn.toString(),
                'Retry-After': rateLimit.resetIn.toString()
            },
            body: JSON.stringify({ 
                error: 'Too many requests. Please slow down.',
                retryAfter: rateLimit.resetIn
            })
        };
    }
    
    console.log(`🔍 Finding next match for: ${userEmail}`);
    
    // 1. Get current user's profile and preferences from oith-profiles
    const userResult = await docClient.send(new GetCommand({
        TableName: TABLES.PROFILES,
        Key: { email: userEmail.toLowerCase() }
    }));
    
    const currentUser = userResult.Item;
    if (!currentUser) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'User not found' })
        };
    }
    
    const myPrefs = currentUser.matchPreferences || currentUser.preferences || {};
    const myProfile = {
        email: currentUser.email,
        gender: currentUser.gender?.toLowerCase(),
        age: currentUser.age,
        coordinates: currentUser.coordinates,
        interests: currentUser.interests || [],
        drinking: currentUser.drinking,
        smoking: currentUser.smoking,
        exercise: currentUser.exercise,
        children: currentUser.children,
        religion: currentUser.religion,
        lookingFor: currentUser.lookingFor
    };
    
    // 2. Get user's match history (passed/connected)
    let matchHistory = [];
    try {
        const historyResult = await docClient.send(new QueryCommand({
            TableName: TABLES.MATCH_HISTORY,
            KeyConditionExpression: 'userEmail = :email',
            ExpressionAttributeValues: { ':email': userEmail.toLowerCase() }
        }));
        matchHistory = historyResult.Items || [];
    } catch (e) {
        console.log('No match history table or empty history');
    }
    
    const passedIds = matchHistory.filter(h => h.action === 'pass').map(h => h.matchEmail);
    const connectedIds = matchHistory.filter(h => h.action === 'accept').map(h => h.matchEmail);
    
    // 2c. Get blocked users (both directions - users I blocked AND users who blocked me)
    let blockedEmails = [];
    try {
        const [myBlocks, blockedByOthers] = await Promise.all([
            // Users I blocked
            docClient.send(new QueryCommand({
                TableName: TABLES.BLOCKS,
                KeyConditionExpression: 'blockerEmail = :email',
                ExpressionAttributeValues: { ':email': userEmail.toLowerCase() }
            })),
            // Users who blocked me
            docClient.send(new ScanCommand({
                TableName: TABLES.BLOCKS,
                FilterExpression: 'blockedEmail = :email',
                ExpressionAttributeValues: { ':email': userEmail.toLowerCase() }
            }))
        ]);
        
        const myBlockedList = (myBlocks.Items || []).map(b => b.blockedEmail);
        const blockedMeList = (blockedByOthers.Items || []).map(b => b.blockerEmail);
        blockedEmails = [...myBlockedList, ...blockedMeList];
    } catch (e) {
        console.log('No blocks table or empty:', e.message);
    }
    
    const excludeEmails = [...passedIds, ...connectedIds, ...blockedEmails, userEmail.toLowerCase()];
    
    // 2b. Check for expired presented matches and auto-pass them
    await autoPassExpiredMatches(userEmail.toLowerCase());
    
    // Periodic cleanup of rate limit cache
    if (Math.random() < 0.1) cleanupRateLimitCache();
    
    // 3. Get potential matches - use GSI if user has coordinates, otherwise scan
    const activeThreshold = new Date(Date.now() - CONFIG.ACTIVE_USER_DAYS * 24 * 60 * 60 * 1000).toISOString();
    
    let allProfiles = [];
    let queryMethod = 'scan';
    
    // Try to use GSI for efficient geohash-based query
    if (currentUser.coordinates?.lat && currentUser.coordinates?.lng) {
        const userGeohash = encodeGeohash(
            currentUser.coordinates.lat, 
            currentUser.coordinates.lng, 
            CONFIG.GEOHASH_PRECISION
        );
        const neighboringHashes = getNeighboringGeohashes(userGeohash);
        const searchHashes = [userGeohash, ...neighboringHashes];
        
        console.log(`📍 Using GSI query with geohashes: ${searchHashes.join(', ')}`);
        
        try {
            // Query each geohash prefix (user's location + 8 neighbors = ~9 queries)
            const gsiQueries = searchHashes.map(hash => 
                docClient.send(new QueryCommand({
                    TableName: TABLES.PROFILES,
                    IndexName: GEOHASH_GSI_NAME,
                    KeyConditionExpression: 'geohash_prefix = :hash AND lastSeen > :active',
                    FilterExpression: 'attribute_exists(firstName) AND (attribute_not_exists(isVisible) OR isVisible <> :false)',
                    ExpressionAttributeValues: {
                        ':hash': hash,
                        ':active': activeThreshold,
                        ':false': false
                    },
                    Limit: 100
                })).catch(err => {
                    // GSI might not exist yet - will fallback to scan
                    console.log(`GSI query failed for ${hash}: ${err.message}`);
                    return { Items: [] };
                })
            );
            
            const results = await Promise.all(gsiQueries);
            allProfiles = results.flatMap(r => r.Items || []);
            
            // Deduplicate (same profile might appear in multiple geohash areas)
            const seen = new Set();
            allProfiles = allProfiles.filter(p => {
                if (seen.has(p.email)) return false;
                seen.add(p.email);
                return true;
            });
            
            if (allProfiles.length > 0) {
                queryMethod = 'gsi';
                console.log(`📊 GSI returned ${allProfiles.length} nearby profiles`);
            }
        } catch (gsiError) {
            console.log(`GSI not available, falling back to scan: ${gsiError.message}`);
        }
    }
    
    // Fallback to table scan if GSI didn't return results or user has no coordinates
    if (allProfiles.length === 0) {
        console.log('📊 Using table scan (no coordinates or GSI unavailable)');
        
        let lastEvaluatedKey = null;
        let scanCount = 0;
        const maxScans = 10;
        
        do {
            const scanParams = {
                TableName: TABLES.PROFILES,
                FilterExpression: 'attribute_exists(firstName) AND (attribute_not_exists(isVisible) OR isVisible <> :false) AND (attribute_not_exists(lastSeen) OR lastSeen > :activeThreshold)',
                ExpressionAttributeValues: { 
                    ':false': false,
                    ':activeThreshold': activeThreshold
                },
                Limit: CONFIG.MAX_SCAN_LIMIT
            };
            
            if (lastEvaluatedKey) {
                scanParams.ExclusiveStartKey = lastEvaluatedKey;
            }
            
            const scanResult = await docClient.send(new ScanCommand(scanParams));
            allProfiles = allProfiles.concat(scanResult.Items || []);
            lastEvaluatedKey = scanResult.LastEvaluatedKey;
            scanCount++;
            
            if (allProfiles.length >= 1000 || scanCount >= maxScans) {
                break;
            }
        } while (lastEvaluatedKey);
        
        console.log(`📊 Scanned ${allProfiles.length} profiles in ${scanCount} scan(s)`);
    }
    
    console.log(`📊 Query method: ${queryMethod}, Total profiles: ${allProfiles.length}`);
    
    const potentialMatches = allProfiles.filter(user => 
        !excludeEmails.includes(user.email?.toLowerCase())
    );
    
    console.log(`📊 Found ${potentialMatches.length} potential matches`);
    
    // 4. Apply mutual preference matching
    const mutualMatches = [];
    
    for (const match of potentialMatches) {
        const matchProfile = {
            email: match.email,
            gender: match.gender?.toLowerCase(),
            age: match.age,
            coordinates: match.coordinates,
            interests: match.interests || [],
            drinking: match.drinking,
            smoking: match.smoking,
            exercise: match.exercise,
            children: match.children,
            religion: match.religion,
            lookingFor: match.lookingFor,
            matchPreferences: match.matchPreferences || match.preferences || {}
        };
        
        // A) Does match fit MY preferences?
        const matchFitsMine = checkPreferenceMatch(matchProfile, myPrefs, myProfile);
        if (!matchFitsMine.matches) {
            console.log(`  ❌ ${match.firstName}: ${matchFitsMine.reason}`);
            continue;
        }
        
        // B) Do I fit MATCH'S preferences?
        const iFitTheirs = checkPreferenceMatch(myProfile, matchProfile.matchPreferences, matchProfile);
        if (!iFitTheirs.matches) {
            console.log(`  ❌ ${match.firstName}: I don't fit their prefs (${iFitTheirs.reason})`);
            continue;
        }
        
        // Calculate compatibility
        const compatibility = calculateCompatibility(myProfile, matchProfile);
        const distance = matchFitsMine.distance || 10;
        
        console.log(`  ✅ ${match.firstName}: ${compatibility}% compatible, ${distance}mi away`);
        
        mutualMatches.push({
            email: match.email,
            firstName: match.firstName,
            age: match.age,
            gender: match.gender,
            photo: match.photos?.[0] || match.photo,
            photos: match.photos || [],
            occupation: match.occupation,
            location: match.location,
            bio: match.bio,
            interests: match.interests || [],
            height: match.height,
            distance: distance,
            compatibility: compatibility
        });
    }
    
    // 5. Sort by compatibility and return best match
    mutualMatches.sort((a, b) => b.compatibility - a.compatibility);
    
    if (mutualMatches.length === 0) {
        // Fixes issue #8 - Match pool exhaustion handling
        const exhaustionInfo = await getMatchPoolExhaustionInfo(userEmail, potentialMatches.length, excludeEmails.length);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                match: null, 
                message: exhaustionInfo.message,
                exhaustionStatus: exhaustionInfo.status,
                stats: {
                    poolSize: potentialMatches.length,
                    excludedCount: excludeEmails.length - 1,
                    ...exhaustionInfo.stats
                },
                suggestions: exhaustionInfo.suggestions
            })
        };
    }
    
    const bestMatch = mutualMatches[0];
    
    // 6. Record that we presented this match
    try {
        await docClient.send(new PutCommand({
            TableName: TABLES.MATCHES,
            Item: {
                matchId: `${userEmail.toLowerCase()}_${bestMatch.email}`,
                userEmail: userEmail.toLowerCase(),
                matchEmail: bestMatch.email,
                status: 'presented',
                presentedAt: new Date().toISOString(),
                compatibility: bestMatch.compatibility,
                distance: bestMatch.distance
            }
        }));
    } catch (e) {
        console.log('Could not record match presentation');
    }
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            match: bestMatch,
            stats: {
                poolSize: potentialMatches.length,
                mutualMatches: mutualMatches.length,
                topMatches: mutualMatches.slice(0, 5).map(m => ({
                    name: m.firstName,
                    compatibility: m.compatibility
                }))
            }
        })
    };
}

// ==========================================
// ACCEPT MATCH
// ==========================================

async function acceptMatch(event) {
    const body = JSON.parse(event.body || '{}');
    const { userEmail, matchEmail } = body;
    
    if (!userEmail || !matchEmail) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'userEmail and matchEmail are required' })
        };
    }
    
    console.log(`💕 ${userEmail} accepting ${matchEmail}`);
    
    // Record the accept action
    await docClient.send(new PutCommand({
        TableName: TABLES.MATCH_HISTORY,
        Item: {
            userEmail: userEmail.toLowerCase(),
            matchEmail: matchEmail.toLowerCase(),
            action: 'accept',
            timestamp: new Date().toISOString()
        }
    }));
    
    // Update match status
    const matchId = `${userEmail.toLowerCase()}_${matchEmail.toLowerCase()}`;
    await docClient.send(new UpdateCommand({
        TableName: TABLES.MATCHES,
        Key: { matchId },
        UpdateExpression: 'SET #status = :status, acceptedAt = :time',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
            ':status': 'accepted',
            ':time': new Date().toISOString()
        }
    }));
    
    // Check if it's a mutual match (other user also accepted)
    // Use atomic conditional update to prevent race conditions
    const reverseMatchId = `${matchEmail.toLowerCase()}_${userEmail.toLowerCase()}`;
    const reverseResult = await docClient.send(new GetCommand({
        TableName: TABLES.MATCHES,
        Key: { matchId: reverseMatchId }
    }));
    
    const isMutual = reverseResult.Item?.status === 'accepted';
    
    if (isMutual) {
        console.log(`🎉 MUTUAL MATCH: ${userEmail} <-> ${matchEmail}`);
        
        // Use conditional update to ensure only ONE process handles the mutual match
        // This prevents race conditions when both users accept simultaneously
        try {
            await docClient.send(new UpdateCommand({
                TableName: TABLES.MATCHES,
                Key: { matchId },
                UpdateExpression: 'SET mutualMatchProcessed = :true, processedAt = :time',
                ConditionExpression: 'attribute_not_exists(mutualMatchProcessed)',
                ExpressionAttributeValues: {
                    ':true': true,
                    ':time': new Date().toISOString()
                }
            }));
            
            // We won the race - process the mutual match
            console.log(`🏆 Won race condition for ${matchId} - processing mutual match`);
            
            // Get both user profiles for notification details
            const [userProfile, matchProfile] = await Promise.all([
                docClient.send(new GetCommand({
                    TableName: TABLES.PROFILES,
                    Key: { email: userEmail.toLowerCase() }
                })),
                docClient.send(new GetCommand({
                    TableName: TABLES.PROFILES,
                    Key: { email: matchEmail.toLowerCase() }
                }))
            ]);
            
            const userData = userProfile.Item || {};
            const matchData = matchProfile.Item || {};
            
            // Update both users' visibility to hidden (with condition to prevent double-update)
            await Promise.all([
                docClient.send(new UpdateCommand({
                    TableName: TABLES.PROFILES,
                    Key: { email: userEmail.toLowerCase() },
                    UpdateExpression: 'SET isVisible = :false, activeMatchEmail = :match, matchedAt = :time',
                    ConditionExpression: 'attribute_not_exists(activeMatchEmail) OR activeMatchEmail = :match',
                    ExpressionAttributeValues: {
                        ':false': false,
                        ':match': matchEmail.toLowerCase(),
                        ':time': new Date().toISOString()
                    }
                })).catch(e => console.log('User already matched:', e.message)),
                docClient.send(new UpdateCommand({
                    TableName: TABLES.PROFILES,
                    Key: { email: matchEmail.toLowerCase() },
                    UpdateExpression: 'SET isVisible = :false, activeMatchEmail = :match, matchedAt = :time',
                    ConditionExpression: 'attribute_not_exists(activeMatchEmail) OR activeMatchEmail = :match',
                    ExpressionAttributeValues: {
                        ':false': false,
                        ':match': userEmail.toLowerCase(),
                        ':time': new Date().toISOString()
                    }
                })).catch(e => console.log('Match already matched:', e.message))
            ]);
            
            // Create notifications for BOTH users
            await Promise.all([
                createNotification(userEmail, 'mutual_match', {
                    matchEmail: matchEmail.toLowerCase(),
                    matchName: matchData.firstName || 'Someone',
                    matchPhoto: matchData.photos?.[0] || matchData.photo || null,
                    message: `You matched with ${matchData.firstName || 'someone'}! Start a conversation.`
                }),
                createNotification(matchEmail, 'mutual_match', {
                    matchEmail: userEmail.toLowerCase(),
                    matchName: userData.firstName || 'Someone',
                    matchPhoto: userData.photos?.[0] || userData.photo || null,
                    message: `You matched with ${userData.firstName || 'someone'}! Start a conversation.`
                })
            ]);
            
            console.log(`📬 Notifications sent to both ${userEmail} and ${matchEmail}`);
            
        } catch (conditionError) {
            // Lost the race - the other process already handled it
            console.log(`⏭️ Race condition: mutual match already processed by other request`);
        }
    }
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            isMutual: isMutual,
            message: isMutual ? "It's a match! You both liked each other!" : "Waiting for their response..."
        })
    };
}

// ==========================================
// PASS MATCH
// ==========================================

async function passMatch(event) {
    const body = JSON.parse(event.body || '{}');
    const { userEmail, matchEmail } = body;
    
    if (!userEmail || !matchEmail) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'userEmail and matchEmail are required' })
        };
    }
    
    console.log(`👋 ${userEmail} passing on ${matchEmail}`);
    
    // Record the pass action
    await docClient.send(new PutCommand({
        TableName: TABLES.MATCH_HISTORY,
        Item: {
            userEmail: userEmail.toLowerCase(),
            matchEmail: matchEmail.toLowerCase(),
            action: 'pass',
            timestamp: new Date().toISOString()
        }
    }));
    
    // Update match status
    const matchId = `${userEmail.toLowerCase()}_${matchEmail.toLowerCase()}`;
    await docClient.send(new UpdateCommand({
        TableName: TABLES.MATCHES,
        Key: { matchId },
        UpdateExpression: 'SET #status = :status, passedAt = :time',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
            ':status': 'passed',
            ':time': new Date().toISOString()
        }
    }));
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            message: 'Match passed. Getting next match...'
        })
    };
}

// ==========================================
// UNMATCH - End match and restore visibility
// ==========================================

async function unmatch(event) {
    const body = JSON.parse(event.body || '{}');
    const { userEmail, matchEmail, reason } = body;
    
    if (!userEmail) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'userEmail is required' })
        };
    }
    
    console.log(`💔 ${userEmail} unmatching from ${matchEmail || 'active match'}`);
    
    // Get current user's profile to find their active match
    const userResult = await docClient.send(new GetCommand({
        TableName: TABLES.PROFILES,
        Key: { email: userEmail.toLowerCase() }
    }));
    
    const user = userResult.Item;
    const activeMatch = matchEmail || user?.activeMatchEmail;
    
    if (!activeMatch) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'No active match to unmatch from' })
        };
    }
    
    // Record the unmatch in history (prevents re-matching)
    await Promise.all([
        // User's history
        docClient.send(new PutCommand({
            TableName: TABLES.MATCH_HISTORY,
            Item: {
                userEmail: userEmail.toLowerCase(),
                matchEmail: activeMatch.toLowerCase(),
                action: 'unmatch',
                reason: reason || 'user_initiated',
                timestamp: new Date().toISOString()
            }
        })),
        // Match's history (they also can't match with this user again)
        docClient.send(new PutCommand({
            TableName: TABLES.MATCH_HISTORY,
            Item: {
                userEmail: activeMatch.toLowerCase(),
                matchEmail: userEmail.toLowerCase(),
                action: 'unmatched_by',
                reason: reason || 'other_user_initiated',
                timestamp: new Date().toISOString()
            }
        }))
    ]);
    
    // Restore visibility for BOTH users
    await Promise.all([
        docClient.send(new UpdateCommand({
            TableName: TABLES.PROFILES,
            Key: { email: userEmail.toLowerCase() },
            UpdateExpression: 'SET isVisible = :true REMOVE activeMatchEmail, matchedAt',
            ExpressionAttributeValues: { ':true': true }
        })),
        docClient.send(new UpdateCommand({
            TableName: TABLES.PROFILES,
            Key: { email: activeMatch.toLowerCase() },
            UpdateExpression: 'SET isVisible = :true REMOVE activeMatchEmail, matchedAt',
            ExpressionAttributeValues: { ':true': true }
        }))
    ]);
    
    // Notify the other user that they've been unmatched
    await createNotification(activeMatch, 'unmatched', {
        message: 'Your match has ended. You\'re back in the matching pool!',
        unmatchedBy: userEmail.toLowerCase()
    });
    
    console.log(`✅ Both ${userEmail} and ${activeMatch} are now visible again`);
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            message: 'Match ended. You\'re back in the matching pool!',
            restoredVisibility: true
        })
    };
}

// ==========================================
// GET MATCH STATUS
// ==========================================

async function getMatchStatus(event) {
    const userEmail = event.queryStringParameters?.userEmail;
    
    if (!userEmail) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'userEmail is required' })
        };
    }
    
    // Get user's current active match from profiles table
    const userResult = await docClient.send(new GetCommand({
        TableName: TABLES.PROFILES,
        Key: { email: userEmail.toLowerCase() }
    }));
    
    const user = userResult.Item;
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            isVisible: user?.isVisible !== false,
            activeMatchEmail: user?.activeMatchEmail || null,
            hasActiveMatch: !!user?.activeMatchEmail
        })
    };
}

// ==========================================
// GET POOL STATS
// ==========================================

async function getPoolStats(event) {
    const userEmail = event.queryStringParameters?.userEmail;
    
    // Count total visible users in profiles table
    const scanResult = await docClient.send(new ScanCommand({
        TableName: TABLES.PROFILES,
        FilterExpression: 'attribute_not_exists(isVisible) OR isVisible <> :false',
        ExpressionAttributeValues: { ':false': false },
        Select: 'COUNT'
    }));
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            totalVisibleUsers: scanResult.Count || 0,
            scannedCount: scanResult.ScannedCount || 0
        })
    };
}

// ==========================================
// NOTIFICATION HANDLERS
// ==========================================

/**
 * GET /api/notifications - Get unread notifications for user
 * Called when user opens app to check for matches/messages received while offline
 */
async function getNotifications(event) {
    const userEmail = event.queryStringParameters?.userEmail;
    
    if (!userEmail) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'userEmail is required' })
        };
    }
    
    console.log(`📬 Fetching notifications for: ${userEmail}`);
    
    try {
        // Get all notifications (both read and unread)
        const result = await docClient.send(new QueryCommand({
            TableName: TABLES.NOTIFICATIONS,
            KeyConditionExpression: 'userEmail = :email',
            ExpressionAttributeValues: {
                ':email': userEmail.toLowerCase()
            },
            ScanIndexForward: false, // Most recent first
            Limit: 50
        }));
        
        const notifications = result.Items || [];
        const unreadCount = notifications.filter(n => !n.read).length;
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                notifications,
                unreadCount,
                total: notifications.length
            })
        };
    } catch (error) {
        // Table might not exist yet
        console.log(`Could not fetch notifications: ${error.message}`);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                notifications: [],
                unreadCount: 0,
                total: 0,
                warning: 'Notifications table not configured'
            })
        };
    }
}

/**
 * POST /api/notifications/read - Mark notifications as read
 */
async function markNotificationsRead(event) {
    const body = JSON.parse(event.body || '{}');
    const { userEmail, notificationIds } = body;
    
    if (!userEmail) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'userEmail is required' })
        };
    }
    
    console.log(`✅ Marking notifications as read for: ${userEmail}`);
    
    try {
        if (notificationIds && notificationIds.length > 0) {
            // Mark specific notifications as read
            await Promise.all(notificationIds.map(id => 
                docClient.send(new UpdateCommand({
                    TableName: TABLES.NOTIFICATIONS,
                    Key: { userEmail: userEmail.toLowerCase(), notificationId: id },
                    UpdateExpression: 'SET #read = :true, readAt = :time',
                    ExpressionAttributeNames: { '#read': 'read' },
                    ExpressionAttributeValues: {
                        ':true': true,
                        ':time': new Date().toISOString()
                    }
                }))
            ));
        } else {
            // Mark ALL unread notifications as read
            const unread = await getUnreadNotifications(userEmail);
            await Promise.all(unread.map(n => 
                docClient.send(new UpdateCommand({
                    TableName: TABLES.NOTIFICATIONS,
                    Key: { userEmail: userEmail.toLowerCase(), notificationId: n.notificationId },
                    UpdateExpression: 'SET #read = :true, readAt = :time',
                    ExpressionAttributeNames: { '#read': 'read' },
                    ExpressionAttributeValues: {
                        ':true': true,
                        ':time': new Date().toISOString()
                    }
                }))
            ));
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true })
        };
    } catch (error) {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: false, warning: error.message })
        };
    }
}

/**
 * POST /api/notifications/token - Register push notification token
 * Used for future mobile push notifications
 */
async function registerPushToken(event) {
    const body = JSON.parse(event.body || '{}');
    const { userEmail, token, platform } = body; // platform: 'ios', 'android', 'web'
    
    if (!userEmail || !token) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'userEmail and token are required' })
        };
    }
    
    console.log(`📱 Registering push token for ${userEmail} (${platform || 'unknown'})`);
    
    try {
        // Store the token in the user's profile
        await docClient.send(new UpdateCommand({
            TableName: TABLES.PROFILES,
            Key: { email: userEmail.toLowerCase() },
            UpdateExpression: 'SET pushToken = :token, pushPlatform = :platform, tokenUpdatedAt = :time',
            ExpressionAttributeValues: {
                ':token': token,
                ':platform': platform || 'unknown',
                ':time': new Date().toISOString()
            }
        }));
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true,
                message: 'Push token registered successfully'
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
}

// ==========================================
// REPORT USER
// ==========================================

async function reportUser(event) {
    const body = JSON.parse(event.body || '{}');
    const { reporterEmail, reportedEmail, reason, details } = body;
    
    if (!reporterEmail || !reportedEmail || !reason) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'reporterEmail, reportedEmail, and reason are required' })
        };
    }
    
    const validReasons = ['harassment', 'fake_profile', 'inappropriate_content', 'scam', 'underage', 'other'];
    if (!validReasons.includes(reason)) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: `Invalid reason. Must be one of: ${validReasons.join(', ')}` })
        };
    }
    
    console.log(`🚨 Report: ${reporterEmail} reporting ${reportedEmail} for ${reason}`);
    
    const reportId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
        await docClient.send(new PutCommand({
            TableName: TABLES.REPORTS,
            Item: {
                reportId,
                reporterEmail: reporterEmail.toLowerCase(),
                reportedEmail: reportedEmail.toLowerCase(),
                reason,
                details: details || '',
                status: 'pending', // pending, reviewed, actioned, dismissed
                createdAt: new Date().toISOString()
            }
        }));
        
        // Also auto-block the reported user for the reporter
        await docClient.send(new PutCommand({
            TableName: TABLES.BLOCKS,
            Item: {
                blockerEmail: reporterEmail.toLowerCase(),
                blockedEmail: reportedEmail.toLowerCase(),
                reason: `Reported for ${reason}`,
                createdAt: new Date().toISOString()
            }
        }));
        
        // If currently matched, unmatch them
        const reporterProfile = await docClient.send(new GetCommand({
            TableName: TABLES.PROFILES,
            Key: { email: reporterEmail.toLowerCase() }
        }));
        
        if (reporterProfile.Item?.activeMatchEmail === reportedEmail.toLowerCase()) {
            // Restore reporter's visibility, hide reported user's visibility
            await docClient.send(new UpdateCommand({
                TableName: TABLES.PROFILES,
                Key: { email: reporterEmail.toLowerCase() },
                UpdateExpression: 'SET isVisible = :true REMOVE activeMatchEmail, matchedAt',
                ExpressionAttributeValues: { ':true': true }
            }));
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                reportId,
                message: 'Report submitted. This user has been blocked and removed from your matches.'
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
}

// ==========================================
// BLOCK USER
// ==========================================

async function blockUser(event) {
    const body = JSON.parse(event.body || '{}');
    const { blockerEmail, blockedEmail, reason } = body;
    
    if (!blockerEmail || !blockedEmail) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'blockerEmail and blockedEmail are required' })
        };
    }
    
    console.log(`🚫 Block: ${blockerEmail} blocking ${blockedEmail}`);
    
    try {
        await docClient.send(new PutCommand({
            TableName: TABLES.BLOCKS,
            Item: {
                blockerEmail: blockerEmail.toLowerCase(),
                blockedEmail: blockedEmail.toLowerCase(),
                reason: reason || 'User blocked',
                createdAt: new Date().toISOString()
            }
        }));
        
        // If currently matched, unmatch them
        const blockerProfile = await docClient.send(new GetCommand({
            TableName: TABLES.PROFILES,
            Key: { email: blockerEmail.toLowerCase() }
        }));
        
        let matchId = null;
        
        if (blockerProfile.Item?.activeMatchEmail === blockedEmail.toLowerCase()) {
            matchId = blockerProfile.Item.matchId;
            
            await docClient.send(new UpdateCommand({
                TableName: TABLES.PROFILES,
                Key: { email: blockerEmail.toLowerCase() },
                UpdateExpression: 'SET isVisible = :true REMOVE activeMatchEmail, matchedAt, matchId',
                ExpressionAttributeValues: { ':true': true }
            }));
            
            // Also update the blocked user's profile
            await docClient.send(new UpdateCommand({
                TableName: TABLES.PROFILES,
                Key: { email: blockedEmail.toLowerCase() },
                UpdateExpression: 'SET isVisible = :true REMOVE activeMatchEmail, matchedAt, matchId',
                ExpressionAttributeValues: { ':true': true }
            }));
        }
        
        // Fixes issue #7 - Delete chat history when blocking user
        // This prevents the blocked user from seeing old messages
        if (matchId) {
            try {
                const { deleteChatOnBlock } = await import('./realtimeService.mjs');
                await deleteChatOnBlock(blockerEmail, blockedEmail, matchId);
            } catch (err) {
                console.log('Could not delete chat (realtimeService may not be deployed):', err.message);
            }
        }
        
        // Notify the blocked user that the match ended (without saying they were blocked)
        await createNotification(blockedEmail, 'unmatched', {
            message: 'Your match has ended.',
            timestamp: new Date().toISOString()
        });
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'User blocked successfully'
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
}

// ==========================================
// UNBLOCK USER
// ==========================================

async function unblockUser(event) {
    const body = JSON.parse(event.body || '{}');
    const { blockerEmail, blockedEmail } = body;
    
    if (!blockerEmail || !blockedEmail) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'blockerEmail and blockedEmail are required' })
        };
    }
    
    console.log(`✅ Unblock: ${blockerEmail} unblocking ${blockedEmail}`);
    
    try {
        await docClient.send(new DeleteCommand({
            TableName: TABLES.BLOCKS,
            Key: {
                blockerEmail: blockerEmail.toLowerCase(),
                blockedEmail: blockedEmail.toLowerCase()
            }
        }));
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'User unblocked successfully'
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
}

// ==========================================
// GET BLOCKED USERS
// ==========================================

async function getBlockedUsers(event) {
    const userEmail = event.queryStringParameters?.userEmail;
    
    if (!userEmail) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'userEmail is required' })
        };
    }
    
    try {
        const result = await docClient.send(new QueryCommand({
            TableName: TABLES.BLOCKS,
            KeyConditionExpression: 'blockerEmail = :email',
            ExpressionAttributeValues: { ':email': userEmail.toLowerCase() }
        }));
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                blockedUsers: (result.Items || []).map(b => ({
                    email: b.blockedEmail,
                    blockedAt: b.createdAt,
                    reason: b.reason
                }))
            })
        };
    } catch (error) {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ blockedUsers: [] })
        };
    }
}

// ==========================================
// DELETE ACCOUNT (GDPR Compliance)
// ==========================================

async function deleteAccount(event) {
    const body = JSON.parse(event.body || '{}');
    const { userEmail, confirmEmail } = body;
    
    if (!userEmail || !confirmEmail) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'userEmail and confirmEmail are required' })
        };
    }
    
    if (userEmail.toLowerCase() !== confirmEmail.toLowerCase()) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Email confirmation does not match' })
        };
    }
    
    console.log(`🗑️ Account deletion requested for: ${userEmail}`);
    
    const email = userEmail.toLowerCase();
    
    try {
        // 1. Get current profile to check for active match
        const profile = await docClient.send(new GetCommand({
            TableName: TABLES.PROFILES,
            Key: { email }
        }));
        
        // 2. If matched, restore other user's visibility
        if (profile.Item?.activeMatchEmail) {
            await docClient.send(new UpdateCommand({
                TableName: TABLES.PROFILES,
                Key: { email: profile.Item.activeMatchEmail },
                UpdateExpression: 'SET isVisible = :true REMOVE activeMatchEmail, matchedAt',
                ExpressionAttributeValues: { ':true': true }
            }));
            
            // Notify them
            await createNotification(profile.Item.activeMatchEmail, 'match_ended', {
                message: 'Your match has left OITH. You\'re back in the matching pool!'
            });
        }
        
        // 3. Delete from all tables
        const deletions = [
            // Delete profile
            docClient.send(new DeleteCommand({
                TableName: TABLES.PROFILES,
                Key: { email }
            })),
            
            // Delete from company table (subscription, settings, etc.)
            docClient.send(new DeleteCommand({
                TableName: TABLES.COMPANY,
                Key: { pk: `USER#${email}`, sk: 'PROFILE' }
            })).catch(() => {}),
            docClient.send(new DeleteCommand({
                TableName: TABLES.COMPANY,
                Key: { pk: `USER#${email}`, sk: 'SUBSCRIPTION' }
            })).catch(() => {}),
            docClient.send(new DeleteCommand({
                TableName: TABLES.COMPANY,
                Key: { pk: `USER#${email}`, sk: 'SETTINGS' }
            })).catch(() => {}),
            docClient.send(new DeleteCommand({
                TableName: TABLES.COMPANY,
                Key: { pk: `USER#${email}`, sk: 'EMERGENCY_CONTACT' }
            })).catch(() => {}),
            docClient.send(new DeleteCommand({
                TableName: TABLES.COMPANY,
                Key: { pk: `USER#${email}`, sk: 'ACTIVITY' }
            })).catch(() => {})
        ];
        
        await Promise.all(deletions);
        
        // 4. Delete match history (scan and delete)
        try {
            const matchHistory = await docClient.send(new QueryCommand({
                TableName: TABLES.MATCH_HISTORY,
                KeyConditionExpression: 'userEmail = :email',
                ExpressionAttributeValues: { ':email': email }
            }));
            
            for (const item of (matchHistory.Items || [])) {
                await docClient.send(new DeleteCommand({
                    TableName: TABLES.MATCH_HISTORY,
                    Key: { userEmail: item.userEmail, matchEmail: item.matchEmail }
                }));
            }
        } catch (e) {
            console.log('Could not delete match history:', e.message);
        }
        
        // 5. Delete notifications
        try {
            const notifications = await docClient.send(new QueryCommand({
                TableName: TABLES.NOTIFICATIONS,
                KeyConditionExpression: 'userEmail = :email',
                ExpressionAttributeValues: { ':email': email }
            }));
            
            for (const item of (notifications.Items || [])) {
                await docClient.send(new DeleteCommand({
                    TableName: TABLES.NOTIFICATIONS,
                    Key: { userEmail: item.userEmail, notificationId: item.notificationId }
                }));
            }
        } catch (e) {
            console.log('Could not delete notifications:', e.message);
        }
        
        // 6. Delete blocks (both directions)
        try {
            const myBlocks = await docClient.send(new QueryCommand({
                TableName: TABLES.BLOCKS,
                KeyConditionExpression: 'blockerEmail = :email',
                ExpressionAttributeValues: { ':email': email }
            }));
            
            for (const item of (myBlocks.Items || [])) {
                await docClient.send(new DeleteCommand({
                    TableName: TABLES.BLOCKS,
                    Key: { blockerEmail: item.blockerEmail, blockedEmail: item.blockedEmail }
                }));
            }
        } catch (e) {
            console.log('Could not delete blocks:', e.message);
        }
        
        console.log(`✅ Account ${email} fully deleted`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Your account and all associated data have been permanently deleted.',
                deletedAt: new Date().toISOString()
            })
        };
        
    } catch (error) {
        console.error('Account deletion error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to delete account. Please contact support.' })
        };
    }
}

// ==========================================
// STRIPE WEBHOOK HANDLER
// ==========================================

async function handleStripeWebhook(event) {
    console.log('💳 Stripe webhook received');
    
    // In production, verify webhook signature using Stripe secret
    // const sig = event.headers['stripe-signature'];
    // const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    let stripeEvent;
    try {
        stripeEvent = JSON.parse(event.body || '{}');
    } catch (err) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid JSON' })
        };
    }
    
    const eventType = stripeEvent.type;
    const data = stripeEvent.data?.object;
    
    console.log(`💳 Stripe event: ${eventType}`);
    
    try {
        switch (eventType) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
                await handleSubscriptionUpdate(data);
                break;
                
            case 'customer.subscription.deleted':
                await handleSubscriptionCanceled(data);
                break;
                
            case 'invoice.payment_failed':
                await handlePaymentFailed(data);
                break;
                
            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(data);
                break;
                
            default:
                console.log(`Unhandled Stripe event: ${eventType}`);
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ received: true })
        };
        
    } catch (error) {
        console.error('Webhook handler error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
}

async function handleSubscriptionUpdate(subscription) {
    const customerEmail = subscription.customer_email || subscription.metadata?.email;
    if (!customerEmail) {
        console.log('No email in subscription, skipping');
        return;
    }
    
    console.log(`📧 Updating subscription for ${customerEmail}: ${subscription.status}`);
    
    await docClient.send(new UpdateCommand({
        TableName: TABLES.COMPANY,
        Key: { pk: `USER#${customerEmail.toLowerCase()}`, sk: 'SUBSCRIPTION' },
        UpdateExpression: 'SET #status = :status, stripeSubscriptionId = :subId, stripePlan = :plan, currentPeriodEnd = :periodEnd, updatedAt = :time',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
            ':status': subscription.status, // active, past_due, canceled, etc.
            ':subId': subscription.id,
            ':plan': subscription.items?.data?.[0]?.price?.id || 'unknown',
            ':periodEnd': new Date(subscription.current_period_end * 1000).toISOString(),
            ':time': new Date().toISOString()
        }
    }));
}

async function handleSubscriptionCanceled(subscription) {
    const customerEmail = subscription.customer_email || subscription.metadata?.email;
    if (!customerEmail) return;
    
    console.log(`❌ Subscription canceled for ${customerEmail}`);
    
    await docClient.send(new UpdateCommand({
        TableName: TABLES.COMPANY,
        Key: { pk: `USER#${customerEmail.toLowerCase()}`, sk: 'SUBSCRIPTION' },
        UpdateExpression: 'SET #status = :status, canceledAt = :time, updatedAt = :time',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
            ':status': 'canceled',
            ':time': new Date().toISOString()
        }
    }));
    
    // Notify user
    await createNotification(customerEmail, 'subscription_canceled', {
        message: 'Your OITH subscription has been canceled.'
    });
}

async function handlePaymentFailed(invoice) {
    const customerEmail = invoice.customer_email;
    if (!customerEmail) return;
    
    console.log(`💳 Payment failed for ${customerEmail}`);
    
    await docClient.send(new UpdateCommand({
        TableName: TABLES.COMPANY,
        Key: { pk: `USER#${customerEmail.toLowerCase()}`, sk: 'SUBSCRIPTION' },
        UpdateExpression: 'SET #status = :status, lastPaymentFailed = :time, updatedAt = :time',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
            ':status': 'past_due',
            ':time': new Date().toISOString()
        }
    }));
    
    // Notify user to update payment method
    await createNotification(customerEmail, 'payment_failed', {
        message: 'Your payment failed. Please update your payment method to continue using OITH.'
    });
}

async function handlePaymentSucceeded(invoice) {
    const customerEmail = invoice.customer_email;
    if (!customerEmail) return;
    
    console.log(`✅ Payment succeeded for ${customerEmail}`);
    
    await docClient.send(new UpdateCommand({
        TableName: TABLES.COMPANY,
        Key: { pk: `USER#${customerEmail.toLowerCase()}`, sk: 'SUBSCRIPTION' },
        UpdateExpression: 'SET #status = :status, lastPaymentAt = :time, updatedAt = :time',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
            ':status': 'active',
            ':time': new Date().toISOString()
        }
    }));
}

// ==========================================
// ADMIN: UPDATE USER PROFILE
// ==========================================

/**
 * Update a user's profile from admin panel
 * Updates both oith-profiles (for matching) and oith-users (for admin data)
 */
async function updateUserProfile(event) {
    const body = JSON.parse(event.body || '{}');
    const { email, updates } = body;
    
    if (!email) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'email is required' })
        };
    }
    
    const lowerEmail = email.toLowerCase();
    const now = new Date().toISOString();
    
    console.log(`📝 Updating profile for: ${lowerEmail}`, updates);
    
    try {
        // Build update expression dynamically based on provided fields
        const updateFields = [];
        const expressionAttributeValues = {
            ':now': now
        };
        const expressionAttributeNames = {};
        
        // Map of allowed fields
        const allowedFields = [
            'firstName', 'name', 'age', 'gender', 'location', 'education',
            'occupation', 'bio', 'height', 'bodyType', 'drinking', 'smoking',
            'exercise', 'children', 'religion', 'lookingFor', 'interests',
            'photos', 'matchPreferences', 'isVisible', 'accountStatus'
        ];
        
        for (const field of allowedFields) {
            if (updates && updates[field] !== undefined) {
                // Handle reserved words
                if (field === 'name' || field === 'location' || field === 'status') {
                    expressionAttributeNames[`#${field}`] = field;
                    updateFields.push(`#${field} = :${field}`);
                } else {
                    updateFields.push(`${field} = :${field}`);
                }
                expressionAttributeValues[`:${field}`] = updates[field];
            }
        }
        
        // Always update lastSeen and updatedAt
        updateFields.push('lastSeen = :now');
        updateFields.push('updatedAt = :now');
        
        if (updateFields.length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'No valid fields to update' })
            };
        }
        
        const updateExpression = 'SET ' + updateFields.join(', ');
        
        // Update oith-profiles table
        const updateParams = {
            TableName: TABLES.PROFILES,
            Key: { email: lowerEmail },
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: 'ALL_NEW'
        };
        
        if (Object.keys(expressionAttributeNames).length > 0) {
            updateParams.ExpressionAttributeNames = expressionAttributeNames;
        }
        
        const result = await docClient.send(new UpdateCommand(updateParams));
        
        console.log(`✅ Profile updated in oith-profiles: ${lowerEmail}`);
        
        // Also update oith-users table for admin reference
        try {
            await docClient.send(new UpdateCommand({
                TableName: TABLES.COMPANY,
                Key: { 
                    pk: `USER#${lowerEmail}`,
                    sk: 'PROFILE'
                },
                UpdateExpression: updateExpression,
                ExpressionAttributeValues: expressionAttributeValues,
                ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined
            }));
            console.log(`✅ Profile updated in oith-users: ${lowerEmail}`);
        } catch (adminErr) {
            console.log(`⚠️ Could not update oith-users (may not exist): ${adminErr.message}`);
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `Profile updated for ${lowerEmail}`,
                updatedFields: Object.keys(updates || {}),
                profile: result.Attributes
            })
        };
        
    } catch (error) {
        console.error(`❌ Error updating profile: ${error.message}`);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
}

// ==========================================
// ADMIN: ACTIVATE ALL PROFILES
// ==========================================

/**
 * Make all profiles active (visible and recently seen)
 * This updates isVisible=true and lastSeen=now for all profiles
 */
async function activateAllProfiles(event) {
    console.log('🔄 Activating all profiles...');
    
    const now = new Date().toISOString();
    let activated = 0;
    let errors = [];
    
    try {
        // Scan all profiles
        let lastEvaluatedKey = null;
        const allProfiles = [];
        
        do {
            const scanParams = {
                TableName: TABLES.PROFILES,
                Limit: 100
            };
            
            if (lastEvaluatedKey) {
                scanParams.ExclusiveStartKey = lastEvaluatedKey;
            }
            
            const scanResult = await docClient.send(new ScanCommand(scanParams));
            allProfiles.push(...(scanResult.Items || []));
            lastEvaluatedKey = scanResult.LastEvaluatedKey;
        } while (lastEvaluatedKey);
        
        console.log(`📊 Found ${allProfiles.length} profiles to activate`);
        
        // Update each profile
        for (const profile of allProfiles) {
            if (!profile.email) continue;
            
            try {
                await docClient.send(new UpdateCommand({
                    TableName: TABLES.PROFILES,
                    Key: { email: profile.email },
                    UpdateExpression: 'SET isVisible = :visible, lastSeen = :now',
                    ExpressionAttributeValues: {
                        ':visible': true,
                        ':now': now
                    }
                }));
                activated++;
                console.log(`  ✅ Activated: ${profile.firstName || profile.email}`);
            } catch (err) {
                errors.push({ email: profile.email, error: err.message });
                console.log(`  ❌ Failed: ${profile.email} - ${err.message}`);
            }
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `Activated ${activated} profiles`,
                activated,
                total: allProfiles.length,
                errors: errors.length > 0 ? errors : undefined,
                timestamp: now
            })
        };
        
    } catch (error) {
        console.error('❌ Error activating profiles:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
}

// ==========================================
// DIAGNOSTIC ENDPOINT
// ==========================================

/**
 * Diagnose why two users aren't matching
 * Takes two user emails and returns detailed explanation
 */
async function diagnoseMatch(event) {
    const body = JSON.parse(event.body || '{}');
    const { userEmail1, userEmail2 } = body;
    
    if (!userEmail1 || !userEmail2) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
                error: 'Both userEmail1 and userEmail2 are required',
                usage: 'POST /api/match/diagnose { "userEmail1": "user1@example.com", "userEmail2": "user2@example.com" }'
            })
        };
    }
    
    console.log(`🔍 Diagnosing match between ${userEmail1} and ${userEmail2}`);
    
    const diagnosis = {
        user1: { email: userEmail1.toLowerCase() },
        user2: { email: userEmail2.toLowerCase() },
        issues: [],
        canMatch: true
    };
    
    // 1. Get both user profiles
    const [user1Result, user2Result] = await Promise.all([
        docClient.send(new GetCommand({
            TableName: TABLES.PROFILES,
            Key: { email: userEmail1.toLowerCase() }
        })),
        docClient.send(new GetCommand({
            TableName: TABLES.PROFILES,
            Key: { email: userEmail2.toLowerCase() }
        }))
    ]);
    
    const user1 = user1Result.Item;
    const user2 = user2Result.Item;
    
    // Check if users exist
    if (!user1) {
        diagnosis.issues.push({ type: 'NOT_FOUND', user: 'user1', message: `User ${userEmail1} not found in profiles table` });
        diagnosis.canMatch = false;
    }
    if (!user2) {
        diagnosis.issues.push({ type: 'NOT_FOUND', user: 'user2', message: `User ${userEmail2} not found in profiles table` });
        diagnosis.canMatch = false;
    }
    
    if (!user1 || !user2) {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(diagnosis)
        };
    }
    
    // Store profile summaries (without photos)
    diagnosis.user1.profile = {
        firstName: user1.firstName,
        gender: user1.gender,
        age: user1.age,
        location: user1.location,
        coordinates: user1.coordinates,
        isVisible: user1.isVisible,
        lastSeen: user1.lastSeen,
        matchPreferences: user1.matchPreferences || user1.preferences || {},
        drinking: user1.drinking,
        smoking: user1.smoking,
        religion: user1.religion,
        children: user1.children
    };
    diagnosis.user2.profile = {
        firstName: user2.firstName,
        gender: user2.gender,
        age: user2.age,
        location: user2.location,
        coordinates: user2.coordinates,
        isVisible: user2.isVisible,
        lastSeen: user2.lastSeen,
        matchPreferences: user2.matchPreferences || user2.preferences || {},
        drinking: user2.drinking,
        smoking: user2.smoking,
        religion: user2.religion,
        children: user2.children
    };
    
    // 2. Check visibility
    if (user1.isVisible === false) {
        diagnosis.issues.push({ 
            type: 'VISIBILITY', 
            user: 'user1', 
            message: `${user1.firstName || userEmail1} has isVisible=false (may have an active match)` 
        });
        diagnosis.canMatch = false;
    }
    if (user2.isVisible === false) {
        diagnosis.issues.push({ 
            type: 'VISIBILITY', 
            user: 'user2', 
            message: `${user2.firstName || userEmail2} has isVisible=false (may have an active match)` 
        });
        diagnosis.canMatch = false;
    }
    
    // 3. Check lastSeen (activity)
    const activeThreshold = new Date(Date.now() - CONFIG.ACTIVE_USER_DAYS * 24 * 60 * 60 * 1000);
    if (user1.lastSeen && new Date(user1.lastSeen) < activeThreshold) {
        diagnosis.issues.push({ 
            type: 'INACTIVE', 
            user: 'user1', 
            message: `${user1.firstName || userEmail1} last seen ${user1.lastSeen} (inactive > ${CONFIG.ACTIVE_USER_DAYS} days)` 
        });
        diagnosis.canMatch = false;
    }
    if (user2.lastSeen && new Date(user2.lastSeen) < activeThreshold) {
        diagnosis.issues.push({ 
            type: 'INACTIVE', 
            user: 'user2', 
            message: `${user2.firstName || userEmail2} last seen ${user2.lastSeen} (inactive > ${CONFIG.ACTIVE_USER_DAYS} days)` 
        });
        diagnosis.canMatch = false;
    }
    
    // 4. Check match history (passed/blocked)
    const [history1to2, history2to1, blocks1, blocks2] = await Promise.all([
        docClient.send(new GetCommand({
            TableName: TABLES.MATCH_HISTORY,
            Key: { userEmail: userEmail1.toLowerCase(), matchEmail: userEmail2.toLowerCase() }
        })).catch(() => ({ Item: null })),
        docClient.send(new GetCommand({
            TableName: TABLES.MATCH_HISTORY,
            Key: { userEmail: userEmail2.toLowerCase(), matchEmail: userEmail1.toLowerCase() }
        })).catch(() => ({ Item: null })),
        docClient.send(new GetCommand({
            TableName: TABLES.BLOCKS,
            Key: { blockerEmail: userEmail1.toLowerCase(), blockedEmail: userEmail2.toLowerCase() }
        })).catch(() => ({ Item: null })),
        docClient.send(new GetCommand({
            TableName: TABLES.BLOCKS,
            Key: { blockerEmail: userEmail2.toLowerCase(), blockedEmail: userEmail1.toLowerCase() }
        })).catch(() => ({ Item: null }))
    ]);
    
    if (history1to2.Item) {
        diagnosis.issues.push({ 
            type: 'HISTORY', 
            user: 'user1', 
            action: history1to2.Item.action,
            message: `${user1.firstName || userEmail1} already ${history1to2.Item.action}ed ${user2.firstName || userEmail2}` 
        });
        if (history1to2.Item.action === 'pass') diagnosis.canMatch = false;
    }
    if (history2to1.Item) {
        diagnosis.issues.push({ 
            type: 'HISTORY', 
            user: 'user2', 
            action: history2to1.Item.action,
            message: `${user2.firstName || userEmail2} already ${history2to1.Item.action}ed ${user1.firstName || userEmail1}` 
        });
        if (history2to1.Item.action === 'pass') diagnosis.canMatch = false;
    }
    if (blocks1.Item) {
        diagnosis.issues.push({ 
            type: 'BLOCKED', 
            user: 'user1', 
            message: `${user1.firstName || userEmail1} has blocked ${user2.firstName || userEmail2}` 
        });
        diagnosis.canMatch = false;
    }
    if (blocks2.Item) {
        diagnosis.issues.push({ 
            type: 'BLOCKED', 
            user: 'user2', 
            message: `${user2.firstName || userEmail2} has blocked ${user1.firstName || userEmail1}` 
        });
        diagnosis.canMatch = false;
    }
    
    // 5. Check MUTUAL preference matching
    const user1Prefs = user1.matchPreferences || user1.preferences || {};
    const user2Prefs = user2.matchPreferences || user2.preferences || {};
    
    const user1Profile = {
        email: user1.email,
        gender: user1.gender?.toLowerCase(),
        age: user1.age,
        coordinates: user1.coordinates,
        drinking: user1.drinking,
        smoking: user1.smoking,
        religion: user1.religion,
        children: user1.children
    };
    
    const user2Profile = {
        email: user2.email,
        gender: user2.gender?.toLowerCase(),
        age: user2.age,
        coordinates: user2.coordinates,
        drinking: user2.drinking,
        smoking: user2.smoking,
        religion: user2.religion,
        children: user2.children
    };
    
    // Does user2 fit user1's preferences?
    const user2FitsUser1 = checkPreferenceMatch(user2Profile, user1Prefs, user1Profile);
    if (!user2FitsUser1.matches) {
        diagnosis.issues.push({ 
            type: 'PREFERENCE_MISMATCH', 
            direction: 'user1 → user2',
            reason: user2FitsUser1.reason,
            message: `${user2.firstName || userEmail2} does NOT fit ${user1.firstName || userEmail1}'s preferences: ${user2FitsUser1.reason}`,
            details: {
                user1Wants: user1Prefs,
                user2Has: user2Profile
            }
        });
        diagnosis.canMatch = false;
    } else {
        diagnosis.issues.push({ 
            type: 'PREFERENCE_MATCH', 
            direction: 'user1 → user2',
            message: `✓ ${user2.firstName || userEmail2} FITS ${user1.firstName || userEmail1}'s preferences`,
            distance: user2FitsUser1.distance
        });
    }
    
    // Does user1 fit user2's preferences?
    const user1FitsUser2 = checkPreferenceMatch(user1Profile, user2Prefs, user2Profile);
    if (!user1FitsUser2.matches) {
        diagnosis.issues.push({ 
            type: 'PREFERENCE_MISMATCH', 
            direction: 'user2 → user1',
            reason: user1FitsUser2.reason,
            message: `${user1.firstName || userEmail1} does NOT fit ${user2.firstName || userEmail2}'s preferences: ${user1FitsUser2.reason}`,
            details: {
                user2Wants: user2Prefs,
                user1Has: user1Profile
            }
        });
        diagnosis.canMatch = false;
    } else {
        diagnosis.issues.push({ 
            type: 'PREFERENCE_MATCH', 
            direction: 'user2 → user1',
            message: `✓ ${user1.firstName || userEmail1} FITS ${user2.firstName || userEmail2}'s preferences`,
            distance: user1FitsUser2.distance
        });
    }
    
    // 6. Summary
    diagnosis.summary = diagnosis.canMatch 
        ? `✅ These users CAN match - all mutual preferences pass`
        : `❌ These users CANNOT match - see issues above`;
    
    console.log(`📋 Diagnosis complete: ${diagnosis.summary}`);
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(diagnosis, null, 2)
    };
}

// ==========================================
// ADMIN ACTIVITY LOG
// ==========================================

/**
 * Log admin activity to DynamoDB
 */
async function logAdminActivity(event) {
    const body = JSON.parse(event.body || '{}');
    const { id, type, action, details, admin, timestamp } = body;
    
    if (!type || !action) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'type and action are required' })
        };
    }
    
    const now = new Date().toISOString();
    const logId = id || `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
        await docClient.send(new PutCommand({
            TableName: TABLES.COMPANY,
            Item: {
                pk: 'ADMIN_ACTIVITY',
                sk: `LOG#${now}#${logId}`,
                id: logId,
                type,
                action,
                details: details || '',
                admin: admin || { name: 'Unknown', email: 'unknown@oith.app' },
                timestamp: timestamp || now,
                createdAt: now
            }
        }));
        
        console.log(`📝 Admin activity logged: ${type} - ${action}`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, id: logId })
        };
    } catch (error) {
        console.error('❌ Failed to log admin activity:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
}

/**
 * Get admin activity logs
 */
async function getAdminActivityLogs(event) {
    const queryParams = event.queryStringParameters || {};
    const limit = parseInt(queryParams.limit) || 100;
    
    try {
        const result = await docClient.send(new QueryCommand({
            TableName: TABLES.COMPANY,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: { ':pk': 'ADMIN_ACTIVITY' },
            ScanIndexForward: false, // Newest first
            Limit: limit
        }));
        
        const logs = (result.Items || []).map(item => ({
            id: item.id,
            type: item.type,
            action: item.action,
            details: item.details,
            admin: item.admin,
            timestamp: item.timestamp
        }));
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ logs, count: logs.length })
        };
    } catch (error) {
        console.error('❌ Failed to get admin activity logs:', error);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ logs: [], count: 0, error: error.message })
        };
    }
}

/**
 * Clear admin activity logs
 */
async function clearAdminActivityLogs(event) {
    try {
        // Get all logs first
        const result = await docClient.send(new QueryCommand({
            TableName: TABLES.COMPANY,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: { ':pk': 'ADMIN_ACTIVITY' }
        }));
        
        // Delete each log
        const deletePromises = (result.Items || []).map(item =>
            docClient.send(new DeleteCommand({
                TableName: TABLES.COMPANY,
                Key: { pk: item.pk, sk: item.sk }
            }))
        );
        
        await Promise.all(deletePromises);
        
        console.log(`🗑️ Cleared ${result.Items?.length || 0} admin activity logs`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, deleted: result.Items?.length || 0 })
        };
    } catch (error) {
        console.error('❌ Failed to clear admin activity logs:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
}

