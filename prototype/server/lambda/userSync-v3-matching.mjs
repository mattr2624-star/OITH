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
        
        // ============ SUBSCRIPTION ============
        
        // POST /subscription - Save subscription status
        if (method === 'POST' && path.includes('/subscription')) {
            const body = JSON.parse(event.body || '{}');
            const { email, subscription } = body;
            
            if (!email) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email required' }) };
            }
            
            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    pk: `USER#${email.toLowerCase()}`,
                    sk: 'SUBSCRIPTION',
                    email: email.toLowerCase(),
                    type: subscription?.type || 'free',
                    plan: subscription?.plan || null,
                    status: subscription?.status || 'inactive',
                    startDate: subscription?.startDate || null,
                    nextBillingDate: subscription?.nextBillingDate || null,
                    amount: subscription?.amount || 0,
                    provider: subscription?.provider || null,
                    paymentId: subscription?.paymentId || null,
                    updatedAt: new Date().toISOString()
                }
            }));
            
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }
        
        // GET /subscription/{email} - Get subscription status
        if (method === 'GET' && path.includes('/subscription/')) {
            const email = path.split('/subscription/')[1]?.toLowerCase();
            if (!email) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email required' }) };
            }
            
            const result = await docClient.send(new GetCommand({
                TableName: TABLE_NAME,
                Key: { pk: `USER#${email}`, sk: 'SUBSCRIPTION' }
            }));
            
            return { 
                statusCode: 200, 
                headers, 
                body: JSON.stringify({ subscription: result.Item || { type: 'free', status: 'inactive' } }) 
            };
        }
        
        // ============ EMERGENCY CONTACT ============
        
        // POST /emergency-contact - Save emergency contact
        if (method === 'POST' && path.includes('/emergency-contact')) {
            const body = JSON.parse(event.body || '{}');
            const { email, contact } = body;
            
            if (!email) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email required' }) };
            }
            
            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    pk: `USER#${email.toLowerCase()}`,
                    sk: 'EMERGENCY_CONTACT',
                    email: email.toLowerCase(),
                    contactName: contact?.name || '',
                    contactPhone: contact?.phone || '',
                    contactRelationship: contact?.relationship || '',
                    notifyOnDate: contact?.notifyOnDate !== false,
                    updatedAt: new Date().toISOString()
                }
            }));
            
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }
        
        // GET /emergency-contact/{email} - Get emergency contact
        if (method === 'GET' && path.includes('/emergency-contact/')) {
            const email = path.split('/emergency-contact/')[1]?.toLowerCase();
            if (!email) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email required' }) };
            }
            
            const result = await docClient.send(new GetCommand({
                TableName: TABLE_NAME,
                Key: { pk: `USER#${email}`, sk: 'EMERGENCY_CONTACT' }
            }));
            
            return { 
                statusCode: 200, 
                headers, 
                body: JSON.stringify({ contact: result.Item || null }) 
            };
        }
        
        // ============ USER SETTINGS ============
        
        // POST /settings - Save user settings
        if (method === 'POST' && path.includes('/settings')) {
            const body = JSON.parse(event.body || '{}');
            const { email, settings } = body;
            
            if (!email) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email required' }) };
            }
            
            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    pk: `USER#${email.toLowerCase()}`,
                    sk: 'SETTINGS',
                    email: email.toLowerCase(),
                    notifications: settings?.notifications ?? true,
                    emailNotifications: settings?.emailNotifications ?? true,
                    pushNotifications: settings?.pushNotifications ?? true,
                    showOnlineStatus: settings?.showOnlineStatus ?? true,
                    showLastSeen: settings?.showLastSeen ?? true,
                    darkMode: settings?.darkMode ?? false,
                    language: settings?.language || 'en',
                    updatedAt: new Date().toISOString()
                }
            }));
            
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }
        
        // GET /settings/{email} - Get user settings
        if (method === 'GET' && path.includes('/settings/')) {
            const email = path.split('/settings/')[1]?.toLowerCase();
            if (!email) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email required' }) };
            }
            
            const result = await docClient.send(new GetCommand({
                TableName: TABLE_NAME,
                Key: { pk: `USER#${email}`, sk: 'SETTINGS' }
            }));
            
            return { 
                statusCode: 200, 
                headers, 
                body: JSON.stringify({ settings: result.Item || {} }) 
            };
        }
        
        // ============ USER PHOTOS ============
        
        // POST /photos - Save user photos
        if (method === 'POST' && path.includes('/photos')) {
            const body = JSON.parse(event.body || '{}');
            const { email, photos } = body;
            
            if (!email) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email required' }) };
            }
            
            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    pk: `USER#${email.toLowerCase()}`,
                    sk: 'PHOTOS',
                    email: email.toLowerCase(),
                    photos: photos || [],
                    updatedAt: new Date().toISOString()
                }
            }));
            
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }
        
        // GET /photos/{email} - Get user photos
        if (method === 'GET' && path.includes('/photos/')) {
            const email = path.split('/photos/')[1]?.toLowerCase();
            if (!email) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email required' }) };
            }
            
            const result = await docClient.send(new GetCommand({
                TableName: TABLE_NAME,
                Key: { pk: `USER#${email}`, sk: 'PHOTOS' }
            }));
            
            return { 
                statusCode: 200, 
                headers, 
                body: JSON.stringify({ photos: result.Item?.photos || [] }) 
            };
        }
        
        // ============ FULL USER DATA (for login) ============
        
        // GET /user/{email}/full - Get ALL user data for login restoration
        if (method === 'GET' && path.includes('/user/') && path.includes('/full')) {
            const pathParts = path.split('/');
            const emailIndex = pathParts.indexOf('user') + 1;
            const email = pathParts[emailIndex]?.toLowerCase();
            
            if (!email) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email required' }) };
            }
            
            // Get all items for this user
            const result = await docClient.send(new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: 'pk = :pk',
                ExpressionAttributeValues: { ':pk': `USER#${email}` }
            }));
            
            // Organize data by type
            const userData = {
                email: email,
                profile: null,
                subscription: null,
                emergencyContact: null,
                settings: null,
                photos: []
            };
            
            for (const item of (result.Items || [])) {
                if (item.sk === 'PROFILE') {
                    userData.profile = {
                        firstName: item.firstName,
                        age: item.age,
                        gender: item.gender,
                        location: item.location,
                        occupation: item.occupation,
                        bio: item.bio,
                        photo: item.photo,
                        education: item.education,
                        preferences: item.preferences,
                        isHidden: item.isHidden,
                        lastSeen: item.lastSeen
                    };
                } else if (item.sk === 'SUBSCRIPTION') {
                    userData.subscription = {
                        type: item.type,
                        plan: item.plan,
                        status: item.status,
                        startDate: item.startDate,
                        nextBillingDate: item.nextBillingDate,
                        amount: item.amount,
                        provider: item.provider
                    };
                } else if (item.sk === 'EMERGENCY_CONTACT') {
                    userData.emergencyContact = {
                        name: item.contactName,
                        phone: item.contactPhone,
                        relationship: item.contactRelationship,
                        notifyOnDate: item.notifyOnDate
                    };
                } else if (item.sk === 'SETTINGS') {
                    userData.settings = {
                        notifications: item.notifications,
                        emailNotifications: item.emailNotifications,
                        pushNotifications: item.pushNotifications,
                        showOnlineStatus: item.showOnlineStatus,
                        showLastSeen: item.showLastSeen,
                        darkMode: item.darkMode,
                        language: item.language
                    };
                } else if (item.sk === 'PHOTOS') {
                    userData.photos = item.photos || [];
                }
            }
            
            // Also get matches
            const matchesResult = await docClient.send(new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
                ExpressionAttributeValues: {
                    ':pk': `MATCH#${email}`,
                    ':sk': 'WITH#'
                }
            }));
            
            userData.matches = matchesResult.Items?.map(item => ({
                matchId: item.matchId,
                matchedWith: item.sk.replace('WITH#', ''),
                matchedAt: item.matchedAt
            })) || [];
            
            console.log(`📦 Loaded full user data for ${email}: profile=${!!userData.profile}, subscription=${!!userData.subscription}, matches=${userData.matches.length}`);
            
            return { statusCode: 200, headers, body: JSON.stringify(userData) };
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
        
        // ============ SCHEMA STATS ============
        
        // GET /schema/stats - Get DynamoDB table statistics
        if (method === 'GET' && path.includes('/schema/stats')) {
            console.log('📊 Fetching schema statistics...');
            
            // Scan for all items and count by type
            let lastEvaluatedKey;
            let stats = {
                totalItems: 0,
                // User entities
                profiles: 0,
                likes: 0,
                matches: 0,
                messages: 0,
                subscriptions: 0,
                emergencyContacts: 0,
                settings: 0,
                configs: 0,
                // Feedback entities
                feedback: 0,
                ratings: 0,
                reports: 0,
                // Activity entities
                activityEvents: 0,
                sessions: 0,
                dailyMetrics: 0,
                // Company entities
                employees: 0,
                departments: 0,
                companyMetrics: 0,
                investors: 0
            };
            
            do {
                const scanResult = await docClient.send(new ScanCommand({
                    TableName: TABLE_NAME,
                    ProjectionExpression: 'pk, sk',
                    ExclusiveStartKey: lastEvaluatedKey
                }));
                
                scanResult.Items?.forEach(item => {
                    stats.totalItems++;
                    
                    // User entities
                    if (item.pk.startsWith('USER#') && item.sk === 'PROFILE') stats.profiles++;
                    else if (item.pk.startsWith('LIKE#')) stats.likes++;
                    else if (item.pk.startsWith('MATCH#')) stats.matches++;
                    else if (item.pk.startsWith('CHAT#')) stats.messages++;
                    else if (item.pk.startsWith('USER#') && item.sk === 'SUBSCRIPTION') stats.subscriptions++;
                    else if (item.pk.startsWith('USER#') && item.sk === 'EMERGENCY_CONTACT') stats.emergencyContacts++;
                    else if (item.pk.startsWith('USER#') && item.sk === 'SETTINGS') stats.settings++;
                    else if (item.pk === 'CONFIG') stats.configs++;
                    // Feedback entities
                    else if (item.pk.startsWith('FEEDBACK#')) stats.feedback++;
                    else if (item.pk.startsWith('RATING#')) stats.ratings++;
                    else if (item.pk.startsWith('REPORT#')) stats.reports++;
                    // Activity entities
                    else if (item.pk.startsWith('ACTIVITY#')) stats.activityEvents++;
                    else if (item.pk.startsWith('SESSION#')) stats.sessions++;
                    else if (item.pk.startsWith('METRICS#')) stats.dailyMetrics++;
                    // Company entities
                    else if (item.pk === 'ORG#employee') stats.employees++;
                    else if (item.pk === 'ORG#department') stats.departments++;
                    else if (item.pk === 'ORG#metrics') stats.companyMetrics++;
                    else if (item.pk === 'ORG#investor') stats.investors++;
                });
                
                lastEvaluatedKey = scanResult.LastEvaluatedKey;
            } while (lastEvaluatedKey);
            
            console.log('📊 Schema stats:', stats);
            return { statusCode: 200, headers, body: JSON.stringify(stats) };
        }
        
        // ============ ML SETTINGS ============
        
        // POST /ml-settings - Save ML model settings
        if (method === 'POST' && path.includes('/ml-settings')) {
            const body = JSON.parse(event.body || '{}');
            const { type, settings } = body;
            
            if (!type || !settings) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Type and settings required' }) };
            }
            
            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    pk: 'CONFIG',
                    sk: `ML#${type}`,
                    type: type,
                    settings: settings,
                    updatedAt: new Date().toISOString(),
                    updatedBy: body.updatedBy || 'admin'
                }
            }));
            
            console.log(`⚙️ ML settings saved: ${type}`);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, type }) };
        }
        
        // GET /ml-settings/{type} - Get ML model settings
        if (method === 'GET' && path.includes('/ml-settings/')) {
            const type = path.split('/ml-settings/')[1];
            if (!type) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Type required' }) };
            }
            
            const result = await docClient.send(new GetCommand({
                TableName: TABLE_NAME,
                Key: { pk: 'CONFIG', sk: `ML#${type}` }
            }));
            
            if (result.Item) {
                return { statusCode: 200, headers, body: JSON.stringify({ settings: result.Item.settings, updatedAt: result.Item.updatedAt }) };
            }
            
            return { statusCode: 200, headers, body: JSON.stringify({ settings: null }) };
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

