/**
 * Authentication API Routes
 * Handles login, registration, password reset, and admin user management
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { docClient, TABLES, isAWSConfigured } = require('../aws-config');
const { PutCommand, GetCommand, ScanCommand, DeleteCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

// In-memory fallback when AWS is not configured
let localAdminUsers = {
    'admin@oith.com': {
        email: 'admin@oith.com',
        name: 'Admin User',
        password: hashPassword('admin123'),
        role: 'super_admin',
        createdAt: new Date().toISOString(),
        lastLogin: null,
        isActive: true
    }
};

let passwordResetTokens = {};

// Simple password hashing (use bcrypt in production)
function hashPassword(password) {
    return crypto.createHash('sha256').update(password + 'oith_salt_2024').digest('hex');
}

// Generate secure token
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Generate session token
function generateSessionToken(email) {
    const payload = {
        email,
        timestamp: Date.now(),
        random: crypto.randomBytes(16).toString('hex')
    };
    return Buffer.from(JSON.stringify(payload)).toString('base64');
}

// Validate session token
function validateSessionToken(token) {
    try {
        const payload = JSON.parse(Buffer.from(token, 'base64').toString());
        // Token expires after 24 hours
        if (Date.now() - payload.timestamp > 24 * 60 * 60 * 1000) {
            return null;
        }
        return payload;
    } catch {
        return null;
    }
}

// POST - Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const lowerEmail = email.toLowerCase();
        const hashedPassword = hashPassword(password);

        let user;
        
        if (!isAWSConfigured()) {
            user = localAdminUsers[lowerEmail];
        } else {
            const result = await docClient.send(new GetCommand({
                TableName: TABLES.USERS,
                Key: { pk: `ADMIN#${lowerEmail}`, sk: 'PROFILE' }
            }));
            user = result.Item;
        }

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (user.password !== hashedPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (!user.isActive) {
            return res.status(403).json({ error: 'Account is deactivated' });
        }

        // Update last login
        const now = new Date().toISOString();
        if (!isAWSConfigured()) {
            localAdminUsers[lowerEmail].lastLogin = now;
        } else {
            await docClient.send(new UpdateCommand({
                TableName: TABLES.USERS,
                Key: { pk: `ADMIN#${lowerEmail}`, sk: 'PROFILE' },
                UpdateExpression: 'SET lastLogin = :now',
                ExpressionAttributeValues: { ':now': now }
            }));
        }

        // Generate session token
        const sessionToken = generateSessionToken(lowerEmail);

        res.json({
            success: true,
            message: 'Login successful',
            user: {
                email: user.email,
                name: user.name,
                role: user.role
            },
            token: sessionToken
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST - Register new admin user
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, role = 'admin', creatorToken } = req.body;
        
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, password, and name are required' });
        }

        const lowerEmail = email.toLowerCase();
        
        // Check if user has admin token (super admin bypass)
        let hasAdminToken = false;
        if (creatorToken) {
            const tokenPayload = validateSessionToken(creatorToken);
            if (tokenPayload) {
                let creator;
                if (!isAWSConfigured()) {
                    creator = localAdminUsers[tokenPayload.email];
                } else {
                    const result = await docClient.send(new GetCommand({
                        TableName: TABLES.USERS,
                        Key: { pk: `ADMIN#${tokenPayload.email}`, sk: 'PROFILE' }
                    }));
                    creator = result.Item;
                }
                hasAdminToken = creator && creator.role === 'super_admin';
            }
        }

        // If no admin token, verify employee is in the org hierarchy
        if (!hasAdminToken) {
            let isAuthorizedEmployee = false;
            
            // Check org data for employee
            if (!isAWSConfigured()) {
                // For local mode, we'll allow registration (org data not available)
                isAuthorizedEmployee = true;
            } else {
                try {
                    // Query org data to find employee
                    const orgResult = await docClient.send(new ScanCommand({
                        TableName: TABLES.USERS,
                        FilterExpression: 'dataType = :type',
                        ExpressionAttributeValues: { ':type': 'org_employee' }
                    }));
                    
                    const employees = orgResult.Items || [];
                    isAuthorizedEmployee = employees.some(emp => 
                        emp.email && emp.email.toLowerCase() === lowerEmail && emp.status === 'active'
                    );
                } catch (e) {
                    console.error('Error checking org data:', e);
                    // Allow registration if org check fails
                    isAuthorizedEmployee = true;
                }
            }
            
            if (!isAuthorizedEmployee) {
                return res.status(403).json({ 
                    error: 'This email is not registered in the employee hierarchy. Only authorized employees can create accounts.' 
                });
            }
        }

        // Check if user already exists
        let existingUser;
        if (!isAWSConfigured()) {
            existingUser = localAdminUsers[lowerEmail];
        } else {
            const result = await docClient.send(new GetCommand({
                TableName: TABLES.USERS,
                Key: { pk: `ADMIN#${lowerEmail}`, sk: 'PROFILE' }
            }));
            existingUser = result.Item;
        }

        if (existingUser) {
            return res.status(409).json({ error: 'User already exists' });
        }

        // Create new user
        const newUser = {
            pk: `ADMIN#${lowerEmail}`,
            sk: 'PROFILE',
            dataType: 'admin_user',
            email: lowerEmail,
            name,
            password: hashPassword(password),
            role: role || 'admin',
            createdAt: new Date().toISOString(),
            lastLogin: null,
            isActive: true
        };

        if (!isAWSConfigured()) {
            localAdminUsers[lowerEmail] = newUser;
        } else {
            await docClient.send(new PutCommand({
                TableName: TABLES.USERS,
                Item: newUser
            }));
        }

        res.json({
            success: true,
            message: 'User created successfully',
            user: {
                email: newUser.email,
                name: newUser.name,
                role: newUser.role
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST - Request password reset
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const lowerEmail = email.toLowerCase();

        // Check if user exists
        let user;
        if (!isAWSConfigured()) {
            user = localAdminUsers[lowerEmail];
        } else {
            const result = await docClient.send(new GetCommand({
                TableName: TABLES.USERS,
                Key: { pk: `ADMIN#${lowerEmail}`, sk: 'PROFILE' }
            }));
            user = result.Item;
        }

        // Always return success to prevent email enumeration
        if (!user) {
            return res.json({
                success: true,
                message: 'If an account exists with this email, a reset link will be sent'
            });
        }

        // Generate reset token
        const resetToken = generateToken();
        const expiresAt = Date.now() + (60 * 60 * 1000); // 1 hour

        if (!isAWSConfigured()) {
            passwordResetTokens[resetToken] = {
                email: lowerEmail,
                expiresAt
            };
        } else {
            await docClient.send(new PutCommand({
                TableName: TABLES.USERS,
                Item: {
                    pk: `RESET#${resetToken}`,
                    sk: 'TOKEN',
                    email: lowerEmail,
                    expiresAt,
                    createdAt: new Date().toISOString()
                }
            }));
        }

        // In production, send email here
        // For now, return the token (development only)
        res.json({
            success: true,
            message: 'If an account exists with this email, a reset link will be sent',
            // DEV ONLY - Remove in production
            _devToken: resetToken,
            _devNote: 'Token shown for development. In production, this would be emailed.'
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST - Reset password with token
router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        
        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        let resetData;
        if (!isAWSConfigured()) {
            resetData = passwordResetTokens[token];
        } else {
            const result = await docClient.send(new GetCommand({
                TableName: TABLES.USERS,
                Key: { pk: `RESET#${token}`, sk: 'TOKEN' }
            }));
            resetData = result.Item;
        }

        if (!resetData) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        if (Date.now() > resetData.expiresAt) {
            // Clean up expired token
            if (!isAWSConfigured()) {
                delete passwordResetTokens[token];
            } else {
                await docClient.send(new DeleteCommand({
                    TableName: TABLES.USERS,
                    Key: { pk: `RESET#${token}`, sk: 'TOKEN' }
                }));
            }
            return res.status(400).json({ error: 'Reset token has expired' });
        }

        // Update password
        const hashedPassword = hashPassword(newPassword);
        
        if (!isAWSConfigured()) {
            if (localAdminUsers[resetData.email]) {
                localAdminUsers[resetData.email].password = hashedPassword;
            }
            delete passwordResetTokens[token];
        } else {
            await docClient.send(new UpdateCommand({
                TableName: TABLES.USERS,
                Key: { pk: `ADMIN#${resetData.email}`, sk: 'PROFILE' },
                UpdateExpression: 'SET password = :password',
                ExpressionAttributeValues: { ':password': hashedPassword }
            }));

            // Delete reset token
            await docClient.send(new DeleteCommand({
                TableName: TABLES.USERS,
                Key: { pk: `RESET#${token}`, sk: 'TOKEN' }
            }));
        }

        res.json({
            success: true,
            message: 'Password reset successfully'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Validate session token
router.get('/validate', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const payload = validateSessionToken(token);

        if (!payload) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Get user details
        let user;
        if (!isAWSConfigured()) {
            user = localAdminUsers[payload.email];
        } else {
            const result = await docClient.send(new GetCommand({
                TableName: TABLES.USERS,
                Key: { pk: `ADMIN#${payload.email}`, sk: 'PROFILE' }
            }));
            user = result.Item;
        }

        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'User not found or inactive' });
        }

        res.json({
            valid: true,
            user: {
                email: user.email,
                name: user.name,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Token validation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - List all admin users (super_admin only)
router.get('/users', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const payload = validateSessionToken(token);

        if (!payload) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Check if requester is super_admin
        let requester;
        if (!isAWSConfigured()) {
            requester = localAdminUsers[payload.email];
        } else {
            const result = await docClient.send(new GetCommand({
                TableName: TABLES.USERS,
                Key: { pk: `ADMIN#${payload.email}`, sk: 'PROFILE' }
            }));
            requester = result.Item;
        }

        if (!requester || requester.role !== 'super_admin') {
            return res.status(403).json({ error: 'Only super admins can view all users' });
        }

        // Get all admin users
        let users = [];
        if (!isAWSConfigured()) {
            users = Object.values(localAdminUsers).map(u => ({
                email: u.email,
                name: u.name,
                role: u.role,
                createdAt: u.createdAt,
                lastLogin: u.lastLogin,
                isActive: u.isActive
            }));
        } else {
            const result = await docClient.send(new ScanCommand({
                TableName: TABLES.USERS,
                FilterExpression: 'dataType = :type',
                ExpressionAttributeValues: { ':type': 'admin_user' }
            }));

            users = result.Items?.map(u => ({
                email: u.email,
                name: u.name,
                role: u.role,
                createdAt: u.createdAt,
                lastLogin: u.lastLogin,
                isActive: u.isActive
            })) || [];
        }

        res.json({ users });

    } catch (error) {
        console.error('List users error:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT - Update admin user (super_admin only)
router.put('/users/:email', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const payload = validateSessionToken(token);

        if (!payload) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        const targetEmail = req.params.email.toLowerCase();
        const { name, role, isActive, password } = req.body;

        // Check if requester is super_admin or updating own profile
        let requester;
        if (!isAWSConfigured()) {
            requester = localAdminUsers[payload.email];
        } else {
            const result = await docClient.send(new GetCommand({
                TableName: TABLES.USERS,
                Key: { pk: `ADMIN#${payload.email}`, sk: 'PROFILE' }
            }));
            requester = result.Item;
        }

        const isSelf = payload.email === targetEmail;
        const isSuperAdmin = requester && requester.role === 'super_admin';

        if (!isSelf && !isSuperAdmin) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        // Build update
        const updates = {};
        if (name) updates.name = name;
        if (isSuperAdmin && role) updates.role = role;
        if (isSuperAdmin && typeof isActive === 'boolean') updates.isActive = isActive;
        if (password) updates.password = hashPassword(password);

        if (!isAWSConfigured()) {
            if (!localAdminUsers[targetEmail]) {
                return res.status(404).json({ error: 'User not found' });
            }
            Object.assign(localAdminUsers[targetEmail], updates);
        } else {
            const updateExpressions = [];
            const expressionValues = {};

            Object.entries(updates).forEach(([key, value]) => {
                updateExpressions.push(`${key} = :${key}`);
                expressionValues[`:${key}`] = value;
            });

            if (updateExpressions.length > 0) {
                await docClient.send(new UpdateCommand({
                    TableName: TABLES.USERS,
                    Key: { pk: `ADMIN#${targetEmail}`, sk: 'PROFILE' },
                    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
                    ExpressionAttributeValues: expressionValues
                }));
            }
        }

        res.json({
            success: true,
            message: 'User updated successfully'
        });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE - Delete admin user (super_admin only)
router.delete('/users/:email', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const payload = validateSessionToken(token);

        if (!payload) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        const targetEmail = req.params.email.toLowerCase();

        // Check if requester is super_admin
        let requester;
        if (!isAWSConfigured()) {
            requester = localAdminUsers[payload.email];
        } else {
            const result = await docClient.send(new GetCommand({
                TableName: TABLES.USERS,
                Key: { pk: `ADMIN#${payload.email}`, sk: 'PROFILE' }
            }));
            requester = result.Item;
        }

        if (!requester || requester.role !== 'super_admin') {
            return res.status(403).json({ error: 'Only super admins can delete users' });
        }

        // Prevent deleting self
        if (payload.email === targetEmail) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        if (!isAWSConfigured()) {
            delete localAdminUsers[targetEmail];
        } else {
            await docClient.send(new DeleteCommand({
                TableName: TABLES.USERS,
                Key: { pk: `ADMIN#${targetEmail}`, sk: 'PROFILE' }
            }));
        }

        res.json({
            success: true,
            message: 'User deleted successfully'
        });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST - Change own password
router.post('/change-password', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const payload = validateSessionToken(token);

        if (!payload) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }

        // Get user
        let user;
        if (!isAWSConfigured()) {
            user = localAdminUsers[payload.email];
        } else {
            const result = await docClient.send(new GetCommand({
                TableName: TABLES.USERS,
                Key: { pk: `ADMIN#${payload.email}`, sk: 'PROFILE' }
            }));
            user = result.Item;
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        if (user.password !== hashPassword(currentPassword)) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Update password
        const hashedNewPassword = hashPassword(newPassword);

        if (!isAWSConfigured()) {
            localAdminUsers[payload.email].password = hashedNewPassword;
        } else {
            await docClient.send(new UpdateCommand({
                TableName: TABLES.USERS,
                Key: { pk: `ADMIN#${payload.email}`, sk: 'PROFILE' },
                UpdateExpression: 'SET password = :password',
                ExpressionAttributeValues: { ':password': hashedNewPassword }
            }));
        }

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

