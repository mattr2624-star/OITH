/**
 * Calendar API Routes
 * Handles calendar event storage and sync with AWS
 */

const express = require('express');
const router = express.Router();
const { docClient, TABLES, isAWSConfigured } = require('../aws-config');
const { PutCommand, QueryCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

// ==========================================
// GET all calendar events
// ==========================================
router.get('/events', async (req, res) => {
    try {
        if (!isAWSConfigured()) {
            return res.json({
                events: [],
                source: 'none',
                message: 'AWS not configured'
            });
        }

        const result = await docClient.send(new ScanCommand({
            TableName: TABLES.USERS,
            FilterExpression: 'begins_with(pk, :pk)',
            ExpressionAttributeValues: { ':pk': 'CALENDAR#' }
        }));

        const events = (result.Items || []).map(item => ({
            id: item.sk,
            title: item.title,
            date: item.date,
            category: item.category,
            description: item.description,
            section: item.section,
            custom: item.custom,
            zoomMeetingId: item.zoomMeetingId,
            zoomLink: item.zoomLink
        }));

        res.json({
            events,
            source: 'aws',
            count: events.length
        });
    } catch (error) {
        console.error('Error fetching calendar events:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// POST sync calendar events
// ==========================================
router.post('/sync', async (req, res) => {
    try {
        const { events } = req.body;

        if (!events || !Array.isArray(events)) {
            return res.status(400).json({ error: 'Events array required' });
        }

        if (!isAWSConfigured()) {
            return res.json({
                success: false,
                message: 'AWS not configured - events stored locally only'
            });
        }

        let syncedCount = 0;

        for (const event of events) {
            if (!event.id) continue;

            await docClient.send(new PutCommand({
                TableName: TABLES.USERS,
                Item: {
                    pk: 'CALENDAR#EVENTS',
                    sk: String(event.id),
                    title: event.title,
                    date: event.date,
                    category: event.category || 'meeting',
                    description: event.description || '',
                    section: event.section || 'calendar',
                    custom: event.custom || false,
                    zoomMeetingId: event.zoomMeetingId || '',
                    zoomLink: event.zoomLink || '',
                    syncedAt: new Date().toISOString()
                }
            }));
            syncedCount++;
        }

        res.json({
            success: true,
            syncedCount,
            message: `Synced ${syncedCount} calendar events to AWS`
        });
    } catch (error) {
        console.error('Error syncing calendar:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// POST add single event
// ==========================================
router.post('/event', async (req, res) => {
    try {
        const { id, title, date, category, description, section, zoomMeetingId } = req.body;

        if (!title || !date) {
            return res.status(400).json({ error: 'Title and date required' });
        }

        const eventId = id || `event_${Date.now()}`;
        
        // Generate Zoom link from meeting ID if provided
        let zoomLink = '';
        if (zoomMeetingId) {
            const cleanZoomId = zoomMeetingId.replace(/[\s\-]/g, '');
            zoomLink = `https://zoom.us/j/${cleanZoomId}`;
        }

        if (!isAWSConfigured()) {
            return res.json({
                success: true,
                local: true,
                event: { id: eventId, title, date, category, description, section, zoomMeetingId, zoomLink }
            });
        }

        await docClient.send(new PutCommand({
            TableName: TABLES.USERS,
            Item: {
                pk: 'CALENDAR#EVENTS',
                sk: String(eventId),
                title,
                date,
                category: category || 'meeting',
                description: description || '',
                section: section || 'calendar',
                zoomMeetingId: zoomMeetingId || '',
                zoomLink: zoomLink,
                custom: true,
                createdAt: new Date().toISOString()
            }
        }));

        res.json({
            success: true,
            event: { id: eventId, title, date, category, description, section, zoomMeetingId, zoomLink }
        });
    } catch (error) {
        console.error('Error adding calendar event:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// PUT update single event
// ==========================================
router.put('/event/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, date, category, description, section, location, zoomMeetingId } = req.body;

        if (!title || !date) {
            return res.status(400).json({ error: 'Title and date required' });
        }
        
        // Generate Zoom link from meeting ID if provided
        let zoomLink = '';
        if (zoomMeetingId) {
            const cleanZoomId = zoomMeetingId.replace(/[\s\-]/g, '');
            zoomLink = `https://zoom.us/j/${cleanZoomId}`;
        }

        if (!isAWSConfigured()) {
            return res.json({
                success: true,
                local: true,
                event: { id, title, date, category, description, section, location, zoomMeetingId, zoomLink }
            });
        }

        await docClient.send(new PutCommand({
            TableName: TABLES.USERS,
            Item: {
                pk: 'CALENDAR#EVENTS',
                sk: String(id),
                title,
                date,
                category: category || 'meeting',
                description: description || '',
                section: section || 'calendar',
                location: location || '',
                zoomMeetingId: zoomMeetingId || '',
                zoomLink: zoomLink,
                custom: true,
                updatedAt: new Date().toISOString()
            }
        }));

        res.json({
            success: true,
            event: { id, title, date, category, description, section, location, zoomMeetingId, zoomLink }
        });
    } catch (error) {
        console.error('Error updating calendar event:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// DELETE event
// ==========================================
router.delete('/event/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!isAWSConfigured()) {
            return res.json({ success: true, local: true });
        }

        await docClient.send(new DeleteCommand({
            TableName: TABLES.USERS,
            Key: {
                pk: 'CALENDAR#EVENTS',
                sk: String(id)
            }
        }));

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting calendar event:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// GET upcoming events (next 7 days)
// ==========================================
router.get('/upcoming', async (req, res) => {
    try {
        if (!isAWSConfigured()) {
            return res.json({ events: [], source: 'none' });
        }

        const result = await docClient.send(new ScanCommand({
            TableName: TABLES.USERS,
            FilterExpression: 'begins_with(pk, :pk)',
            ExpressionAttributeValues: { ':pk': 'CALENDAR#' }
        }));

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);

        const events = (result.Items || [])
            .map(item => ({
                id: item.sk,
                title: item.title,
                date: item.date,
                category: item.category,
                section: item.section
            }))
            .filter(event => {
                const eventDate = new Date(event.date);
                eventDate.setHours(0, 0, 0, 0);
                return eventDate >= today && eventDate <= nextWeek;
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        res.json({
            events,
            count: events.length,
            source: 'aws'
        });
    } catch (error) {
        console.error('Error fetching upcoming events:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// POST send calendar via SMS
// ==========================================
router.post('/send-sms', async (req, res) => {
    try {
        const { phoneNumber, eventCount, icsData } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number required' });
        }

        // Clean phone number
        const cleanPhone = phoneNumber.replace(/[^0-9+]/g, '');

        console.log(`📱 SMS Calendar Request: ${cleanPhone} (${eventCount} events)`);

        // Check if Twilio/SNS is configured
        const snsConfigured = process.env.AWS_SNS_TOPIC_ARN || process.env.TWILIO_ACCOUNT_SID;

        if (!snsConfigured) {
            // Return instructions for manual setup
            return res.json({
                success: false,
                message: 'SMS service not configured',
                fallback: true,
                instructions: 'Transfer the downloaded .ics file to your Android device'
            });
        }

        // If AWS SNS is configured, use it
        if (process.env.AWS_SNS_TOPIC_ARN && isAWSConfigured()) {
            const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
            const snsClient = new SNSClient({
                region: process.env.AWS_REGION || 'us-east-2'
            });

            // Create a short message with download link
            const message = `📅 OITH Calendar\n\nYour ${eventCount} calendar events are ready!\n\nTo import into Google Calendar:\n1. Open this link on your device\n2. Choose "Google Calendar"\n3. Confirm import\n\nLink expires in 24h.`;

            await snsClient.send(new PublishCommand({
                PhoneNumber: cleanPhone,
                Message: message,
                MessageAttributes: {
                    'AWS.SNS.SMS.SenderID': {
                        DataType: 'String',
                        StringValue: 'OITH'
                    },
                    'AWS.SNS.SMS.SMSType': {
                        DataType: 'String',
                        StringValue: 'Transactional'
                    }
                }
            }));

            console.log(`✅ SMS sent to ${cleanPhone}`);

            return res.json({
                success: true,
                message: `Calendar sent to ${cleanPhone}`,
                eventCount
            });
        }

        // If Twilio is configured, use it
        if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
            const twilio = require('twilio');
            const client = twilio(
                process.env.TWILIO_ACCOUNT_SID,
                process.env.TWILIO_AUTH_TOKEN
            );

            const message = await client.messages.create({
                body: `📅 OITH Calendar: Your ${eventCount} events are ready! Download the .ics file from your email or the OITH app to add them to your calendar.`,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: cleanPhone
            });

            console.log(`✅ Twilio SMS sent: ${message.sid}`);

            return res.json({
                success: true,
                message: `Calendar notification sent to ${cleanPhone}`,
                messageId: message.sid
            });
        }

        // No SMS service available
        res.json({
            success: false,
            fallback: true,
            message: 'SMS service not configured'
        });

    } catch (error) {
        console.error('Error sending SMS:', error);
        res.status(500).json({ 
            error: error.message,
            fallback: true
        });
    }
});

// ==========================================
// POST send calendar via Email
// ==========================================
router.post('/send-email', async (req, res) => {
    try {
        const { email, eventCount, icsData } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email address required' });
        }

        console.log(`📧 Email Calendar Request: ${email} (${eventCount} events)`);

        // Check if SES is configured
        if (!isAWSConfigured() || !process.env.AWS_SES_FROM_EMAIL) {
            return res.json({
                success: false,
                message: 'Email service not configured',
                fallback: true
            });
        }

        const { SESClient, SendRawEmailCommand } = require('@aws-sdk/client-ses');
        const sesClient = new SESClient({
            region: process.env.AWS_REGION || 'us-east-2'
        });

        // Decode ICS data
        const icsContent = Buffer.from(icsData, 'base64').toString('utf-8');

        // Create MIME email with attachment
        const boundary = `----=_Part_${Date.now()}`;
        const fromEmail = process.env.AWS_SES_FROM_EMAIL || 'calendar@oith.com';

        const rawEmail = [
            `From: OITH Calendar <${fromEmail}>`,
            `To: ${email}`,
            `Subject: OITH Calendar Export - ${eventCount} Events`,
            `MIME-Version: 1.0`,
            `Content-Type: multipart/mixed; boundary="${boundary}"`,
            '',
            `--${boundary}`,
            'Content-Type: text/html; charset=UTF-8',
            '',
            `<!DOCTYPE html>
            <html>
            <head><style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #6366f1, #a855f7); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
                .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
                .event-count { font-size: 48px; font-weight: 700; }
                .btn { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 20px; }
                .instructions { background: white; padding: 20px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #6366f1; }
                .step { display: flex; align-items: center; gap: 12px; margin: 10px 0; }
                .step-num { width: 28px; height: 28px; background: #6366f1; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; }
            </style></head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="event-count">${eventCount}</div>
                        <div>Calendar Events Ready</div>
                    </div>
                    <div class="content">
                        <h2>Your OITH Calendar Export</h2>
                        <p>Your calendar events have been exported and attached to this email as an .ics file.</p>
                        
                        <div class="instructions">
                            <h3 style="margin-top: 0;">📱 To add to Google Calendar (Android):</h3>
                            <div class="step"><span class="step-num">1</span> Download the attached .ics file</div>
                            <div class="step"><span class="step-num">2</span> Open it with Google Calendar</div>
                            <div class="step"><span class="step-num">3</span> Confirm to import all events</div>
                        </div>
                        
                        <div class="instructions">
                            <h3 style="margin-top: 0;">🖥️ To add to Outlook/Apple Calendar:</h3>
                            <div class="step"><span class="step-num">1</span> Double-click the .ics file</div>
                            <div class="step"><span class="step-num">2</span> Your calendar app will open automatically</div>
                            <div class="step"><span class="step-num">3</span> Click "Import" or "Add All"</div>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; margin-top: 30px;">
                            This email was sent from OITH Calendar. If you didn't request this, you can safely ignore it.
                        </p>
                    </div>
                </div>
            </body>
            </html>`,
            '',
            `--${boundary}`,
            'Content-Type: text/calendar; charset=UTF-8; name="OITH_Calendar.ics"',
            'Content-Disposition: attachment; filename="OITH_Calendar.ics"',
            'Content-Transfer-Encoding: base64',
            '',
            icsData,
            '',
            `--${boundary}--`
        ].join('\r\n');

        await sesClient.send(new SendRawEmailCommand({
            RawMessage: { Data: Buffer.from(rawEmail) }
        }));

        console.log(`✅ Email sent to ${email}`);

        res.json({
            success: true,
            message: `Calendar sent to ${email}`,
            eventCount
        });

    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ 
            error: error.message,
            fallback: true
        });
    }
});

// ==========================================
// GET export calendar as ICS file
// ==========================================
router.get('/export.ics', async (req, res) => {
    try {
        const { range, from, to } = req.query;

        let events = [];

        // Try to get events from AWS first
        if (isAWSConfigured()) {
            const result = await docClient.send(new ScanCommand({
                TableName: TABLES.USERS,
                FilterExpression: 'begins_with(pk, :pk)',
                ExpressionAttributeValues: { ':pk': 'CALENDAR#' }
            }));
            events = result.Items || [];
        }

        // Filter by date range if specified
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (range === 'upcoming') {
            events = events.filter(e => new Date(e.date) >= today);
        } else if (range === 'custom' && from && to) {
            const fromDate = new Date(from);
            const toDate = new Date(to);
            events = events.filter(e => {
                const eventDate = new Date(e.date);
                return eventDate >= fromDate && eventDate <= toDate;
            });
        }

        // Generate ICS content
        const formatDate = (dateStr) => {
            const d = new Date(dateStr);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}${month}${day}`;
        };

        let ics = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//OITH LLC//OITH Calendar//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:OITH Launch Calendar'
        ];

        events.forEach(event => {
            const uid = `${event.sk || Date.now()}@oith.com`;
            ics.push('BEGIN:VEVENT');
            ics.push(`UID:${uid}`);
            ics.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
            ics.push(`DTSTART;VALUE=DATE:${formatDate(event.date)}`);
            ics.push(`SUMMARY:${(event.title || '').replace(/,/g, '\\,')}`);
            
            // Build description with Zoom link if present
            let description = event.description || '';
            if (event.zoomLink) {
                description = description ? `${description}\\n\\nZoom Meeting: ${event.zoomLink}` : `Zoom Meeting: ${event.zoomLink}`;
            }
            if (description) {
                ics.push(`DESCRIPTION:${description.replace(/\n/g, '\\n')}`);
            }
            
            // Use Zoom link as location if no physical location
            if (event.location) {
                ics.push(`LOCATION:${event.location.replace(/,/g, '\\,')}`);
            } else if (event.zoomLink) {
                ics.push(`LOCATION:${event.zoomLink}`);
            }
            
            // Add Zoom URL for calendar apps that support it
            if (event.zoomLink) {
                ics.push(`URL:${event.zoomLink}`);
            }
            
            ics.push('END:VEVENT');
        });

        ics.push('END:VCALENDAR');

        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="OITH_Calendar.ics"');
        res.send(ics.join('\r\n'));

    } catch (error) {
        console.error('Error exporting calendar:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

