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
            custom: item.custom
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
        const { id, title, date, category, description, section } = req.body;

        if (!title || !date) {
            return res.status(400).json({ error: 'Title and date required' });
        }

        const eventId = id || `event_${Date.now()}`;

        if (!isAWSConfigured()) {
            return res.json({
                success: true,
                local: true,
                event: { id: eventId, title, date, category, description, section }
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
                custom: true,
                createdAt: new Date().toISOString()
            }
        }));

        res.json({
            success: true,
            event: { id: eventId, title, date, category, description, section }
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
        const { title, date, category, description, section, location } = req.body;

        if (!title || !date) {
            return res.status(400).json({ error: 'Title and date required' });
        }

        if (!isAWSConfigured()) {
            return res.json({
                success: true,
                local: true,
                event: { id, title, date, category, description, section, location }
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
                custom: true,
                updatedAt: new Date().toISOString()
            }
        }));

        res.json({
            success: true,
            event: { id, title, date, category, description, section, location }
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

module.exports = router;

