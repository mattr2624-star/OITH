/**
 * Payroll API Routes
 * Handles payroll runs and settings
 */

const express = require('express');
const router = express.Router();
const { docClient, TABLES, isAWSConfigured } = require('../aws-config');
const { PutCommand, GetCommand, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

// In-memory fallback
let localData = {
    runs: [],
    settings: {
        payFrequency: 'biweekly',
        lastPayDate: null,
        nextPayDate: null
    }
};

// GET payroll data
router.get('/', async (req, res) => {
    try {
        if (!isAWSConfigured()) {
            return res.json(localData);
        }

        // Get settings
        const settingsResult = await docClient.send(new GetCommand({
            TableName: TABLES.USERS,
            Key: { pk: 'PAYROLL', sk: 'SETTINGS' }
        }));

        // Get runs
        const runsResult = await docClient.send(new QueryCommand({
            TableName: TABLES.USERS,
            KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
            ExpressionAttributeValues: { 
                ':pk': 'PAYROLL',
                ':sk': 'RUN#'
            },
            ScanIndexForward: false
        }));

        res.json({
            settings: settingsResult.Item || localData.settings,
            runs: runsResult.Items || []
        });
    } catch (error) {
        console.error('Error fetching payroll data:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET payroll runs only
router.get('/runs', async (req, res) => {
    try {
        if (!isAWSConfigured()) {
            return res.json(localData.runs);
        }

        const result = await docClient.send(new QueryCommand({
            TableName: TABLES.USERS,
            KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
            ExpressionAttributeValues: { 
                ':pk': 'PAYROLL',
                ':sk': 'RUN#'
            },
            ScanIndexForward: false
        }));

        res.json(result.Items || []);
    } catch (error) {
        console.error('Error fetching payroll runs:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST create payroll run
router.post('/runs', async (req, res) => {
    try {
        const run = req.body;
        const id = run.id || Date.now();

        if (!isAWSConfigured()) {
            localData.runs.unshift({ ...run, id });
            return res.json({ success: true, id });
        }

        await docClient.send(new PutCommand({
            TableName: TABLES.USERS,
            Item: {
                pk: 'PAYROLL',
                sk: `RUN#${id}`,
                ...run,
                id,
                createdAt: new Date().toISOString()
            }
        }));

        res.json({ success: true, id });
    } catch (error) {
        console.error('Error creating payroll run:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT update settings
router.put('/settings', async (req, res) => {
    try {
        const settings = req.body;

        if (!isAWSConfigured()) {
            localData.settings = { ...localData.settings, ...settings };
            return res.json({ success: true });
        }

        await docClient.send(new PutCommand({
            TableName: TABLES.USERS,
            Item: {
                pk: 'PAYROLL',
                sk: 'SETTINGS',
                ...settings,
                updatedAt: new Date().toISOString()
            }
        }));

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating payroll settings:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT bulk update payroll data
router.put('/', async (req, res) => {
    try {
        const { settings, runs } = req.body;

        if (!isAWSConfigured()) {
            if (settings) localData.settings = settings;
            if (runs) localData.runs = runs;
            return res.json({ success: true });
        }

        // Save settings
        if (settings) {
            await docClient.send(new PutCommand({
                TableName: TABLES.USERS,
                Item: {
                    pk: 'PAYROLL',
                    sk: 'SETTINGS',
                    ...settings,
                    updatedAt: new Date().toISOString()
                }
            }));
        }

        // Save runs
        if (runs) {
            for (const run of runs) {
                await docClient.send(new PutCommand({
                    TableName: TABLES.USERS,
                    Item: {
                        pk: 'PAYROLL',
                        sk: `RUN#${run.id}`,
                        ...run,
                        updatedAt: new Date().toISOString()
                    }
                }));
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating payroll data:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

