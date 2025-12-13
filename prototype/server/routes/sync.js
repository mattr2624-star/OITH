/**
 * Sync API Routes
 * Handles full data import/export for migration and backup
 * Supports both AWS DynamoDB and local JSON file storage
 */

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { docClient, TABLES, isAWSConfigured } = require('../aws-config');
const { PutCommand, ScanCommand, BatchWriteCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

// Local storage paths
const LOCAL_SYNC_PATH = path.resolve(__dirname, '../../data/oith_sync_data.json');
const LOCAL_BACKUP_PATH = path.resolve(__dirname, '../../data/oith_sync_backup.json');

/**
 * Load data from local JSON file
 */
async function loadLocalData() {
    try {
        const data = await fs.readFile(LOCAL_SYNC_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return null;
    }
}

/**
 * Save data to local JSON file
 */
async function saveLocalData(data) {
    try {
        const dir = path.dirname(LOCAL_SYNC_PATH);
        await fs.mkdir(dir, { recursive: true });
        
        // Create backup of existing file
        try {
            const existing = await fs.readFile(LOCAL_SYNC_PATH);
            await fs.writeFile(LOCAL_BACKUP_PATH, existing);
        } catch (e) {
            // No existing file to backup
        }
        
        await fs.writeFile(LOCAL_SYNC_PATH, JSON.stringify(data, null, 2));
        console.log('📁 Sync data saved to local file');
        return true;
    } catch (error) {
        console.error('Failed to save local sync data:', error.message);
        return false;
    }
}

// GET full data export
router.get('/export', async (req, res) => {
    try {
        // Try AWS first
        if (isAWSConfigured()) {
            try {
                const result = await docClient.send(new ScanCommand({
                    TableName: TABLES.USERS
                }));
                
                if (result.Items && result.Items.length > 0) {
                    const data = organizeExportData(result.Items);
                    data.source = 'aws';
                    return res.json(data);
                }
            } catch (awsError) {
                console.error('AWS export failed, falling back to local:', awsError.message);
            }
        }
        
        // Fallback to local storage
        const localData = await loadLocalData();
        if (localData) {
            return res.json({
                exportedAt: new Date().toISOString(),
                source: 'local',
                ...localData
            });
        }
        
        return res.json({
            exportedAt: new Date().toISOString(),
            source: 'none',
            message: 'No data found - import data or configure AWS'
        });
    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Helper function to organize AWS data for export
 */
function organizeExportData(items) {
    const data = {
        exportedAt: new Date().toISOString(),
        users: [],
        userData: [],
        documents: [],
        experiments: { history: [], active: [] },
        org: { departments: [], employees: [] },
        payroll: { settings: null, runs: [] },
        calendar: []
    };

    for (const item of items || []) {
        const pk = item.pk;
        
        if (pk.startsWith('USER#')) {
            if (item.sk === 'PROFILE') {
                data.users.push(item);
            } else if (item.sk === 'DATA') {
                data.userData.push(item);
            }
        } else if (pk.startsWith('DOCS#')) {
            data.documents.push(item);
        } else if (pk === 'EXPERIMENTS#HISTORY') {
            data.experiments.history.push(item);
        } else if (pk === 'EXPERIMENTS#ACTIVE') {
            data.experiments.active.push(item);
        } else if (pk === 'ORG#DEPARTMENTS') {
            data.org.departments.push(item);
        } else if (pk === 'ORG#EMPLOYEES') {
            data.org.employees.push(item);
        } else if (pk === 'PAYROLL') {
            if (item.sk === 'SETTINGS') {
                data.payroll.settings = item;
            } else if (item.sk.startsWith('RUN#')) {
                data.payroll.runs.push(item);
            }
        } else if (pk === 'CALENDAR#EVENTS') {
            data.calendar.push(item);
        }
    }
    
    return data;
}

// POST full data import (from localStorage migration)
router.post('/import', async (req, res) => {
    try {
        const { 
            registeredUsers, 
            userData, 
            complianceDocuments,
            patentDocuments,
            experimentHistory,
            activeExperiments,
            orgData,
            payrollData
        } = req.body;

        if (!isAWSConfigured()) {
            return res.json({
                success: false,
                message: 'AWS not configured. Data would be imported to cloud storage.'
            });
        }

        let importedCount = 0;

        // Import registered users
        if (registeredUsers) {
            for (const [email, user] of Object.entries(registeredUsers)) {
                await docClient.send(new PutCommand({
                    TableName: TABLES.USERS,
                    Item: {
                        pk: `USER#${email}`,
                        sk: 'PROFILE',
                        dataType: 'registered_user',
                        email,
                        ...user,
                        importedAt: new Date().toISOString()
                    }
                }));
                importedCount++;
            }
        }

        // Import user data
        if (userData) {
            for (const [email, data] of Object.entries(userData)) {
                await docClient.send(new PutCommand({
                    TableName: TABLES.USERS,
                    Item: {
                        pk: `USER#${email}`,
                        sk: 'DATA',
                        dataType: 'user_data',
                        email,
                        ...data,
                        importedAt: new Date().toISOString()
                    }
                }));
                importedCount++;
            }
        }

        // Import experiment history
        if (experimentHistory && Array.isArray(experimentHistory)) {
            for (const exp of experimentHistory) {
                await docClient.send(new PutCommand({
                    TableName: TABLES.USERS,
                    Item: {
                        pk: 'EXPERIMENTS#HISTORY',
                        sk: `${exp.id}`,
                        ...exp,
                        importedAt: new Date().toISOString()
                    }
                }));
                importedCount++;
            }
        }

        // Import active experiments
        if (activeExperiments && Array.isArray(activeExperiments)) {
            for (const exp of activeExperiments) {
                await docClient.send(new PutCommand({
                    TableName: TABLES.USERS,
                    Item: {
                        pk: 'EXPERIMENTS#ACTIVE',
                        sk: `${exp.id}`,
                        ...exp,
                        importedAt: new Date().toISOString()
                    }
                }));
                importedCount++;
            }
        }

        // Import org data
        if (orgData) {
            if (orgData.departments) {
                for (const dept of orgData.departments) {
                    await docClient.send(new PutCommand({
                        TableName: TABLES.USERS,
                        Item: {
                            pk: 'ORG#DEPARTMENTS',
                            sk: dept.id,
                            ...dept,
                            importedAt: new Date().toISOString()
                        }
                    }));
                    importedCount++;
                }
            }
            if (orgData.employees) {
                for (const emp of orgData.employees) {
                    await docClient.send(new PutCommand({
                        TableName: TABLES.USERS,
                        Item: {
                            pk: 'ORG#EMPLOYEES',
                            sk: `${emp.id}`,
                            ...emp,
                            importedAt: new Date().toISOString()
                        }
                    }));
                    importedCount++;
                }
            }
        }

        // Import payroll data
        if (payrollData) {
            if (payrollData.settings) {
                await docClient.send(new PutCommand({
                    TableName: TABLES.USERS,
                    Item: {
                        pk: 'PAYROLL',
                        sk: 'SETTINGS',
                        ...payrollData.settings,
                        importedAt: new Date().toISOString()
                    }
                }));
                importedCount++;
            }
            if (payrollData.runs) {
                for (const run of payrollData.runs) {
                    await docClient.send(new PutCommand({
                        TableName: TABLES.USERS,
                        Item: {
                            pk: 'PAYROLL',
                            sk: `RUN#${run.id}`,
                            ...run,
                            importedAt: new Date().toISOString()
                        }
                    }));
                    importedCount++;
                }
            }
        }

        res.json({
            success: true,
            importedCount,
            message: `Successfully imported ${importedCount} items to AWS`
        });
    } catch (error) {
        console.error('Error importing data:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST migrate from localStorage
router.post('/migrate-from-local', async (req, res) => {
    try {
        // This endpoint receives all localStorage data and imports it
        const localStorageData = req.body;
        
        if (!isAWSConfigured()) {
            return res.json({
                success: false,
                message: 'AWS not configured. Please set up AWS credentials first.',
                required: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'AWS_S3_BUCKET', 'AWS_DYNAMODB_TABLE']
            });
        }

        let stats = {
            users: 0,
            documents: 0,
            experiments: 0,
            org: 0,
            payroll: 0
        };

        // Process each localStorage key
        for (const [key, value] of Object.entries(localStorageData)) {
            try {
                const data = typeof value === 'string' ? JSON.parse(value) : value;

                if (key === 'oith_registered_users') {
                    for (const [email, user] of Object.entries(data)) {
                        await docClient.send(new PutCommand({
                            TableName: TABLES.USERS,
                            Item: { pk: `USER#${email}`, sk: 'PROFILE', ...user, email }
                        }));
                        stats.users++;
                    }
                } else if (key === 'oith_experiment_history') {
                    for (const exp of data) {
                        await docClient.send(new PutCommand({
                            TableName: TABLES.USERS,
                            Item: { pk: 'EXPERIMENTS#HISTORY', sk: `${exp.id}`, ...exp }
                        }));
                        stats.experiments++;
                    }
                } else if (key === 'oith_active_experiments') {
                    for (const exp of data) {
                        await docClient.send(new PutCommand({
                            TableName: TABLES.USERS,
                            Item: { pk: 'EXPERIMENTS#ACTIVE', sk: `${exp.id}`, ...exp }
                        }));
                        stats.experiments++;
                    }
                } else if (key === 'oith_org_data') {
                    if (data.departments) {
                        for (const dept of data.departments) {
                            await docClient.send(new PutCommand({
                                TableName: TABLES.USERS,
                                Item: { pk: 'ORG#DEPARTMENTS', sk: dept.id, ...dept }
                            }));
                            stats.org++;
                        }
                    }
                    if (data.employees) {
                        for (const emp of data.employees) {
                            await docClient.send(new PutCommand({
                                TableName: TABLES.USERS,
                                Item: { pk: 'ORG#EMPLOYEES', sk: `${emp.id}`, ...emp }
                            }));
                            stats.org++;
                        }
                    }
                } else if (key === 'oith_payroll_data') {
                    if (data.settings) {
                        await docClient.send(new PutCommand({
                            TableName: TABLES.USERS,
                            Item: { pk: 'PAYROLL', sk: 'SETTINGS', ...data.settings }
                        }));
                        stats.payroll++;
                    }
                    if (data.runs) {
                        for (const run of data.runs) {
                            await docClient.send(new PutCommand({
                                TableName: TABLES.USERS,
                                Item: { pk: 'PAYROLL', sk: `RUN#${run.id}`, ...run }
                            }));
                            stats.payroll++;
                        }
                    }
                }
                // Note: Documents with base64 data would need special handling for S3
            } catch (e) {
                console.error(`Error processing ${key}:`, e);
            }
        }

        res.json({
            success: true,
            stats,
            message: 'Migration complete'
        });
    } catch (error) {
        console.error('Error migrating data:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

