/**
 * Organization Hierarchy API Routes
 * Handles employees and departments
 */

const express = require('express');
const router = express.Router();
const { docClient, TABLES, isAWSConfigured } = require('../aws-config');
const { PutCommand, GetCommand, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

// In-memory fallback with default data
let localData = {
    departments: [
        { id: 'exec', name: 'Executive', color: '#8B5CF6' },
        { id: 'eng', name: 'Engineering', color: '#3B82F6' },
        { id: 'product', name: 'Product', color: '#10B981' },
        { id: 'design', name: 'Design', color: '#EC4899' },
        { id: 'marketing', name: 'Marketing', color: '#F59E0B' },
        { id: 'ops', name: 'Operations', color: '#6366F1' },
        { id: 'finance', name: 'Finance', color: '#14B8A6' }
    ],
    employees: [
        { id: 1, name: 'Matt Ross', role: 'CEO & Founder', department: 'exec', reportsTo: null, salary: 150000, startDate: '2024-01-01', email: 'matt@oith.app', status: 'active' }
    ]
};

// GET all org data
router.get('/', async (req, res) => {
    try {
        if (!isAWSConfigured()) {
            return res.json(localData);
        }

        // Get departments
        const deptResult = await docClient.send(new QueryCommand({
            TableName: TABLES.USERS,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: { ':pk': 'ORG#DEPARTMENTS' }
        }));

        // Get employees
        const empResult = await docClient.send(new QueryCommand({
            TableName: TABLES.USERS,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: { ':pk': 'ORG#EMPLOYEES' }
        }));

        res.json({
            departments: deptResult.Items || localData.departments,
            employees: empResult.Items || localData.employees
        });
    } catch (error) {
        console.error('Error fetching org data:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET single employee
router.get('/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!isAWSConfigured()) {
            const emp = localData.employees.find(e => e.id == id);
            return res.json(emp || null);
        }

        const result = await docClient.send(new GetCommand({
            TableName: TABLES.USERS,
            Key: { pk: 'ORG#EMPLOYEES', sk: `${id}` }
        }));

        res.json(result.Item || null);
    } catch (error) {
        console.error('Error fetching employee:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST create/update employee
router.post('/employees', async (req, res) => {
    try {
        const employee = req.body;
        const id = employee.id || Date.now();

        if (!isAWSConfigured()) {
            const idx = localData.employees.findIndex(e => e.id == id);
            if (idx >= 0) {
                localData.employees[idx] = { ...employee, id };
            } else {
                localData.employees.push({ ...employee, id });
            }
            return res.json({ success: true, id });
        }

        await docClient.send(new PutCommand({
            TableName: TABLES.USERS,
            Item: {
                pk: 'ORG#EMPLOYEES',
                sk: `${id}`,
                ...employee,
                id,
                updatedAt: new Date().toISOString()
            }
        }));

        res.json({ success: true, id });
    } catch (error) {
        console.error('Error saving employee:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE employee
router.delete('/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!isAWSConfigured()) {
            localData.employees = localData.employees.filter(e => e.id != id);
            return res.json({ success: true });
        }

        await docClient.send(new DeleteCommand({
            TableName: TABLES.USERS,
            Key: { pk: 'ORG#EMPLOYEES', sk: `${id}` }
        }));

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting employee:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST create/update department
router.post('/departments', async (req, res) => {
    try {
        const department = req.body;
        const id = department.id || `dept-${Date.now()}`;

        if (!isAWSConfigured()) {
            const idx = localData.departments.findIndex(d => d.id === id);
            if (idx >= 0) {
                localData.departments[idx] = { ...department, id };
            } else {
                localData.departments.push({ ...department, id });
            }
            return res.json({ success: true, id });
        }

        await docClient.send(new PutCommand({
            TableName: TABLES.USERS,
            Item: {
                pk: 'ORG#DEPARTMENTS',
                sk: id,
                ...department,
                updatedAt: new Date().toISOString()
            }
        }));

        res.json({ success: true, id });
    } catch (error) {
        console.error('Error saving department:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT bulk update org data
router.put('/', async (req, res) => {
    try {
        const { departments, employees } = req.body;

        if (!isAWSConfigured()) {
            if (departments) localData.departments = departments;
            if (employees) localData.employees = employees;
            return res.json({ success: true });
        }

        // Save all departments
        if (departments) {
            for (const dept of departments) {
                await docClient.send(new PutCommand({
                    TableName: TABLES.USERS,
                    Item: {
                        pk: 'ORG#DEPARTMENTS',
                        sk: dept.id,
                        ...dept,
                        updatedAt: new Date().toISOString()
                    }
                }));
            }
        }

        // Save all employees
        if (employees) {
            for (const emp of employees) {
                await docClient.send(new PutCommand({
                    TableName: TABLES.USERS,
                    Item: {
                        pk: 'ORG#EMPLOYEES',
                        sk: `${emp.id}`,
                        ...emp,
                        updatedAt: new Date().toISOString()
                    }
                }));
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating org data:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

