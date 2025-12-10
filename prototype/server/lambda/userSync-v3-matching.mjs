/**
 * AWS Lambda Function for OITH - User Profiles + Matching
 * Handles: profiles, likes, matches, and chat
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, QueryCommand, DeleteCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Table configuration - split by domain
const TABLES = {
    PROFILES: 'oith-profiles',           // Dating user profiles (email as key)
    MATCHES: 'oith-matches',              // Active match pairings  
    MATCH_HISTORY: 'oith-match-history',  // Pass/accept history
    CONVERSATIONS: 'oith-conversations',  // Chat messages
    COMPANY: 'oith-users'                 // Company/admin data (legacy)
};

// Legacy table name for backward compatibility
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
        
        // POST /users - Save user profile to oith-profiles table
        if (method === 'POST' && path.endsWith('/users')) {
            const body = JSON.parse(event.body || '{}');
            const { email, name, userData } = body;
            if (!email) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email required' }) };
            
            const user = userData?.user || {};
            const prefs = user.preferences || user.matchPreferences || {};
            
            // Write to NEW oith-profiles table (simple email key)
            await docClient.send(new PutCommand({
                TableName: TABLES.PROFILES,
                Item: {
                    email: email.toLowerCase(),
                    firstName: user.firstName || name || '',
                    age: user.age || null,
                    gender: user.gender || '',
                    location: user.location || '',
                    coordinates: user.coordinates || null,
                    occupation: user.occupation || '',
                    bio: (user.bio || '').substring(0, 300),
                    photo: user.photo || '',
                    photos: user.photos || [],
                    education: user.education || '',
                    height: user.height || '',
                    bodyType: user.bodyType || '',
                    drinking: user.drinking || '',
                    smoking: user.smoking || '',
                    exercise: user.exercise || '',
                    children: user.children || '',
                    religion: user.religion || '',
                    politics: user.politics || '',
                    interests: user.interests || [],
                    lookingFor: user.lookingFor || 'relationship',
                    // Preferences for matching algorithm
                    matchPreferences: {
                        interestedIn: prefs.interestedIn || 'everyone',
                        ageMin: prefs.ageMin || 18,
                        ageMax: prefs.ageMax || 99,
                        maxDistance: prefs.maxDistance || 100,
                        bodyType: prefs.bodyType || [],
                        smoking: prefs.smoking || [],
                        drinking: prefs.drinking || [],
                        religion: prefs.religion || '',
                        children: prefs.children || ''
                    },
                    // Visibility for matching pool
                    isVisible: true,
                    online: true,
                    lastSeen: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            }));
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, email, table: 'oith-profiles' }) };
        }
        
        // GET /users - Get all VISIBLE users with FULL data from oith-profiles
        if (method === 'GET' && path.endsWith('/users')) {
            // Get all profiles from new profiles table
            const profileResult = await docClient.send(new ScanCommand({ 
                TableName: TABLES.PROFILES,
                FilterExpression: 'attribute_not_exists(isVisible) OR isVisible = :true',
                ExpressionAttributeValues: { ':true': true }
            }));
            
            // Get all subscriptions
            const subResult = await docClient.send(new ScanCommand({ 
                TableName: TABLE_NAME,
                FilterExpression: 'sk = :sk',
                ExpressionAttributeValues: { ':sk': 'SUBSCRIPTION' }
            }));
            
            // Get all matches
            const matchResult = await docClient.send(new ScanCommand({ 
                TableName: TABLE_NAME,
                FilterExpression: 'begins_with(pk, :pk)',
                ExpressionAttributeValues: { ':pk': 'MATCH#' }
            }));
            
            // Get all activity data
            const activityResult = await docClient.send(new ScanCommand({ 
                TableName: TABLE_NAME,
                FilterExpression: 'sk = :sk',
                ExpressionAttributeValues: { ':sk': 'ACTIVITY' }
            }));
            
            // Get all emergency contacts
            const emergencyResult = await docClient.send(new ScanCommand({ 
                TableName: TABLE_NAME,
                FilterExpression: 'sk = :sk',
                ExpressionAttributeValues: { ':sk': 'EMERGENCY_CONTACT' }
            }));
            
            // Get all billing history
            const billingResult = await docClient.send(new ScanCommand({ 
                TableName: TABLE_NAME,
                FilterExpression: 'sk = :sk',
                ExpressionAttributeValues: { ':sk': 'BILLING_HISTORY' }
            }));
            
            // Get all conversations
            const chatResult = await docClient.send(new ScanCommand({ 
                TableName: TABLE_NAME,
                FilterExpression: 'begins_with(pk, :pk)',
                ExpressionAttributeValues: { ':pk': 'CHAT#' }
            }));
            
            // Build subscription lookup by email
            const subscriptions = {};
            subResult.Items?.forEach(item => {
                const email = item.pk.replace('USER#', '');
                subscriptions[email] = {
                    type: item.plan || item.type || 'free',
                    status: item.status || 'active',
                    startDate: item.startDate,
                    endDate: item.endDate,
                    nextBillingDate: item.nextBillingDate,
                    amount: item.amount,
                    canceledAt: item.canceledAt
                };
            });
            
            // Build match history lookup by email
            const matchHistory = {};
            matchResult.Items?.forEach(item => {
                const email = item.pk.replace('MATCH#', '');
                if (!matchHistory[email]) matchHistory[email] = [];
                matchHistory[email].push({
                    matchId: item.matchId,
                    matchedWith: item.sk.replace('WITH#', ''),
                    matchedAt: item.matchedAt,
                    user1: item.user1,
                    user2: item.user2
                });
            });
            
            // Build activity lookup by email
            const activities = {};
            activityResult.Items?.forEach(item => {
                const email = item.pk.replace('USER#', '');
                activities[email] = {
                    isLoggedIn: item.isLoggedIn || false,
                    lastSeen: item.lastSeen,
                    lastLoginAt: item.lastLoginAt,
                    loginCount: item.loginCount || 0,
                    totalTimeSpent: item.totalTimeSpent || 0
                };
            });
            
            // Build emergency contact lookup by email
            const emergencyContacts = {};
            emergencyResult.Items?.forEach(item => {
                const email = item.pk.replace('USER#', '');
                emergencyContacts[email] = {
                    name: item.contactName,
                    phone: item.contactPhone,
                    relationship: item.relationship,
                    updatedAt: item.updatedAt
                };
            });
            
            // Build billing history lookup by email
            const billingHistories = {};
            billingResult.Items?.forEach(item => {
                const email = item.pk.replace('USER#', '');
                billingHistories[email] = item.transactions || [];
            });
            
            // Build conversation lookup by email
            const conversations = {};
            chatResult.Items?.forEach(item => {
                // CHAT#email1_email2 format
                const chatId = item.pk.replace('CHAT#', '');
                const emails = chatId.split('_');
                emails.forEach(email => {
                    if (!conversations[email]) conversations[email] = {};
                    const otherEmail = emails.find(e => e !== email);
                    if (otherEmail) {
                        conversations[email][otherEmail] = {
                            messages: item.messages || [],
                            lastMessageAt: item.lastMessageAt,
                            messageCount: (item.messages || []).length
                        };
                    }
                });
            });
            
            const users = {};
            profileResult.Items?.forEach(item => {
                if (item.email) {
                    const email = item.email;
                    const activity = activities[email] || {};
                    const userMatches = matchHistory[email] || [];
                    const userConversations = conversations[email] || {};
                    
                    // Calculate total messages
                    let totalMessages = 0;
                    Object.values(userConversations).forEach(conv => {
                        totalMessages += conv.messageCount || 0;
                    });
                    
                    users[email] = {
                        // Basic profile
                        firstName: item.firstName,
                        age: item.age,
                        gender: item.gender,
                        location: item.location,
                        coordinates: item.coordinates || null,
                        occupation: item.occupation,
                        photo: item.photo,
                        photos: item.photos || [],
                        bio: item.bio,
                        education: item.education,
                        // Lifestyle fields
                        height: item.height || '',
                        bodyType: item.bodyType || '',
                        drinking: item.drinking || '',
                        smoking: item.smoking || '',
                        exercise: item.exercise || '',
                        children: item.children || '',
                        religion: item.religion || '',
                        politics: item.politics || '',
                        interests: item.interests || [],
                        // Activity status
                        online: activity.isLoggedIn || item.online || false,
                        isLoggedIn: activity.isLoggedIn || false,
                        isHidden: item.isHidden || false,
                        lastSeen: activity.lastSeen || item.lastSeen,
                        lastLoginAt: activity.lastLoginAt,
                        loginCount: activity.loginCount || 0,
                        registeredAt: item.createdAt || item.updatedAt,
                        // Subscription data
                        subscription: subscriptions[email] || null,
                        // Match history
                        matchHistory: userMatches,
                        matchCount: userMatches.length,
                        // Active connection (most recent match)
                        activeConnection: userMatches.length > 0 ? userMatches[userMatches.length - 1] : null,
                        // Conversations
                        conversations: userConversations,
                        totalMessages: totalMessages,
                        // Emergency contact
                        emergencyContact: emergencyContacts[email] || null,
                        // Billing history
                        billingHistory: billingHistories[email] || []
                    };
                }
            });
            console.log(`📊 Returning ${Object.keys(users).length} users with FULL data (matches, chats, activity, etc)`);
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
        
        // ============ ACTIVITY TRACKING ============
        
        // POST /activity - Update user activity/login status
        if (method === 'POST' && path.includes('/activity')) {
            const body = JSON.parse(event.body || '{}');
            const { email, isLoggedIn, sessionDuration } = body;
            
            if (!email) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email required' }) };
            }
            
            const emailLower = email.toLowerCase();
            const now = new Date().toISOString();
            
            // Get existing activity data
            const existing = await docClient.send(new GetCommand({
                TableName: TABLE_NAME,
                Key: { pk: `USER#${emailLower}`, sk: 'ACTIVITY' }
            }));
            
            const currentData = existing.Item || { loginCount: 0, totalTimeSpent: 0 };
            
            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    pk: `USER#${emailLower}`,
                    sk: 'ACTIVITY',
                    email: emailLower,
                    isLoggedIn: isLoggedIn || false,
                    lastSeen: now,
                    lastLoginAt: isLoggedIn ? now : currentData.lastLoginAt,
                    loginCount: isLoggedIn ? (currentData.loginCount || 0) + 1 : currentData.loginCount || 0,
                    totalTimeSpent: (currentData.totalTimeSpent || 0) + (sessionDuration || 0),
                    updatedAt: now
                }
            }));
            
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }
        
        // ============ BILLING HISTORY ============
        
        // POST /billing - Add transaction to billing history
        if (method === 'POST' && path.includes('/billing')) {
            const body = JSON.parse(event.body || '{}');
            const { email, transaction } = body;
            
            if (!email) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email required' }) };
            }
            
            const emailLower = email.toLowerCase();
            
            // Get existing billing history
            const existing = await docClient.send(new GetCommand({
                TableName: TABLE_NAME,
                Key: { pk: `USER#${emailLower}`, sk: 'BILLING_HISTORY' }
            }));
            
            const transactions = existing.Item?.transactions || [];
            
            // Add new transaction
            if (transaction) {
                transactions.push({
                    ...transaction,
                    id: transaction.id || `tx_${Date.now()}`,
                    date: transaction.date || new Date().toISOString()
                });
            }
            
            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    pk: `USER#${emailLower}`,
                    sk: 'BILLING_HISTORY',
                    email: emailLower,
                    transactions: transactions,
                    updatedAt: new Date().toISOString()
                }
            }));
            
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, transactionCount: transactions.length }) };
        }
        
        // GET /billing/{email} - Get billing history
        if (method === 'GET' && path.includes('/billing/')) {
            const email = path.split('/billing/')[1]?.toLowerCase();
            if (!email) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email required' }) };
            }
            
            const result = await docClient.send(new GetCommand({
                TableName: TABLE_NAME,
                Key: { pk: `USER#${email}`, sk: 'BILLING_HISTORY' }
            }));
            
            return { 
                statusCode: 200, 
                headers, 
                body: JSON.stringify({ transactions: result.Item?.transactions || [] }) 
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
        
        // ============ CRAWLER LOGS ============
        
        // POST /crawler/logs - Save crawler run log
        if (method === 'POST' && path.includes('/crawler/logs')) {
            const body = JSON.parse(event.body || '{}');
            const { runId, source, logs, summary, options, duration } = body;
            
            if (!runId || !logs) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'runId and logs required' }) };
            }
            
            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    pk: 'CRAWLER#logs',
                    sk: `RUN#${runId}`,
                    runId: runId,
                    source: source || 'app', // 'app' or 'site' crawler
                    logs: logs, // Array of log entries
                    summary: summary || {},
                    options: options || {},
                    duration: duration || 0,
                    createdAt: new Date().toISOString()
                }
            }));
            
            console.log(`📋 Crawler log saved: ${runId} (source: ${source || 'app'})`);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, runId, source: source || 'app' }) };
        }
        
        // GET /crawler/logs - Get all crawler logs (list)
        if (method === 'GET' && path === '/crawler/logs') {
            const result = await docClient.send(new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: 'pk = :pk',
                ExpressionAttributeValues: { ':pk': 'CRAWLER#logs' },
                ScanIndexForward: false, // newest first
                Limit: 50
            }));
            
            const logs = result.Items?.map(item => ({
                runId: item.runId,
                source: item.source || 'app', // 'app' or 'site'
                summary: item.summary,
                duration: item.duration,
                createdAt: item.createdAt,
                logCount: item.logs?.length || 0
            })) || [];
            
            return { statusCode: 200, headers, body: JSON.stringify({ logs }) };
        }
        
        // GET /crawler/logs/{runId} - Get specific crawler log
        if (method === 'GET' && path.includes('/crawler/logs/')) {
            const runId = path.split('/crawler/logs/')[1];
            if (!runId) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'runId required' }) };
            }
            
            const result = await docClient.send(new GetCommand({
                TableName: TABLE_NAME,
                Key: { pk: 'CRAWLER#logs', sk: `RUN#${runId}` }
            }));
            
            if (!result.Item) {
                return { statusCode: 404, headers, body: JSON.stringify({ error: 'Log not found' }) };
            }
            
            return { statusCode: 200, headers, body: JSON.stringify(result.Item) };
        }
        
        // DELETE /crawler/logs/{runId} - Delete a crawler log
        if (method === 'DELETE' && path.includes('/crawler/logs/')) {
            const runId = path.split('/crawler/logs/')[1];
            if (!runId) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'runId required' }) };
            }
            
            await docClient.send(new DeleteCommand({
                TableName: TABLE_NAME,
                Key: { pk: 'CRAWLER#logs', sk: `RUN#${runId}` }
            }));
            
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }
        
        // ============ DOCUMENTS (Patents & Compliance) ============
        
        // POST /documents/patent - Save patent documents
        if (method === 'POST' && path.includes('/documents/patent')) {
            const body = JSON.parse(event.body || '{}');
            const { documents } = body;
            
            if (!documents) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Documents required' }) };
            }
            
            // Store the entire documents object as a single item (for simplicity)
            // Note: For large files, consider using S3 instead
            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    pk: 'DOC#patent',
                    sk: 'ALL',
                    documents: documents,
                    updatedAt: new Date().toISOString()
                }
            }));
            
            console.log('📜 Patent documents saved to DynamoDB');
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }
        
        // GET /documents/patent - Get patent documents
        if (method === 'GET' && path.includes('/documents/patent')) {
            const result = await docClient.send(new GetCommand({
                TableName: TABLE_NAME,
                Key: { pk: 'DOC#patent', sk: 'ALL' }
            }));
            
            return { 
                statusCode: 200, 
                headers, 
                body: JSON.stringify({ documents: result.Item?.documents || {} }) 
            };
        }
        
        // POST /documents/compliance - Save compliance documents
        if (method === 'POST' && path.includes('/documents/compliance')) {
            const body = JSON.parse(event.body || '{}');
            const { documents } = body;
            
            if (!documents) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Documents required' }) };
            }
            
            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    pk: 'DOC#compliance',
                    sk: 'ALL',
                    documents: documents,
                    updatedAt: new Date().toISOString()
                }
            }));
            
            console.log('✅ Compliance documents saved to DynamoDB');
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }
        
        // GET /documents/compliance - Get compliance documents
        if (method === 'GET' && path.includes('/documents/compliance')) {
            const result = await docClient.send(new GetCommand({
                TableName: TABLE_NAME,
                Key: { pk: 'DOC#compliance', sk: 'ALL' }
            }));
            
            return { 
                statusCode: 200, 
                headers, 
                body: JSON.stringify({ documents: result.Item?.documents || {} }) 
            };
        }
        
        // ============ SCHEMA STATS ============
        
        // GET /schema/stats - Get DynamoDB table statistics (multi-table)
        if (method === 'GET' && path.includes('/schema/stats')) {
            console.log('📊 Fetching schema statistics from all tables...');
            
            let stats = {
                totalItems: 0,
                // User entities (from oith-profiles)
                profiles: 0,
                likes: 0,
                matches: 0,
                matchHistory: 0,
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
                investors: 0,
                // Document entities
                patentDocs: 0,
                complianceDocs: 0,
                // System entities
                crawlerLogs: 0,
                supportMessages: 0,
                // Table breakdown
                tables: {
                    'oith-profiles': 0,
                    'oith-matches': 0,
                    'oith-match-history': 0,
                    'oith-conversations': 0,
                    'oith-users': 0
                }
            };
            
            // 1. Count profiles from oith-profiles table
            try {
                const profileScan = await docClient.send(new ScanCommand({
                    TableName: TABLES.PROFILES,
                    Select: 'COUNT'
                }));
                stats.profiles = profileScan.Count || 0;
                stats.tables['oith-profiles'] = profileScan.Count || 0;
                stats.totalItems += profileScan.Count || 0;
            } catch (e) {
                console.log('Could not scan oith-profiles:', e.message);
            }
            
            // 2. Count matches from oith-matches table
            try {
                const matchScan = await docClient.send(new ScanCommand({
                    TableName: TABLES.MATCHES,
                    Select: 'COUNT'
                }));
                stats.matches = matchScan.Count || 0;
                stats.tables['oith-matches'] = matchScan.Count || 0;
                stats.totalItems += matchScan.Count || 0;
            } catch (e) {
                console.log('Could not scan oith-matches:', e.message);
            }
            
            // 3. Count match history from oith-match-history table
            try {
                const historyScan = await docClient.send(new ScanCommand({
                    TableName: TABLES.MATCH_HISTORY,
                    Select: 'COUNT'
                }));
                stats.matchHistory = historyScan.Count || 0;
                stats.tables['oith-match-history'] = historyScan.Count || 0;
                stats.totalItems += historyScan.Count || 0;
            } catch (e) {
                console.log('Could not scan oith-match-history:', e.message);
            }
            
            // 4. Count conversations from oith-conversations table
            try {
                const convScan = await docClient.send(new ScanCommand({
                    TableName: TABLES.CONVERSATIONS,
                    Select: 'COUNT'
                }));
                stats.messages = convScan.Count || 0;
                stats.tables['oith-conversations'] = convScan.Count || 0;
                stats.totalItems += convScan.Count || 0;
            } catch (e) {
                console.log('Could not scan oith-conversations:', e.message);
            }
            
            // 5. Scan oith-users (company data) for remaining entities
            let lastEvaluatedKey;
            do {
                const scanResult = await docClient.send(new ScanCommand({
                    TableName: TABLE_NAME,
                    ProjectionExpression: 'pk, sk',
                    ExclusiveStartKey: lastEvaluatedKey
                }));
                
                scanResult.Items?.forEach(item => {
                    stats.totalItems++;
                    stats.tables['oith-users']++;
                    
                    // Legacy user entities (still in oith-users for now)
                    if (item.pk?.startsWith('LIKE#')) stats.likes++;
                    else if (item.pk?.startsWith('USER#') && item.sk === 'SUBSCRIPTION') stats.subscriptions++;
                    else if (item.pk?.startsWith('USER#') && item.sk === 'EMERGENCY_CONTACT') stats.emergencyContacts++;
                    else if (item.pk?.startsWith('USER#') && item.sk === 'SETTINGS') stats.settings++;
                    else if (item.pk?.startsWith('USER#') && item.sk === 'ACTIVITY') stats.activityEvents++;
                    else if (item.pk === 'CONFIG') stats.configs++;
                    // Feedback entities
                    else if (item.pk?.startsWith('FEEDBACK#')) stats.feedback++;
                    else if (item.pk?.startsWith('RATING#')) stats.ratings++;
                    else if (item.pk?.startsWith('REPORT#')) stats.reports++;
                    // Company entities
                    else if (item.pk === 'ORG#employee') stats.employees++;
                    else if (item.pk === 'ORG#department') stats.departments++;
                    else if (item.pk === 'ORG#metrics') stats.companyMetrics++;
                    else if (item.pk === 'ORG#investor') stats.investors++;
                    // System entities
                    else if (item.pk === 'CRAWLER#logs') stats.crawlerLogs++;
                    else if (item.pk === 'SUPPORT#all') stats.supportMessages++;
                });
                
                lastEvaluatedKey = scanResult.LastEvaluatedKey;
            } while (lastEvaluatedKey);
            
            // Count actual documents inside container items
            try {
                const patentResult = await docClient.send(new GetCommand({
                    TableName: TABLE_NAME,
                    Key: { pk: 'DOC#patent', sk: 'ALL' }
                }));
                stats.patentDocs = Object.keys(patentResult.Item?.documents || {}).length;
                
                const complianceResult = await docClient.send(new GetCommand({
                    TableName: TABLE_NAME,
                    Key: { pk: 'DOC#compliance', sk: 'ALL' }
                }));
                stats.complianceDocs = Object.keys(complianceResult.Item?.documents || {}).length;
            } catch (e) {
                console.log('Could not count document contents:', e.message);
            }
            
            console.log('📊 Schema stats:', stats);
            return { statusCode: 200, headers, body: JSON.stringify(stats) };
        }
        
        // ============ DATA PREVIEW ============
        
        // GET /data/preview/{entityType} - Get preview data for an entity type
        if (method === 'GET' && path.includes('/data/preview/')) {
            const entityType = path.split('/data/preview/')[1]?.toUpperCase();
            console.log(`📋 Fetching preview for entity: ${entityType}`);
            
            if (!entityType) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Entity type required' }) };
            }
            
            let items = [];
            
            try {
                switch (entityType) {
                    case 'PROFILE': {
                        // Scan for all profiles
                        const result = await docClient.send(new ScanCommand({
                            TableName: TABLE_NAME,
                            FilterExpression: 'sk = :sk',
                            ExpressionAttributeValues: { ':sk': 'PROFILE' },
                            Limit: 100
                        }));
                        items = result.Items?.map(item => ({
                            email: item.email,
                            name: item.firstName || item.name,
                            age: item.age,
                            location: item.location,
                            gender: item.gender,
                            occupation: item.occupation,
                            createdAt: item.createdAt,
                            visible: item.visible
                        })) || [];
                        break;
                    }
                    
                    case 'MATCH': {
                        const result = await docClient.send(new ScanCommand({
                            TableName: TABLE_NAME,
                            FilterExpression: 'begins_with(pk, :pk)',
                            ExpressionAttributeValues: { ':pk': 'MATCH#' },
                            Limit: 100
                        }));
                        items = result.Items || [];
                        break;
                    }
                    
                    case 'LIKE': {
                        const result = await docClient.send(new ScanCommand({
                            TableName: TABLE_NAME,
                            FilterExpression: 'begins_with(pk, :pk)',
                            ExpressionAttributeValues: { ':pk': 'LIKE#' },
                            Limit: 100
                        }));
                        items = result.Items?.map(item => ({
                            pk: item.pk,
                            sk: item.sk,
                            fromUser: item.pk.replace('LIKE#', ''),
                            toUser: item.sk.replace('TO#', ''),
                            timestamp: item.timestamp,
                            mutual: item.mutual
                        })) || [];
                        break;
                    }
                    
                    case 'CHAT': {
                        const result = await docClient.send(new ScanCommand({
                            TableName: TABLE_NAME,
                            FilterExpression: 'begins_with(pk, :pk)',
                            ExpressionAttributeValues: { ':pk': 'CHAT#' },
                            Limit: 100
                        }));
                        items = result.Items?.map(item => ({
                            pk: item.pk,
                            sk: item.sk,
                            from: item.from,
                            to: item.to,
                            text: item.text?.substring(0, 50) + (item.text?.length > 50 ? '...' : ''),
                            timestamp: item.timestamp
                        })) || [];
                        break;
                    }
                    
                    case 'SUBSCRIPTION': {
                        const result = await docClient.send(new ScanCommand({
                            TableName: TABLE_NAME,
                            FilterExpression: 'sk = :sk',
                            ExpressionAttributeValues: { ':sk': 'SUBSCRIPTION' },
                            Limit: 100
                        }));
                        items = result.Items?.map(item => ({
                            email: item.pk.replace('USER#', ''),
                            plan: item.plan,
                            status: item.status,
                            startDate: item.startDate,
                            endDate: item.endDate
                        })) || [];
                        break;
                    }
                    
                    case 'CONFIG': {
                        const result = await docClient.send(new QueryCommand({
                            TableName: TABLE_NAME,
                            KeyConditionExpression: 'pk = :pk',
                            ExpressionAttributeValues: { ':pk': 'CONFIG' },
                            Limit: 100
                        }));
                        items = result.Items?.map(item => ({
                            sk: item.sk,
                            type: item.type,
                            updatedAt: item.updatedAt,
                            updatedBy: item.updatedBy
                        })) || [];
                        break;
                    }
                    
                    case 'CRAWLER_LOG': {
                        const result = await docClient.send(new QueryCommand({
                            TableName: TABLE_NAME,
                            KeyConditionExpression: 'pk = :pk',
                            ExpressionAttributeValues: { ':pk': 'CRAWLER#logs' },
                            ScanIndexForward: false,
                            Limit: 50
                        }));
                        items = result.Items?.map(item => ({
                            source: item.source || 'app', // 'app' or 'site' - FIRST column
                            passed: item.summary?.passed || 0,
                            failed: item.summary?.failed || 0,
                            warnings: item.summary?.warnings || 0,
                            duration: item.duration ? `${Math.round(item.duration / 1000)}s` : '--',
                            timestamp: item.createdAt || item.timestamp
                        })) || [];
                        break;
                    }
                    
                    case 'EMPLOYEE': {
                        const result = await docClient.send(new QueryCommand({
                            TableName: TABLE_NAME,
                            KeyConditionExpression: 'pk = :pk',
                            ExpressionAttributeValues: { ':pk': 'ORG#employee' }
                        }));
                        items = result.Items?.map(item => ({
                            id: item.id,
                            name: item.name,
                            title: item.title,
                            department: item.department,
                            email: item.email,
                            status: item.status,
                            startDate: item.startDate,
                            salary: item.salary
                        })) || [];
                        break;
                    }
                    
                    case 'DEPARTMENT': {
                        const result = await docClient.send(new QueryCommand({
                            TableName: TABLE_NAME,
                            KeyConditionExpression: 'pk = :pk',
                            ExpressionAttributeValues: { ':pk': 'ORG#department' }
                        }));
                        items = result.Items?.map(item => ({
                            id: item.id,
                            name: item.name,
                            color: item.color,
                            updatedAt: item.updatedAt
                        })) || [];
                        break;
                    }
                    
                    case 'REPORT': {
                        const result = await docClient.send(new QueryCommand({
                            TableName: TABLE_NAME,
                            KeyConditionExpression: 'pk = :pk',
                            ExpressionAttributeValues: { ':pk': 'REPORT#all' }
                        }));
                        items = result.Items?.map(item => ({
                            id: item.reportId,
                            reportedUser: item.reportedUser,
                            reportedBy: item.reportedBy,
                            reason: item.reason,
                            status: item.status,
                            createdAt: item.createdAt
                        })) || [];
                        break;
                    }
                    
                    case 'SUPPORT': {
                        const result = await docClient.send(new QueryCommand({
                            TableName: TABLE_NAME,
                            KeyConditionExpression: 'pk = :pk',
                            ExpressionAttributeValues: { ':pk': 'SUPPORT#all' }
                        }));
                        items = result.Items?.map(item => ({
                            id: item.messageId,
                            userEmail: item.userEmail,
                            subject: item.subject,
                            status: item.status,
                            priority: item.priority,
                            createdAt: item.createdAt
                        })) || [];
                        break;
                    }
                    
                    case 'FEEDBACK': {
                        const result = await docClient.send(new ScanCommand({
                            TableName: TABLE_NAME,
                            FilterExpression: 'begins_with(pk, :pk)',
                            ExpressionAttributeValues: { ':pk': 'FEEDBACK#' },
                            Limit: 50
                        }));
                        items = result.Items?.map(item => ({
                            pk: item.pk,
                            type: item.type,
                            message: item.message?.substring(0, 50) + (item.message?.length > 50 ? '...' : ''),
                            rating: item.rating,
                            createdAt: item.createdAt
                        })) || [];
                        break;
                    }
                    
                    case 'RATING': {
                        const result = await docClient.send(new ScanCommand({
                            TableName: TABLE_NAME,
                            FilterExpression: 'begins_with(pk, :pk)',
                            ExpressionAttributeValues: { ':pk': 'RATING#' },
                            Limit: 50
                        }));
                        items = result.Items?.map(item => ({
                            pk: item.pk,
                            ratedUser: item.ratedUser,
                            ratedBy: item.ratedBy,
                            rating: item.rating,
                            createdAt: item.createdAt
                        })) || [];
                        break;
                    }
                    
                    case 'ACTIVITY': {
                        const result = await docClient.send(new ScanCommand({
                            TableName: TABLE_NAME,
                            FilterExpression: 'begins_with(pk, :pk)',
                            ExpressionAttributeValues: { ':pk': 'ACTIVITY#' },
                            Limit: 50
                        }));
                        items = result.Items?.map(item => ({
                            pk: item.pk,
                            event: item.event,
                            user: item.user,
                            details: item.details,
                            timestamp: item.timestamp
                        })) || [];
                        break;
                    }
                    
                    case 'SESSION': {
                        const result = await docClient.send(new ScanCommand({
                            TableName: TABLE_NAME,
                            FilterExpression: 'begins_with(pk, :pk)',
                            ExpressionAttributeValues: { ':pk': 'SESSION#' },
                            Limit: 50
                        }));
                        items = result.Items?.map(item => ({
                            pk: item.pk,
                            user: item.user,
                            device: item.device,
                            startTime: item.startTime,
                            endTime: item.endTime
                        })) || [];
                        break;
                    }
                    
                    case 'METRICS': {
                        const result = await docClient.send(new ScanCommand({
                            TableName: TABLE_NAME,
                            FilterExpression: 'begins_with(pk, :pk)',
                            ExpressionAttributeValues: { ':pk': 'METRICS#' },
                            Limit: 50
                        }));
                        items = result.Items?.map(item => ({
                            pk: item.pk,
                            date: item.date,
                            activeUsers: item.activeUsers,
                            newUsers: item.newUsers,
                            matches: item.matches
                        })) || [];
                        break;
                    }
                    
                    case 'COMPANY_METRICS': {
                        const result = await docClient.send(new QueryCommand({
                            TableName: TABLE_NAME,
                            KeyConditionExpression: 'pk = :pk',
                            ExpressionAttributeValues: { ':pk': 'ORG#metrics' }
                        }));
                        items = result.Items?.map(item => ({
                            sk: item.sk,
                            metric: item.metric,
                            value: item.value,
                            period: item.period,
                            updatedAt: item.updatedAt
                        })) || [];
                        break;
                    }
                    
                    case 'INVESTOR': {
                        const result = await docClient.send(new QueryCommand({
                            TableName: TABLE_NAME,
                            KeyConditionExpression: 'pk = :pk',
                            ExpressionAttributeValues: { ':pk': 'ORG#investor' }
                        }));
                        items = result.Items?.map(item => ({
                            sk: item.sk,
                            name: item.name,
                            type: item.type,
                            amount: item.amount,
                            date: item.date
                        })) || [];
                        break;
                    }
                    
                    case 'PATENT_DOC': {
                        // Get the container item that holds documents
                        const result = await docClient.send(new GetCommand({
                            TableName: TABLE_NAME,
                            Key: { pk: 'DOC#patent', sk: 'ALL' }
                        }));
                        
                        // Extract actual documents from the container
                        const docs = result.Item?.documents || {};
                        items = Object.entries(docs).map(([id, doc]) => ({
                            id: id,
                            name: doc.name || 'Unnamed',
                            type: doc.type || '--',
                            status: doc.status || '--',
                            uploadedAt: doc.uploadedAt || '--'
                        }));
                        break;
                    }
                    
                    case 'COMPLIANCE_DOC': {
                        // Get the container item that holds documents
                        const result = await docClient.send(new GetCommand({
                            TableName: TABLE_NAME,
                            Key: { pk: 'DOC#compliance', sk: 'ALL' }
                        }));
                        
                        // Extract actual documents from the container
                        const docs = result.Item?.documents || {};
                        items = Object.entries(docs).map(([id, doc]) => ({
                            id: id,
                            name: doc.name || 'Unnamed',
                            type: doc.type || '--',
                            status: doc.status || '--',
                            uploadedAt: doc.uploadedAt || '--'
                        }));
                        break;
                    }
                    
                    default:
                        return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown entity type: ${entityType}` }) };
                }
                
                console.log(`📋 Found ${items.length} ${entityType} items`);
                return { statusCode: 200, headers, body: JSON.stringify({ items, count: items.length, entityType }) };
                
            } catch (error) {
                console.error(`Error fetching ${entityType}:`, error);
                return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
            }
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
        
        // ============ REPORTS ============
        
        // POST /reports - Save a report
        if (method === 'POST' && path === '/reports') {
            const body = JSON.parse(event.body || '{}');
            const { reportId, reportedUser, reportedBy, reason, details, status } = body;
            
            if (!reportedUser || !reportedBy) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'reportedUser and reportedBy required' }) };
            }
            
            const id = reportId || `report_${Date.now()}`;
            
            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    pk: 'REPORT#all',
                    sk: `REPORT#${id}`,
                    reportId: id,
                    reportedUser: reportedUser,
                    reportedBy: reportedBy,
                    reason: reason || 'Not specified',
                    details: details || '',
                    status: status || 'pending',
                    createdAt: new Date().toISOString()
                }
            }));
            
            console.log(`🚨 Report saved: ${id}`);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, reportId: id }) };
        }
        
        // GET /reports - Get all reports
        if (method === 'GET' && path === '/reports') {
            const result = await docClient.send(new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: 'pk = :pk',
                ExpressionAttributeValues: { ':pk': 'REPORT#all' },
                ScanIndexForward: false
            }));
            
            const reports = result.Items?.map(item => ({
                id: item.reportId,
                reportedUser: item.reportedUser,
                reportedBy: item.reportedBy,
                reason: item.reason,
                details: item.details,
                status: item.status,
                createdAt: item.createdAt
            })) || [];
            
            return { statusCode: 200, headers, body: JSON.stringify({ reports }) };
        }
        
        // DELETE /reports/{id} - Delete a report
        if (method === 'DELETE' && path.includes('/reports/')) {
            const reportId = path.split('/reports/')[1];
            
            await docClient.send(new DeleteCommand({
                TableName: TABLE_NAME,
                Key: { pk: 'REPORT#all', sk: `REPORT#${reportId}` }
            }));
            
            console.log(`🗑️ Report deleted: ${reportId}`);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }
        
        // ============ SUPPORT MESSAGES ============
        
        // POST /support - Save a support message
        if (method === 'POST' && path === '/support') {
            const body = JSON.parse(event.body || '{}');
            const { messageId, userEmail, subject, message, status, priority } = body;
            
            if (!userEmail || !message) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'userEmail and message required' }) };
            }
            
            const id = messageId || `support_${Date.now()}`;
            
            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    pk: 'SUPPORT#all',
                    sk: `MSG#${id}`,
                    messageId: id,
                    userEmail: userEmail,
                    subject: subject || 'Support Request',
                    message: message,
                    status: status || 'open',
                    priority: priority || 'normal',
                    createdAt: new Date().toISOString()
                }
            }));
            
            console.log(`💬 Support message saved: ${id}`);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, messageId: id }) };
        }
        
        // GET /support - Get all support messages
        if (method === 'GET' && path === '/support') {
            const result = await docClient.send(new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: 'pk = :pk',
                ExpressionAttributeValues: { ':pk': 'SUPPORT#all' },
                ScanIndexForward: false
            }));
            
            const messages = result.Items?.map(item => ({
                id: item.messageId,
                userEmail: item.userEmail,
                subject: item.subject,
                message: item.message,
                status: item.status,
                priority: item.priority,
                createdAt: item.createdAt
            })) || [];
            
            return { statusCode: 200, headers, body: JSON.stringify({ messages }) };
        }
        
        // DELETE /support/{id} - Delete a support message
        if (method === 'DELETE' && path.includes('/support/')) {
            const msgId = path.split('/support/')[1];
            
            await docClient.send(new DeleteCommand({
                TableName: TABLE_NAME,
                Key: { pk: 'SUPPORT#all', sk: `MSG#${msgId}` }
            }));
            
            console.log(`🗑️ Support message deleted: ${msgId}`);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }
        
        // ============ ORG DATA (EMPLOYEES & DEPARTMENTS) ============
        
        // POST /org/employees - Save/update an employee
        if (method === 'POST' && path === '/org/employees') {
            const body = JSON.parse(event.body || '{}');
            const employee = body.employee;
            
            if (!employee || !employee.id) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Employee data with id required' }) };
            }
            
            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    pk: 'ORG#employee',
                    sk: `EMP#${employee.id}`,
                    ...employee,
                    updatedAt: new Date().toISOString()
                }
            }));
            
            console.log(`👤 Employee saved: ${employee.name} (${employee.id})`);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, employeeId: employee.id }) };
        }
        
        // GET /org/employees - Get all employees
        if (method === 'GET' && path === '/org/employees') {
            const result = await docClient.send(new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: 'pk = :pk',
                ExpressionAttributeValues: { ':pk': 'ORG#employee' }
            }));
            
            const employees = result.Items?.map(item => {
                const { pk, sk, ...employee } = item;
                return employee;
            }) || [];
            
            console.log(`👥 Retrieved ${employees.length} employees`);
            return { statusCode: 200, headers, body: JSON.stringify({ employees }) };
        }
        
        // DELETE /org/employees/{id} - Delete an employee
        if (method === 'DELETE' && path.includes('/org/employees/')) {
            const empId = path.split('/org/employees/')[1];
            
            await docClient.send(new DeleteCommand({
                TableName: TABLE_NAME,
                Key: { pk: 'ORG#employee', sk: `EMP#${empId}` }
            }));
            
            console.log(`🗑️ Employee deleted: ${empId}`);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }
        
        // POST /org/departments - Save/update a department
        if (method === 'POST' && path === '/org/departments') {
            const body = JSON.parse(event.body || '{}');
            const department = body.department;
            
            if (!department || !department.id) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Department data with id required' }) };
            }
            
            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    pk: 'ORG#department',
                    sk: `DEPT#${department.id}`,
                    ...department,
                    updatedAt: new Date().toISOString()
                }
            }));
            
            console.log(`🏢 Department saved: ${department.name}`);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, departmentId: department.id }) };
        }
        
        // GET /org/departments - Get all departments
        if (method === 'GET' && path === '/org/departments') {
            const result = await docClient.send(new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: 'pk = :pk',
                ExpressionAttributeValues: { ':pk': 'ORG#department' }
            }));
            
            const departments = result.Items?.map(item => {
                const { pk, sk, ...dept } = item;
                return dept;
            }) || [];
            
            console.log(`🏢 Retrieved ${departments.length} departments`);
            return { statusCode: 200, headers, body: JSON.stringify({ departments }) };
        }
        
        // POST /org/sync - Sync all org data at once (with deletion support)
        if (method === 'POST' && path === '/org/sync') {
            const body = JSON.parse(event.body || '{}');
            const { employees, departments } = body;
            
            // Step 1: Get existing employees from DynamoDB
            const existingEmpResult = await docClient.send(new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: 'pk = :pk',
                ExpressionAttributeValues: { ':pk': 'ORG#employee' }
            }));
            const existingEmpIds = new Set(existingEmpResult.Items?.map(item => item.sk) || []);
            
            // Step 2: Get existing departments from DynamoDB
            const existingDeptResult = await docClient.send(new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: 'pk = :pk',
                ExpressionAttributeValues: { ':pk': 'ORG#department' }
            }));
            const existingDeptIds = new Set(existingDeptResult.Items?.map(item => item.sk) || []);
            
            // Step 3: Determine which items to delete (exist in DB but not in incoming data)
            const incomingEmpIds = new Set((employees || []).map(emp => `EMP#${emp.id}`));
            const incomingDeptIds = new Set((departments || []).map(dept => `DEPT#${dept.id}`));
            
            const empsToDelete = [...existingEmpIds].filter(id => !incomingEmpIds.has(id));
            const deptsToDelete = [...existingDeptIds].filter(id => !incomingDeptIds.has(id));
            
            // Step 4: Delete removed items
            for (const sk of empsToDelete) {
                await docClient.send(new DeleteCommand({
                    TableName: TABLE_NAME,
                    Key: { pk: 'ORG#employee', sk }
                }));
                console.log(`🗑️ Deleted employee: ${sk}`);
            }
            
            for (const sk of deptsToDelete) {
                await docClient.send(new DeleteCommand({
                    TableName: TABLE_NAME,
                    Key: { pk: 'ORG#department', sk }
                }));
                console.log(`🗑️ Deleted department: ${sk}`);
            }
            
            // Step 5: Batch write all employees and departments (add/update)
            const items = [];
            
            if (employees && Array.isArray(employees)) {
                employees.forEach(emp => {
                    items.push({
                        PutRequest: {
                            Item: {
                                pk: 'ORG#employee',
                                sk: `EMP#${emp.id}`,
                                ...emp,
                                updatedAt: new Date().toISOString()
                            }
                        }
                    });
                });
            }
            
            if (departments && Array.isArray(departments)) {
                departments.forEach(dept => {
                    items.push({
                        PutRequest: {
                            Item: {
                                pk: 'ORG#department',
                                sk: `DEPT#${dept.id}`,
                                ...dept,
                                updatedAt: new Date().toISOString()
                            }
                        }
                    });
                });
            }
            
            // Batch write in chunks of 25 (DynamoDB limit)
            for (let i = 0; i < items.length; i += 25) {
                const batch = items.slice(i, i + 25);
                await docClient.send(new BatchWriteCommand({
                    RequestItems: {
                        [TABLE_NAME]: batch
                    }
                }));
            }
            
            console.log(`🏢 Org sync: ${employees?.length || 0} employees, ${departments?.length || 0} departments, deleted ${empsToDelete.length} employees`);
            return { statusCode: 200, headers, body: JSON.stringify({ 
                success: true, 
                employeeCount: employees?.length || 0, 
                departmentCount: departments?.length || 0,
                deletedEmployees: empsToDelete.length,
                deletedDepartments: deptsToDelete.length
            }) };
        }
        
        // GET /org/all - Get all org data
        if (method === 'GET' && path === '/org/all') {
            // Get employees
            const empResult = await docClient.send(new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: 'pk = :pk',
                ExpressionAttributeValues: { ':pk': 'ORG#employee' }
            }));
            
            const employees = empResult.Items?.map(item => {
                const { pk, sk, ...emp } = item;
                return emp;
            }) || [];
            
            // Get departments
            const deptResult = await docClient.send(new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: 'pk = :pk',
                ExpressionAttributeValues: { ':pk': 'ORG#department' }
            }));
            
            const departments = deptResult.Items?.map(item => {
                const { pk, sk, ...dept } = item;
                return dept;
            }) || [];
            
            return { statusCode: 200, headers, body: JSON.stringify({ employees, departments }) };
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

