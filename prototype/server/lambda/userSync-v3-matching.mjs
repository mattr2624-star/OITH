/**
 * AWS Lambda Function for OITH - User Profiles + Matching
 * Handles: profiles, likes, matches, and chat
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, QueryCommand, DeleteCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMODB_TABLE || 'oith-users';

export const handler = async (event) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': '*'
    };
    
    const method = event.httpMethod || event.requestContext?.http?.method;
    const path = event.path || event.rawPath || '';
    
    if (method === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    try {
        // ============ USER PROFILES ============
        
        // POST /users - Save user profile
        if (method === 'POST' && path.endsWith('/users')) {
            const body = JSON.parse(event.body || '{}');
            const { email, name, userData } = body;
            if (!email) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email required' }) };
            
            const user = userData?.user || {};
            const prefs = user.preferences || user.matchPreferences || {};
            
            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    pk: `USER#${email.toLowerCase()}`,
                    sk: 'PROFILE',
                    email: email.toLowerCase(),
                    firstName: user.firstName || name || '',
                    age: user.age || null,
                    gender: user.gender || '',
                    location: user.location || '',
                    occupation: user.occupation || '',
                    bio: (user.bio || '').substring(0, 300),
                    photo: user.photo || '',
                    education: user.education || '',
                    // Preferences for auto-matching
                    preferences: {
                        interestedIn: prefs.interestedIn || 'everyone',
                        ageMin: prefs.ageMin || 18,
                        ageMax: prefs.ageMax || 99,
                        maxDistance: prefs.maxDistance || 100
                    },
                    online: true,
                    isHidden: false,
                    lastSeen: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            }));
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, email }) };
        }
        
        // GET /users - Get all VISIBLE users (not hidden/matched)
        if (method === 'GET' && path.endsWith('/users')) {
            const result = await docClient.send(new ScanCommand({ 
                TableName: TABLE_NAME,
                FilterExpression: 'sk = :sk AND (attribute_not_exists(isHidden) OR isHidden = :false)',
                ExpressionAttributeValues: { ':sk': 'PROFILE', ':false': false }
            }));
            
            const users = {};
            result.Items?.forEach(item => {
                if (item.email) {
                    users[item.email] = {
                        firstName: item.firstName,
                        age: item.age,
                        gender: item.gender,
                        location: item.location,
                        occupation: item.occupation,
                        photo: item.photo,
                        online: item.online,
                        isHidden: item.isHidden || false,
                        lastSeen: item.lastSeen
                    };
                }
            });
            console.log(`📊 Returning ${Object.keys(users).length} visible users`);
            return { statusCode: 200, headers, body: JSON.stringify(users) };
        }
        
        // DELETE /users/clear - Clear ALL items from DynamoDB (users, likes, matches, chats)
        if (method === 'DELETE' && path.includes('/users/clear')) {
            console.log('🗑️ Clearing ALL items from DynamoDB...');
            
            // Scan for ALL items (no filter)
            const result = await docClient.send(new ScanCommand({ 
                TableName: TABLE_NAME
            }));
            
            // Delete each one
            let deleted = 0;
            for (const item of (result.Items || [])) {
                await docClient.send(new DeleteCommand({
                    TableName: TABLE_NAME,
                    Key: { pk: item.pk, sk: item.sk }
                }));
                deleted++;
            }
            
            console.log(`🗑️ Deleted ${deleted} items (users, likes, matches, chats)`);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, deleted }) };
        }
        
        // POST /users/bulk - Bulk upload users (replaces all)
        if (method === 'POST' && path.includes('/users/bulk')) {
            const body = JSON.parse(event.body || '{}');
            const users = body.users || [];
            
            console.log(`📤 Bulk uploading ${users.length} users...`);
            
            let count = 0;
            for (const user of users) {
                if (!user.email) continue;
                
                await docClient.send(new PutCommand({
                    TableName: TABLE_NAME,
                    Item: {
                        pk: `USER#${user.email.toLowerCase()}`,
                        sk: 'PROFILE',
                        email: user.email.toLowerCase(),
                        firstName: user.firstName || user.name || '',
                        age: user.age || null,
                        gender: user.gender || '',
                        location: user.location || '',
                        occupation: user.occupation || '',
                        photo: user.photo || '',
                        education: user.education || '',
                        updatedAt: new Date().toISOString()
                    }
                }));
                count++;
            }
            
            console.log(`✅ Uploaded ${count} users`);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, count }) };
        }
        
        // ============ LIKES & MATCHING ============
        
        // POST /like - User likes another user
        if (method === 'POST' && path.includes('/like')) {
            const body = JSON.parse(event.body || '{}');
            const { fromEmail, toEmail } = body;
            
            if (!fromEmail || !toEmail) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'fromEmail and toEmail required' }) };
            }
            
            const from = fromEmail.toLowerCase();
            const to = toEmail.toLowerCase();
            const timestamp = new Date().toISOString();
            
            // Record the like
            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    pk: `LIKE#${from}`,
                    sk: `TO#${to}`,
                    fromEmail: from,
                    toEmail: to,
                    createdAt: timestamp
                }
            }));
            
            // Check if the other person already liked this user (mutual match!)
            const checkMutual = await docClient.send(new GetCommand({
                TableName: TABLE_NAME,
                Key: { pk: `LIKE#${to}`, sk: `TO#${from}` }
            }));
            
            const isMatch = !!checkMutual.Item;
            
            if (isMatch) {
                // Create match record for both users
                const matchId = `${[from, to].sort().join('_')}`;
                
                await docClient.send(new PutCommand({
                    TableName: TABLE_NAME,
                    Item: {
                        pk: `MATCH#${from}`,
                        sk: `WITH#${to}`,
                        matchId: matchId,
                        user1: from,
                        user2: to,
                        matchedAt: timestamp
                    }
                }));
                
                await docClient.send(new PutCommand({
                    TableName: TABLE_NAME,
                    Item: {
                        pk: `MATCH#${to}`,
                        sk: `WITH#${from}`,
                        matchId: matchId,
                        user1: from,
                        user2: to,
                        matchedAt: timestamp
                    }
                }));
                
                console.log(`💕 MATCH! ${from} <-> ${to}`);
            }
            
            return { 
                statusCode: 200, 
                headers, 
                body: JSON.stringify({ success: true, isMatch, fromEmail: from, toEmail: to }) 
            };
        }
        
        // GET /matches/{email} - Get all matches for a user
        if (method === 'GET' && path.includes('/matches/')) {
            const email = path.split('/matches/')[1]?.toLowerCase();
            if (!email) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email required' }) };
            }
            
            const result = await docClient.send(new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
                ExpressionAttributeValues: {
                    ':pk': `MATCH#${email}`,
                    ':sk': 'WITH#'
                }
            }));
            
            const matches = result.Items?.map(item => ({
                matchId: item.matchId,
                matchedWith: item.sk.replace('WITH#', ''),
                matchedAt: item.matchedAt
            })) || [];
            
            return { statusCode: 200, headers, body: JSON.stringify({ matches }) };
        }
        
        // ============ CHAT MESSAGES ============
        
        // POST /chat - Send a message
        if (method === 'POST' && path.includes('/chat')) {
            const body = JSON.parse(event.body || '{}');
            const { matchId, fromEmail, message } = body;
            
            if (!matchId || !fromEmail || !message) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'matchId, fromEmail, and message required' }) };
            }
            
            const timestamp = new Date().toISOString();
            const messageId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    pk: `CHAT#${matchId}`,
                    sk: `MSG#${timestamp}#${messageId}`,
                    matchId: matchId,
                    fromEmail: fromEmail.toLowerCase(),
                    message: message.substring(0, 1000),
                    createdAt: timestamp
                }
            }));
            
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, messageId }) };
        }
        
        // GET /chat/{matchId} - Get messages for a match
        if (method === 'GET' && path.includes('/chat/')) {
            const matchId = path.split('/chat/')[1];
            if (!matchId) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'matchId required' }) };
            }
            
            const result = await docClient.send(new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
                ExpressionAttributeValues: {
                    ':pk': `CHAT#${matchId}`,
                    ':sk': 'MSG#'
                },
                ScanIndexForward: true // oldest first
            }));
            
            const messages = result.Items?.map(item => ({
                fromEmail: item.fromEmail,
                message: item.message,
                createdAt: item.createdAt
            })) || [];
            
            return { statusCode: 200, headers, body: JSON.stringify({ messages }) };
        }
        
        // POST /match/auto - Automatic matching service
        // Finds mutual preference matches and creates matches automatically
        if (method === 'POST' && path.includes('/match/auto')) {
            const body = JSON.parse(event.body || '{}');
            const { email } = body;
            
            if (!email) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email required' }) };
            }
            
            const userEmail = email.toLowerCase();
            console.log(`🔍 Running auto-match for ${userEmail}...`);
            
            // Get the user's profile
            const userResult = await docClient.send(new GetCommand({
                TableName: TABLE_NAME,
                Key: { pk: `USER#${userEmail}`, sk: 'PROFILE' }
            }));
            
            if (!userResult.Item) {
                return { statusCode: 404, headers, body: JSON.stringify({ error: 'User not found' }) };
            }
            
            const currentUser = userResult.Item;
            const userPrefs = currentUser.preferences || {};
            
            // Check if current user is hidden (already matched)
            if (currentUser.isHidden === true) {
                console.log(`⚠️ User ${userEmail} is already hidden (matched) - skipping auto-match`);
                return { 
                    statusCode: 200, 
                    headers, 
                    body: JSON.stringify({ 
                        success: true, 
                        email: userEmail,
                        message: 'User already matched - profile hidden',
                        newMatches: [],
                        matchCount: 0
                    }) 
                };
            }
            
            // Get all other VISIBLE users only (not hidden)
            const allUsersResult = await docClient.send(new ScanCommand({
                TableName: TABLE_NAME,
                FilterExpression: 'sk = :sk AND email <> :email AND (attribute_not_exists(isHidden) OR isHidden = :false)',
                ExpressionAttributeValues: { 
                    ':sk': 'PROFILE', 
                    ':email': userEmail,
                    ':false': false
                }
            }));
            
            console.log(`🔍 Found ${allUsersResult.Items?.length || 0} visible profiles to check`);
            
            const matches = [];
            
            for (const otherUser of (allUsersResult.Items || [])) {
                const otherPrefs = otherUser.preferences || {};
                
                // Check if current user fits other user's preferences
                const currentFitsOther = checkPreferenceMatch(currentUser, otherPrefs);
                
                // Check if other user fits current user's preferences
                const otherFitsCurrent = checkPreferenceMatch(otherUser, userPrefs);
                
                console.log(`Checking ${otherUser.email}: currentFitsOther=${currentFitsOther}, otherFitsCurrent=${otherFitsCurrent}`);
                
                // If MUTUAL preference match, create a match!
                if (currentFitsOther && otherFitsCurrent) {
                    const matchId = [userEmail, otherUser.email].sort().join('_');
                    const timestamp = new Date().toISOString();
                    
                    // Check if already matched
                    const existingMatch = await docClient.send(new GetCommand({
                        TableName: TABLE_NAME,
                        Key: { pk: `MATCH#${userEmail}`, sk: `WITH#${otherUser.email}` }
                    }));
                    
                    if (!existingMatch.Item) {
                        // Create match records for both users
                        await docClient.send(new PutCommand({
                            TableName: TABLE_NAME,
                            Item: {
                                pk: `MATCH#${userEmail}`,
                                sk: `WITH#${otherUser.email}`,
                                matchId: matchId,
                                matchedAt: timestamp,
                                autoMatched: true
                            }
                        }));
                        
                        await docClient.send(new PutCommand({
                            TableName: TABLE_NAME,
                            Item: {
                                pk: `MATCH#${otherUser.email}`,
                                sk: `WITH#${userEmail}`,
                                matchId: matchId,
                                matchedAt: timestamp,
                                autoMatched: true
                            }
                        }));
                        
                        // Hide BOTH profiles
                        await docClient.send(new PutCommand({
                            TableName: TABLE_NAME,
                            Item: { ...currentUser, isHidden: true, hiddenAt: timestamp, hiddenReason: 'matched' }
                        }));
                        
                        await docClient.send(new PutCommand({
                            TableName: TABLE_NAME,
                            Item: { ...otherUser, isHidden: true, hiddenAt: timestamp, hiddenReason: 'matched' }
                        }));
                        
                        matches.push({
                            matchId: matchId,
                            matchedWith: otherUser.email,
                            matchedWithName: otherUser.firstName || otherUser.name,
                            matchedAt: timestamp
                        });
                        
                        console.log(`💕 AUTO-MATCH: ${userEmail} <-> ${otherUser.email}`);
                    }
                }
            }
            
            return { 
                statusCode: 200, 
                headers, 
                body: JSON.stringify({ 
                    success: true, 
                    email: userEmail,
                    newMatches: matches,
                    matchCount: matches.length
                }) 
            };
        }
        
        // Health check
        return { statusCode: 200, headers, body: JSON.stringify({ status: 'ok' }) };
        
    } catch (error) {
        console.error('Error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};

// Helper function to check if a user matches preferences
function checkPreferenceMatch(user, prefs) {
    // If no preferences set, accept everyone
    if (!prefs || Object.keys(prefs).length === 0) return true;
    
    // Age check
    const userAge = user.age || 25;
    const minAge = prefs.ageMin || 18;
    const maxAge = prefs.ageMax || 99;
    if (userAge < minAge || userAge > maxAge) return false;
    
    // Gender check
    const interestedIn = (prefs.interestedIn || 'everyone').toLowerCase();
    if (interestedIn !== 'everyone') {
        const userGender = (user.gender || '').toLowerCase();
        const isFemale = ['female', 'woman', 'women', 'f'].includes(userGender);
        const isMale = ['male', 'man', 'men', 'm'].includes(userGender);
        
        if (interestedIn === 'women' && !isFemale) return false;
        if (interestedIn === 'men' && !isMale) return false;
    }
    
    // Distance check (if both have locations)
    // For now, skip distance - would need geocoding
    
    return true;
}

