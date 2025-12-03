/**
 * Experiments API Routes
 * Handles experiment history and active experiments
 */

const express = require('express');
const router = express.Router();
const { docClient, TABLES, isAWSConfigured } = require('../aws-config');
const { PutCommand, GetCommand, QueryCommand, DeleteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

// In-memory fallback
let localData = {
    history: [],
    active: []
};

// GET experiment history
router.get('/history', async (req, res) => {
    try {
        if (!isAWSConfigured()) {
            return res.json(localData.history);
        }

        const result = await docClient.send(new QueryCommand({
            TableName: TABLES.USERS,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: { ':pk': 'EXPERIMENTS#HISTORY' },
            ScanIndexForward: false // Most recent first
        }));

        res.json(result.Items || []);
    } catch (error) {
        console.error('Error fetching experiment history:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET active experiments
router.get('/active', async (req, res) => {
    try {
        if (!isAWSConfigured()) {
            return res.json(localData.active);
        }

        const result = await docClient.send(new QueryCommand({
            TableName: TABLES.USERS,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: { ':pk': 'EXPERIMENTS#ACTIVE' }
        }));

        res.json(result.Items || []);
    } catch (error) {
        console.error('Error fetching active experiments:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST save experiment to history
router.post('/history', async (req, res) => {
    try {
        const experiment = req.body;

        if (!isAWSConfigured()) {
            experiment.id = Date.now();
            localData.history.unshift(experiment);
            if (localData.history.length > 20) localData.history.pop();
            return res.json({ success: true, id: experiment.id });
        }

        const id = experiment.id || Date.now();
        await docClient.send(new PutCommand({
            TableName: TABLES.USERS,
            Item: {
                pk: 'EXPERIMENTS#HISTORY',
                sk: `${id}`,
                ...experiment,
                id,
                savedAt: new Date().toISOString()
            }
        }));

        res.json({ success: true, id });
    } catch (error) {
        console.error('Error saving experiment:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST create/update active experiment
router.post('/active', async (req, res) => {
    try {
        const experiment = req.body;

        if (!isAWSConfigured()) {
            experiment.id = experiment.id || Date.now();
            const idx = localData.active.findIndex(e => e.id === experiment.id);
            if (idx >= 0) {
                localData.active[idx] = experiment;
            } else {
                localData.active.push(experiment);
            }
            return res.json({ success: true, id: experiment.id });
        }

        const id = experiment.id || Date.now();
        await docClient.send(new PutCommand({
            TableName: TABLES.USERS,
            Item: {
                pk: 'EXPERIMENTS#ACTIVE',
                sk: `${id}`,
                ...experiment,
                id,
                updatedAt: new Date().toISOString()
            }
        }));

        res.json({ success: true, id });
    } catch (error) {
        console.error('Error saving active experiment:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT update active experiment (e.g., end it)
router.put('/active/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (!isAWSConfigured()) {
            const idx = localData.active.findIndex(e => e.id == id);
            if (idx >= 0) {
                localData.active[idx] = { ...localData.active[idx], ...updates };
            }
            return res.json({ success: true });
        }

        // Get existing experiment
        const result = await docClient.send(new GetCommand({
            TableName: TABLES.USERS,
            Key: { pk: 'EXPERIMENTS#ACTIVE', sk: id }
        }));

        if (!result.Item) {
            return res.status(404).json({ error: 'Experiment not found' });
        }

        // Update it
        await docClient.send(new PutCommand({
            TableName: TABLES.USERS,
            Item: {
                ...result.Item,
                ...updates,
                updatedAt: new Date().toISOString()
            }
        }));

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating experiment:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE active experiment
router.delete('/active/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!isAWSConfigured()) {
            localData.active = localData.active.filter(e => e.id != id);
            return res.json({ success: true });
        }

        await docClient.send(new DeleteCommand({
            TableName: TABLES.USERS,
            Key: { pk: 'EXPERIMENTS#ACTIVE', sk: id }
        }));

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting experiment:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE all history
router.delete('/history', async (req, res) => {
    try {
        if (!isAWSConfigured()) {
            localData.history = [];
            return res.json({ success: true });
        }

        // Get all history items
        const result = await docClient.send(new QueryCommand({
            TableName: TABLES.USERS,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: { ':pk': 'EXPERIMENTS#HISTORY' }
        }));

        // Delete each one
        for (const item of result.Items || []) {
            await docClient.send(new DeleteCommand({
                TableName: TABLES.USERS,
                Key: { pk: 'EXPERIMENTS#HISTORY', sk: item.sk }
            }));
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error clearing history:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

