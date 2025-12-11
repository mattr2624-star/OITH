/**
 * Email API Routes
 * Handles email sending/receiving via Gmail API (Google Workspace)
 * Ready to connect once Google Workspace credentials are configured
 */

const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const { docClient, TABLES, isAWSConfigured } = require('../aws-config');
const { PutCommand, QueryCommand, DeleteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

// Email configuration state
let emailConfig = {
    configured: false,
    provider: 'gmail', // 'gmail' or 'smtp'
    credentials: null,
    oauth2Client: null
};

// Check if email is configured
function isEmailConfigured() {
    return emailConfig.configured && emailConfig.oauth2Client;
}

// Initialize Gmail OAuth2 client
function initializeGmailClient(credentials) {
    try {
        const { client_id, client_secret, redirect_uri, refresh_token } = credentials;
        
        const oauth2Client = new google.auth.OAuth2(
            client_id,
            client_secret,
            redirect_uri || 'http://localhost:3001/api/email/oauth/callback'
        );
        
        if (refresh_token) {
            oauth2Client.setCredentials({ refresh_token });
            emailConfig.oauth2Client = oauth2Client;
            emailConfig.configured = true;
            emailConfig.credentials = credentials;
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error initializing Gmail client:', error);
        return false;
    }
}

// Load email config from environment or storage
function loadEmailConfig() {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
    
    if (clientId && clientSecret && refreshToken) {
        return initializeGmailClient({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken
        });
    }
    return false;
}

// Try to load config on startup
loadEmailConfig();

// ==========================================
// EMAIL STATUS & CONFIGURATION
// ==========================================

// GET email configuration status
router.get('/status', (req, res) => {
    res.json({
        configured: emailConfig.configured,
        provider: emailConfig.provider,
        hasCredentials: !!emailConfig.credentials,
        email: emailConfig.configured ? (process.env.GMAIL_EMAIL || 'admin@oith.com') : null,
        setupRequired: !emailConfig.configured ? {
            steps: [
                '1. Create Google Cloud Project',
                '2. Enable Gmail API',
                '3. Create OAuth 2.0 credentials',
                '4. Configure credentials in .env file',
                '5. Complete OAuth flow'
            ],
            envVariables: [
                'GMAIL_CLIENT_ID',
                'GMAIL_CLIENT_SECRET', 
                'GMAIL_REFRESH_TOKEN',
                'GMAIL_EMAIL'
            ]
        } : null
    });
});

// POST save email configuration
router.post('/configure', async (req, res) => {
    try {
        const { client_id, client_secret, refresh_token, email } = req.body;
        
        if (!client_id || !client_secret) {
            return res.status(400).json({ 
                error: 'Missing required credentials',
                required: ['client_id', 'client_secret']
            });
        }
        
        const success = initializeGmailClient({
            client_id,
            client_secret,
            refresh_token
        });
        
        if (success) {
            // Store config in DynamoDB for persistence
            if (isAWSConfigured()) {
                await docClient.send(new PutCommand({
                    TableName: TABLES.USERS,
                    Item: {
                        pk: 'CONFIG#EMAIL',
                        sk: 'SETTINGS',
                        client_id,
                        client_secret,
                        refresh_token,
                        email: email || 'admin@oith.com',
                        configuredAt: new Date().toISOString()
                    }
                }));
            }
            
            res.json({ 
                success: true, 
                message: 'Email configuration saved successfully',
                configured: true
            });
        } else {
            res.json({ 
                success: false, 
                message: 'Configuration saved but OAuth flow not complete. Use /oauth/url to complete setup.',
                needsOAuth: true
            });
        }
    } catch (error) {
        console.error('Error saving email config:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET OAuth URL for Gmail authorization
router.get('/oauth/url', (req, res) => {
    try {
        const clientId = req.query.client_id || process.env.GMAIL_CLIENT_ID;
        const clientSecret = req.query.client_secret || process.env.GMAIL_CLIENT_SECRET;
        
        if (!clientId || !clientSecret) {
            return res.status(400).json({ 
                error: 'Client ID and Secret required',
                message: 'Provide client_id and client_secret as query params or in .env'
            });
        }
        
        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            'http://localhost:3001/api/email/oauth/callback'
        );
        
        const scopes = [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.modify'
        ];
        
        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent'
        });
        
        res.json({ authUrl });
    } catch (error) {
        console.error('Error generating OAuth URL:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET OAuth callback
router.get('/oauth/callback', async (req, res) => {
    try {
        const { code } = req.query;
        
        if (!code) {
            return res.status(400).send('Authorization code required');
        }
        
        const clientId = process.env.GMAIL_CLIENT_ID;
        const clientSecret = process.env.GMAIL_CLIENT_SECRET;
        
        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            'http://localhost:3001/api/email/oauth/callback'
        );
        
        const { tokens } = await oauth2Client.getToken(code);
        
        // Initialize with the new tokens
        initializeGmailClient({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: tokens.refresh_token
        });
        
        // Return HTML page with success message
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Email Connected!</title>
                <style>
                    body { font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: #fff; }
                    .container { text-align: center; padding: 40px; background: #16213e; border-radius: 20px; }
                    h1 { color: #4ade80; }
                    p { color: #a0a0a0; }
                    .token { background: #0f0f23; padding: 15px; border-radius: 10px; font-family: monospace; font-size: 12px; word-break: break-all; margin: 20px 0; }
                    .note { color: #fbbf24; font-size: 14px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>✅ Email Connected Successfully!</h1>
                    <p>Your Gmail account is now connected to OITH Admin.</p>
                    <p class="note">⚠️ Save this refresh token to your .env file:</p>
                    <div class="token">GMAIL_REFRESH_TOKEN=${tokens.refresh_token}</div>
                    <p>You can close this window and return to the admin dashboard.</p>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('OAuth callback error:', error);
        res.status(500).send(`Error: ${error.message}`);
    }
});

// ==========================================
// EMAIL OPERATIONS
// ==========================================

// GET list emails (inbox)
router.get('/inbox', async (req, res) => {
    try {
        const { folder = 'INBOX', maxResults = 50 } = req.query;
        
        // If not configured, return local inbox
        if (!isEmailConfigured()) {
            // Return emails from local storage/DynamoDB
            if (isAWSConfigured()) {
                const result = await docClient.send(new ScanCommand({
                    TableName: TABLES.USERS,
                    FilterExpression: 'begins_with(pk, :pk)',
                    ExpressionAttributeValues: { ':pk': 'EMAIL#INBOX' }
                }));
                return res.json({
                    source: 'local',
                    configured: false,
                    emails: result.Items || [],
                    message: 'Showing locally stored emails. Configure Gmail to fetch real emails.'
                });
            }
            return res.json({
                source: 'local',
                configured: false,
                emails: [],
                message: 'Email not configured. Set up Gmail API credentials to enable.'
            });
        }
        
        // Fetch from Gmail
        const gmail = google.gmail({ version: 'v1', auth: emailConfig.oauth2Client });
        
        const response = await gmail.users.messages.list({
            userId: 'me',
            labelIds: [folder],
            maxResults: parseInt(maxResults)
        });
        
        const messages = response.data.messages || [];
        const emails = [];
        
        // Fetch full details for each message
        for (const msg of messages.slice(0, 20)) { // Limit to 20 for performance
            const detail = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id,
                format: 'metadata',
                metadataHeaders: ['From', 'To', 'Subject', 'Date']
            });
            
            const headers = detail.data.payload.headers;
            emails.push({
                id: msg.id,
                threadId: msg.threadId,
                from: headers.find(h => h.name === 'From')?.value || '',
                to: headers.find(h => h.name === 'To')?.value || '',
                subject: headers.find(h => h.name === 'Subject')?.value || '(No Subject)',
                date: headers.find(h => h.name === 'Date')?.value || '',
                snippet: detail.data.snippet,
                read: !detail.data.labelIds.includes('UNREAD')
            });
        }
        
        res.json({
            source: 'gmail',
            configured: true,
            emails,
            totalCount: response.data.resultSizeEstimate
        });
    } catch (error) {
        console.error('Error fetching inbox:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET single email
router.get('/message/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!isEmailConfigured()) {
            // Try to get from local storage
            if (isAWSConfigured()) {
                const result = await docClient.send(new QueryCommand({
                    TableName: TABLES.USERS,
                    KeyConditionExpression: 'pk = :pk AND sk = :sk',
                    ExpressionAttributeValues: {
                        ':pk': 'EMAIL#INBOX',
                        ':sk': id
                    }
                }));
                if (result.Items && result.Items.length > 0) {
                    return res.json(result.Items[0]);
                }
            }
            return res.status(404).json({ error: 'Email not found' });
        }
        
        const gmail = google.gmail({ version: 'v1', auth: emailConfig.oauth2Client });
        
        const response = await gmail.users.messages.get({
            userId: 'me',
            id,
            format: 'full'
        });
        
        const headers = response.data.payload.headers;
        let body = '';
        
        // Extract body
        if (response.data.payload.body.data) {
            body = Buffer.from(response.data.payload.body.data, 'base64').toString('utf-8');
        } else if (response.data.payload.parts) {
            const textPart = response.data.payload.parts.find(p => p.mimeType === 'text/plain');
            const htmlPart = response.data.payload.parts.find(p => p.mimeType === 'text/html');
            const part = textPart || htmlPart;
            if (part && part.body.data) {
                body = Buffer.from(part.body.data, 'base64').toString('utf-8');
            }
        }
        
        res.json({
            id: response.data.id,
            threadId: response.data.threadId,
            from: headers.find(h => h.name === 'From')?.value || '',
            to: headers.find(h => h.name === 'To')?.value || '',
            subject: headers.find(h => h.name === 'Subject')?.value || '(No Subject)',
            date: headers.find(h => h.name === 'Date')?.value || '',
            body,
            labels: response.data.labelIds
        });
    } catch (error) {
        console.error('Error fetching message:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST send email
router.post('/send', async (req, res) => {
    try {
        const { to, subject, body, replyTo } = req.body;
        
        if (!to || !subject || !body) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                required: ['to', 'subject', 'body']
            });
        }
        
        if (!isEmailConfigured()) {
            // Store in local outbox for later sending
            const email = {
                id: `local_${Date.now()}`,
                to,
                subject,
                body,
                replyTo,
                status: 'pending',
                createdAt: new Date().toISOString()
            };
            
            if (isAWSConfigured()) {
                await docClient.send(new PutCommand({
                    TableName: TABLES.USERS,
                    Item: {
                        pk: 'EMAIL#OUTBOX',
                        sk: email.id,
                        ...email
                    }
                }));
            }
            
            return res.json({
                success: true,
                queued: true,
                message: 'Email queued for sending. Will be sent when Gmail is configured.',
                email
            });
        }
        
        const gmail = google.gmail({ version: 'v1', auth: emailConfig.oauth2Client });
        const fromEmail = process.env.GMAIL_EMAIL || 'admin@oith.com';
        
        // Create email in RFC 2822 format
        const emailLines = [
            `From: ${fromEmail}`,
            `To: ${to}`,
            `Subject: ${subject}`,
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=utf-8',
            '',
            body
        ];
        
        if (replyTo) {
            emailLines.splice(2, 0, `In-Reply-To: ${replyTo}`);
        }
        
        const email = emailLines.join('\r\n');
        const encodedEmail = Buffer.from(email).toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        
        const response = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedEmail
            }
        });
        
        // Store in sent folder locally too
        if (isAWSConfigured()) {
            await docClient.send(new PutCommand({
                TableName: TABLES.USERS,
                Item: {
                    pk: 'EMAIL#SENT',
                    sk: response.data.id,
                    to,
                    subject,
                    body,
                    sentAt: new Date().toISOString()
                }
            }));
        }
        
        res.json({
            success: true,
            messageId: response.data.id,
            message: 'Email sent successfully'
        });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST mark email as read
router.post('/mark-read/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!isEmailConfigured()) {
            return res.json({ success: true, local: true });
        }
        
        const gmail = google.gmail({ version: 'v1', auth: emailConfig.oauth2Client });
        
        await gmail.users.messages.modify({
            userId: 'me',
            id,
            requestBody: {
                removeLabelIds: ['UNREAD']
            }
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error marking as read:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE archive email
router.delete('/archive/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!isEmailConfigured()) {
            // Remove from local inbox
            if (isAWSConfigured()) {
                await docClient.send(new DeleteCommand({
                    TableName: TABLES.USERS,
                    Key: { pk: 'EMAIL#INBOX', sk: id }
                }));
            }
            return res.json({ success: true, local: true });
        }
        
        const gmail = google.gmail({ version: 'v1', auth: emailConfig.oauth2Client });
        
        await gmail.users.messages.modify({
            userId: 'me',
            id,
            requestBody: {
                removeLabelIds: ['INBOX'],
                addLabelIds: ['ARCHIVED']
            }
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error archiving email:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// SUPPORT MESSAGES (from user app)
// ==========================================

// POST receive support message (from user app)
router.post('/support', async (req, res) => {
    try {
        const { userEmail, userName, subject, message } = req.body;
        
        const supportMessage = {
            id: `support_${Date.now()}`,
            userEmail,
            userName,
            subject,
            message,
            timestamp: new Date().toISOString(),
            read: false,
            replied: false,
            type: 'support'
        };
        
        // Store in DynamoDB
        if (isAWSConfigured()) {
            await docClient.send(new PutCommand({
                TableName: TABLES.USERS,
                Item: {
                    pk: 'EMAIL#INBOX',
                    sk: supportMessage.id,
                    ...supportMessage
                }
            }));
        }
        
        // If email is configured, also send notification
        if (isEmailConfigured()) {
            const gmail = google.gmail({ version: 'v1', auth: emailConfig.oauth2Client });
            const fromEmail = process.env.GMAIL_EMAIL || 'admin@oith.com';
            
            // Send notification email to admin
            const notificationEmail = [
                `From: OITH Support <${fromEmail}>`,
                `To: ${fromEmail}`,
                `Subject: [Support] ${subject} - from ${userName}`,
                'MIME-Version: 1.0',
                'Content-Type: text/html; charset=utf-8',
                '',
                `<h3>New Support Message</h3>`,
                `<p><strong>From:</strong> ${userName} (${userEmail})</p>`,
                `<p><strong>Subject:</strong> ${subject}</p>`,
                `<hr>`,
                `<p>${message}</p>`
            ].join('\r\n');
            
            const encoded = Buffer.from(notificationEmail).toString('base64')
                .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            
            await gmail.users.messages.send({
                userId: 'me',
                requestBody: { raw: encoded }
            });
        }
        
        res.json({ success: true, id: supportMessage.id });
    } catch (error) {
        console.error('Error saving support message:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET support messages
router.get('/support', async (req, res) => {
    try {
        if (!isAWSConfigured()) {
            return res.json({ messages: [], source: 'none' });
        }
        
        const result = await docClient.send(new ScanCommand({
            TableName: TABLES.USERS,
            FilterExpression: 'pk = :pk AND #type = :type',
            ExpressionAttributeNames: { '#type': 'type' },
            ExpressionAttributeValues: { 
                ':pk': 'EMAIL#INBOX',
                ':type': 'support'
            }
        }));
        
        res.json({
            messages: result.Items || [],
            source: 'aws'
        });
    } catch (error) {
        console.error('Error fetching support messages:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

