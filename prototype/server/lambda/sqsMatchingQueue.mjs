/**
 * OITH SQS Matching Queue Processor
 * 
 * Addresses stress test issue:
 * 🟡 High Concurrency During Peak Hours (50 concurrent requests)
 * 
 * Solution:
 * - Async processing via SQS FIFO queue
 * - Batch processing for efficiency
 * - Dead letter queue for failed messages
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SQSClient, SendMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';

// Initialize clients
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Configuration
const CONFIG = {
    USERS_TABLE: process.env.USERS_TABLE || 'oith-users',
    MATCHES_TABLE: process.env.MATCHES_TABLE || 'oith-matches',
    QUEUE_URL: process.env.MATCHING_QUEUE_URL,
    DLQ_URL: process.env.MATCHING_DLQ_URL,
    MAX_BATCH_SIZE: 10,
    VISIBILITY_TIMEOUT: 60  // seconds
};

/**
 * Lambda handler for SQS trigger
 * Processes matching requests from the queue
 */
export const handler = async (event) => {
    console.log(`Processing ${event.Records.length} matching requests`);
    
    const results = {
        successful: 0,
        failed: 0,
        batchItemFailures: []  // For partial batch response
    };
    
    for (const record of event.Records) {
        try {
            const request = JSON.parse(record.body);
            await processMatchRequest(request);
            results.successful++;
        } catch (error) {
            console.error('Failed to process record:', error);
            results.failed++;
            
            // Report failure for partial batch response
            results.batchItemFailures.push({
                itemIdentifier: record.messageId
            });
        }
    }
    
    console.log(`Processed: ${results.successful} successful, ${results.failed} failed`);
    
    // Return partial batch response (SQS will retry failed items)
    return {
        batchItemFailures: results.batchItemFailures
    };
};

/**
 * Process a single match request
 */
async function processMatchRequest(request) {
    const { userEmail, action, timestamp } = request;
    
    switch (action) {
        case 'FIND_NEXT_MATCH':
            return await findNextMatch(userEmail);
        
        case 'ACCEPT_MATCH':
            return await acceptMatch(userEmail, request.matchEmail);
        
        case 'PASS_MATCH':
            return await passMatch(userEmail, request.matchEmail);
        
        case 'COMPUTE_COMPATIBILITY':
            return await computeCompatibilityBatch(userEmail, request.candidates);
        
        default:
            throw new Error(`Unknown action: ${action}`);
    }
}

/**
 * Find next match for user with pagination
 */
async function findNextMatch(userEmail) {
    // Get user profile
    const user = await getUserProfile(userEmail);
    if (!user) {
        throw new Error(`User not found: ${userEmail}`);
    }
    
    // Get candidates with pagination
    const candidates = [];
    let lastKey = null;
    const batchSize = 100;
    
    do {
        const batch = await getCandidateBatch(user, lastKey, batchSize);
        candidates.push(...batch.items);
        lastKey = batch.lastKey;
        
        // Stop if we have enough candidates or no more data
        if (candidates.length >= 500 || !lastKey) break;
    } while (lastKey);
    
    // Score and rank candidates
    const scored = candidates.map(candidate => ({
        ...candidate,
        score: calculateCompatibility(user, candidate)
    }));
    
    // Sort by score and get best match not already seen
    scored.sort((a, b) => b.score - a.score);
    
    const seenEmails = await getSeenMatches(userEmail);
    const nextMatch = scored.find(c => !seenEmails.has(c.email));
    
    if (nextMatch) {
        // Store as presented match
        await recordMatchPresented(userEmail, nextMatch);
    }
    
    return nextMatch;
}

/**
 * Get candidates in batches (pagination)
 */
async function getCandidateBatch(user, lastKey, limit) {
    const prefs = user.matchPreferences || {};
    const geohash = user.geohash_prefix;
    
    const params = {
        TableName: CONFIG.USERS_TABLE,
        IndexName: 'gender-geohash-index',
        KeyConditionExpression: 'gender = :gender AND begins_with(geohash_prefix, :geo)',
        FilterExpression: 'email <> :userEmail AND isVisible = :visible',
        ExpressionAttributeValues: {
            ':gender': prefs.interestedIn || 'any',
            ':geo': geohash.substring(0, 3),
            ':userEmail': user.email,
            ':visible': true
        },
        Limit: limit,
        ProjectionExpression: 'email, firstName, age, gender, coordinates, photos, matchPreferences'
    };
    
    if (lastKey) {
        params.ExclusiveStartKey = lastKey;
    }
    
    const response = await docClient.send(new QueryCommand(params));
    
    return {
        items: response.Items || [],
        lastKey: response.LastEvaluatedKey
    };
}

/**
 * Get user profile
 */
async function getUserProfile(email) {
    const response = await docClient.send(new GetCommand({
        TableName: CONFIG.USERS_TABLE,
        Key: { email }
    }));
    
    return response.Item;
}

/**
 * Get set of already seen matches
 */
async function getSeenMatches(userEmail) {
    const response = await docClient.send(new QueryCommand({
        TableName: CONFIG.MATCHES_TABLE,
        KeyConditionExpression: 'userEmail = :email',
        ProjectionExpression: 'matchEmail',
        ExpressionAttributeValues: {
            ':email': userEmail
        }
    }));
    
    return new Set((response.Items || []).map(item => item.matchEmail));
}

/**
 * Calculate compatibility score between two users
 */
function calculateCompatibility(user, candidate) {
    let score = 50; // Base score
    
    const userPrefs = user.matchPreferences || {};
    const candidatePrefs = candidate.matchPreferences || {};
    
    // Age compatibility
    if (userPrefs.ageRange) {
        const age = candidate.age;
        if (age >= userPrefs.ageRange[0] && age <= userPrefs.ageRange[1]) {
            score += 15;
        } else {
            score -= 10;
        }
    }
    
    // Distance
    if (user.coordinates && candidate.coordinates) {
        const distance = calculateDistance(user.coordinates, candidate.coordinates);
        if (distance < 10) score += 20;
        else if (distance < 25) score += 15;
        else if (distance < 50) score += 10;
        else if (distance > 100) score -= 15;
    }
    
    // Mutual interest (candidate also interested in user's gender)
    if (candidatePrefs.interestedIn === user.gender || candidatePrefs.interestedIn === 'any') {
        score += 10;
    }
    
    // Profile completeness
    if (candidate.photos && candidate.photos.length > 0) score += 5;
    if (candidate.bio) score += 5;
    
    return Math.max(0, Math.min(100, score));
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(coord1, coord2) {
    const R = 3959; // Earth's radius in miles
    const dLat = toRad(coord2.lat - coord1.lat);
    const dLon = toRad(coord2.lng - coord1.lng);
    const lat1 = toRad(coord1.lat);
    const lat2 = toRad(coord2.lat);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
}

function toRad(deg) {
    return deg * Math.PI / 180;
}

/**
 * Record that a match was presented to user
 */
async function recordMatchPresented(userEmail, match) {
    await docClient.send(new UpdateCommand({
        TableName: CONFIG.MATCHES_TABLE,
        Key: {
            matchId: `${userEmail}_${match.email}`
        },
        UpdateExpression: 'SET userEmail = :user, matchEmail = :match, #status = :status, presentedAt = :time, compatibility = :score',
        ExpressionAttributeNames: {
            '#status': 'status'
        },
        ExpressionAttributeValues: {
            ':user': userEmail,
            ':match': match.email,
            ':status': 'presented',
            ':time': new Date().toISOString(),
            ':score': match.score
        }
    }));
}

/**
 * Accept a match
 */
async function acceptMatch(userEmail, matchEmail) {
    await docClient.send(new UpdateCommand({
        TableName: CONFIG.MATCHES_TABLE,
        Key: {
            matchId: `${userEmail}_${matchEmail}`
        },
        UpdateExpression: 'SET #status = :status, acceptedAt = :time',
        ExpressionAttributeNames: {
            '#status': 'status'
        },
        ExpressionAttributeValues: {
            ':status': 'accepted',
            ':time': new Date().toISOString()
        }
    }));
    
    // Check if mutual match
    const reverseMatch = await docClient.send(new GetCommand({
        TableName: CONFIG.MATCHES_TABLE,
        Key: {
            matchId: `${matchEmail}_${userEmail}`
        }
    }));
    
    if (reverseMatch.Item && reverseMatch.Item.status === 'accepted') {
        // Mutual match! Update both users
        await createMutualMatch(userEmail, matchEmail);
    }
    
    return { success: true, mutual: reverseMatch.Item?.status === 'accepted' };
}

/**
 * Pass on a match
 */
async function passMatch(userEmail, matchEmail) {
    await docClient.send(new UpdateCommand({
        TableName: CONFIG.MATCHES_TABLE,
        Key: {
            matchId: `${userEmail}_${matchEmail}`
        },
        UpdateExpression: 'SET #status = :status, passedAt = :time',
        ExpressionAttributeNames: {
            '#status': 'status'
        },
        ExpressionAttributeValues: {
            ':status': 'passed',
            ':time': new Date().toISOString()
        }
    }));
    
    return { success: true };
}

/**
 * Create mutual match between two users
 */
async function createMutualMatch(email1, email2) {
    const timestamp = new Date().toISOString();
    
    // Update both users with active match
    await Promise.all([
        docClient.send(new UpdateCommand({
            TableName: CONFIG.USERS_TABLE,
            Key: { email: email1 },
            UpdateExpression: 'SET activeMatchEmail = :match, matchedAt = :time',
            ExpressionAttributeValues: {
                ':match': email2,
                ':time': timestamp
            }
        })),
        docClient.send(new UpdateCommand({
            TableName: CONFIG.USERS_TABLE,
            Key: { email: email2 },
            UpdateExpression: 'SET activeMatchEmail = :match, matchedAt = :time',
            ExpressionAttributeValues: {
                ':match': email1,
                ':time': timestamp
            }
        }))
    ]);
}

/**
 * Compute compatibility for a batch of candidates
 * Used for pre-computation jobs
 */
async function computeCompatibilityBatch(userEmail, candidateEmails) {
    const user = await getUserProfile(userEmail);
    if (!user) return [];
    
    const results = [];
    
    for (const email of candidateEmails) {
        const candidate = await getUserProfile(email);
        if (candidate) {
            results.push({
                email,
                score: calculateCompatibility(user, candidate)
            });
        }
    }
    
    return results;
}

// ==========================================
// QUEUE HELPER FUNCTIONS
// ==========================================

/**
 * Send a matching request to the queue
 */
export async function enqueueMatchRequest(request) {
    const messageBody = JSON.stringify({
        ...request,
        timestamp: Date.now()
    });
    
    await sqsClient.send(new SendMessageCommand({
        QueueUrl: CONFIG.QUEUE_URL,
        MessageBody: messageBody,
        MessageGroupId: request.userEmail,  // FIFO grouping by user
        MessageDeduplicationId: `${request.userEmail}-${request.action}-${Date.now()}`
    }));
}

/**
 * Dead letter queue processor
 * Handles failed messages for investigation
 */
export const dlqHandler = async (event) => {
    console.log(`Processing ${event.Records.length} failed messages from DLQ`);
    
    for (const record of event.Records) {
        const message = JSON.parse(record.body);
        
        // Log for investigation
        console.error('Failed message:', {
            messageId: record.messageId,
            request: message,
            receiveCount: record.attributes.ApproximateReceiveCount,
            firstReceiveTime: record.attributes.ApproximateFirstReceiveTimestamp
        });
        
        // Optionally: Store in error tracking table
        // await storeFailedRequest(message);
        
        // Optionally: Send alert
        // await sendAlert('Matching request failed', message);
    }
};

