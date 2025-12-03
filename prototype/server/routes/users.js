/**
 * Users API Routes
 * Handles registered users and user data
 */

const express = require('express');
const router = express.Router();
const { docClient, TABLES, isAWSConfigured } = require('../aws-config');
const { PutCommand, GetCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

// In-memory fallback when AWS is not configured
let localData = {
    registeredUsers: {},
    userData: {}
};

// GET all registered users
router.get('/', async (req, res) => {
    try {
        if (!isAWSConfigured()) {
            return res.json(localData.registeredUsers);
        }

        const result = await docClient.send(new ScanCommand({
            TableName: TABLES.USERS,
            FilterExpression: 'dataType = :type',
            ExpressionAttributeValues: { ':type': 'registered_user' }
        }));

        const users = {};
        result.Items?.forEach(item => {
            users[item.email] = {
                name: item.name,
                password: item.password,
                registeredAt: item.registeredAt
            };
        });

        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET single user
router.get('/:email', async (req, res) => {
    try {
        const email = req.params.email.toLowerCase();

        if (!isAWSConfigured()) {
            const user = localData.registeredUsers[email];
            const userData = localData.userData[email];
            return res.json({ user, userData });
        }

        const userResult = await docClient.send(new GetCommand({
            TableName: TABLES.USERS,
            Key: { pk: `USER#${email}`, sk: 'PROFILE' }
        }));

        const dataResult = await docClient.send(new GetCommand({
            TableName: TABLES.USERS,
            Key: { pk: `USER#${email}`, sk: 'DATA' }
        }));

        res.json({
            user: userResult.Item,
            userData: dataResult.Item
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST create/update user
router.post('/', async (req, res) => {
    try {
        const { email, name, password, userData } = req.body;
        const lowerEmail = email.toLowerCase();

        if (!isAWSConfigured()) {
            localData.registeredUsers[lowerEmail] = {
                name,
                password,
                registeredAt: new Date().toISOString()
            };
            if (userData) {
                localData.userData[lowerEmail] = userData;
            }
            return res.json({ success: true, message: 'User saved (local mode)' });
        }

        // Save user profile
        await docClient.send(new PutCommand({
            TableName: TABLES.USERS,
            Item: {
                pk: `USER#${lowerEmail}`,
                sk: 'PROFILE',
                dataType: 'registered_user',
                email: lowerEmail,
                name,
                password,
                registeredAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        }));

        // Save user data if provided
        if (userData) {
            await docClient.send(new PutCommand({
                TableName: TABLES.USERS,
                Item: {
                    pk: `USER#${lowerEmail}`,
                    sk: 'DATA',
                    dataType: 'user_data',
                    email: lowerEmail,
                    ...userData,
                    updatedAt: new Date().toISOString()
                }
            }));
        }

        res.json({ success: true, message: 'User saved to AWS' });
    } catch (error) {
        console.error('Error saving user:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE user
router.delete('/:email', async (req, res) => {
    try {
        const email = req.params.email.toLowerCase();

        if (!isAWSConfigured()) {
            delete localData.registeredUsers[email];
            delete localData.userData[email];
            return res.json({ success: true, message: 'User deleted (local mode)' });
        }

        await docClient.send(new DeleteCommand({
            TableName: TABLES.USERS,
            Key: { pk: `USER#${email}`, sk: 'PROFILE' }
        }));

        await docClient.send(new DeleteCommand({
            TableName: TABLES.USERS,
            Key: { pk: `USER#${email}`, sk: 'DATA' }
        }));

        res.json({ success: true, message: 'User deleted from AWS' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: error.message });
    }
});

// Bulk import users
router.post('/bulk', async (req, res) => {
    try {
        const { registeredUsers, userData } = req.body;

        if (!isAWSConfigured()) {
            localData.registeredUsers = { ...localData.registeredUsers, ...registeredUsers };
            localData.userData = { ...localData.userData, ...userData };
            return res.json({ 
                success: true, 
                imported: Object.keys(registeredUsers).length,
                message: 'Bulk import complete (local mode)' 
            });
        }

        let count = 0;
        for (const [email, user] of Object.entries(registeredUsers)) {
            await docClient.send(new PutCommand({
                TableName: TABLES.USERS,
                Item: {
                    pk: `USER#${email}`,
                    sk: 'PROFILE',
                    dataType: 'registered_user',
                    email,
                    ...user,
                    updatedAt: new Date().toISOString()
                }
            }));

            if (userData[email]) {
                await docClient.send(new PutCommand({
                    TableName: TABLES.USERS,
                    Item: {
                        pk: `USER#${email}`,
                        sk: 'DATA',
                        dataType: 'user_data',
                        email,
                        ...userData[email],
                        updatedAt: new Date().toISOString()
                    }
                }));
            }
            count++;
        }

        res.json({ success: true, imported: count, message: 'Bulk import to AWS complete' });
    } catch (error) {
        console.error('Error bulk importing:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

