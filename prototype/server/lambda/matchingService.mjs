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
    ScanCommand
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
    COMPANY: 'oith-users'                // Company/admin data (legacy name)
};

// ==========================================
// MATCHING CONFIGURATION
// ==========================================
const CONFIG = {
    // Match expiration - auto-pass if no response in 24 hours
    MATCH_EXPIRATION_HOURS: 24,
    
    // Only show users active within this many days
    ACTIVE_USER_DAYS: 14,
    
    // Maximum profiles to scan per request (pagination for scale)
    MAX_SCAN_LIMIT: 500,
    
    // Geohash precision for location queries (4 = ~40km, 5 = ~5km)
    GEOHASH_PRECISION: 4,
    
    // Rate limiting: max requests per minute per user
    RATE_LIMIT_REQUESTS: 20,
    RATE_LIMIT_WINDOW_SECONDS: 60
};

// GSI name for geohash-based queries (create this GSI on oith-profiles)
const GEOHASH_GSI_NAME = 'geohash-lastSeen-index';

// In-memory rate limit cache (resets on Lambda cold start, but still helps)
const rateLimitCache = new Map();

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
function getNeighbors(geohash) {
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
    const excludeEmails = [...passedIds, ...connectedIds, userEmail.toLowerCase()];
    
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
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                match: null, 
                message: 'No matches found. Try expanding your preferences.',
                stats: {
                    poolSize: potentialMatches.length,
                    excludedCount: excludeEmails.length - 1
                }
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

