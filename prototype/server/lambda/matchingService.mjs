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
    PROFILES: 'oith-profiles',         // Dating user profiles (email as key)
    MATCHES: 'oith-matches',            // Active match pairings
    MATCH_HISTORY: 'oith-match-history', // Pass/accept history
    CONVERSATIONS: 'oith-conversations', // Chat messages
    COMPANY: 'oith-users'               // Company/admin data (legacy name)
};

// CORS headers
const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

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
    
    // 3. Get potential matches from oith-profiles table
    // In production, use GSI with geohash prefix for efficient location query
    const scanResult = await docClient.send(new ScanCommand({
        TableName: TABLES.PROFILES,
        FilterExpression: 'attribute_exists(firstName) AND (attribute_not_exists(isVisible) OR isVisible <> :false)',
        ExpressionAttributeValues: { ':false': false },
        Limit: 100 // Limit for performance
    }));
    
    const potentialMatches = (scanResult.Items || []).filter(user => 
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
    const reverseMatchId = `${matchEmail.toLowerCase()}_${userEmail.toLowerCase()}`;
    const reverseResult = await docClient.send(new GetCommand({
        TableName: TABLES.MATCHES,
        Key: { matchId: reverseMatchId }
    }));
    
    const isMutual = reverseResult.Item?.status === 'accepted';
    
    if (isMutual) {
        console.log(`🎉 MUTUAL MATCH: ${userEmail} <-> ${matchEmail}`);
        
        // Update both users' visibility to hidden in profiles table
        await docClient.send(new UpdateCommand({
            TableName: TABLES.PROFILES,
            Key: { email: userEmail.toLowerCase() },
            UpdateExpression: 'SET isVisible = :false, activeMatchEmail = :match',
            ExpressionAttributeValues: {
                ':false': false,
                ':match': matchEmail.toLowerCase()
            }
        }));
        
        await docClient.send(new UpdateCommand({
            TableName: TABLES.PROFILES,
            Key: { email: matchEmail.toLowerCase() },
            UpdateExpression: 'SET isVisible = :false, activeMatchEmail = :match',
            ExpressionAttributeValues: {
                ':false': false,
                ':match': userEmail.toLowerCase()
            }
        }));
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

