/**
 * AWS Lambda Function for OITH Authentication
 * Handles: login, registration, password reset, session validation
 * 
 * Endpoints:
 *   POST /auth/login - Authenticate user
 *   POST /auth/register - Create new admin user
 *   GET  /auth/validate - Validate session token
 *   POST /auth/forgot-password - Request password reset
 *   POST /auth/reset-password - Reset password with token
 *   GET  /auth/users - List all admin users (super_admin only)
 *   PUT  /auth/users/{email} - Update admin user
 *   DELETE /auth/users/{email} - Delete admin user
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createHash, randomBytes } from 'crypto';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Table for admin users (uses the company/admin table)
const TABLE_NAME = process.env.DYNAMODB_TABLE || 'oith-users';

// CORS headers
const HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Hash password using SHA-256 (matches local server)
 */
function hashPassword(password) {
    return createHash('sha256').update(password + 'oith_salt_2024').digest('hex');
}

/**
 * Generate secure random token
 */
function generateToken() {
    return randomBytes(32).toString('hex');
}

/**
 * Generate session token (base64 encoded JSON)
 */
function generateSessionToken(email) {
    const payload = {
        email,
        timestamp: Date.now(),
        random: randomBytes(16).toString('hex')
    };
    return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Validate session token
 * @returns {object|null} payload if valid, null if invalid/expired
 */
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

/**
 * Extract bearer token from Authorization header
 */
function extractBearerToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.split(' ')[1];
}

/**
 * Send JSON response
 */
function response(statusCode, body) {
    return {
        statusCode,
        headers: HEADERS,
        body: JSON.stringify(body)
    };
}

// ==========================================
// AUTH HANDLERS
// ==========================================

/**
 * POST /auth/login - Authenticate user
 */
async function handleLogin(body) {
    const { email, password } = body || {};
    
    if (!email || !password) {
        return response(400, { error: 'Email and password required' });
    }
    
    const lowerEmail = email.toLowerCase();
    const hashedPassword = hashPassword(password);
    
    try {
        // Get user from DynamoDB
        const result = await docClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { pk: `ADMIN#${lowerEmail}`, sk: 'PROFILE' }
        }));
        
        const user = result.Item;
        
        if (!user) {
            return response(401, { error: 'Invalid email or password' });
        }
        
        if (user.password !== hashedPassword) {
            return response(401, { error: 'Invalid email or password' });
        }
        
        if (user.isActive === false) {
            return response(403, { error: 'Account is deactivated' });
        }
        
        // Update last login
        const now = new Date().toISOString();
        await docClient.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { pk: `ADMIN#${lowerEmail}`, sk: 'PROFILE' },
            UpdateExpression: 'SET lastLogin = :now',
            ExpressionAttributeValues: { ':now': now }
        }));
        
        // Generate session token
        const sessionToken = generateSessionToken(lowerEmail);
        
        console.log(`✅ Login successful: ${lowerEmail}`);
        
        return response(200, {
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
        return response(500, { error: 'Internal server error' });
    }
}

/**
 * POST /auth/register - Create new admin user
 */
async function handleRegister(body) {
    const { email, password, name, role = 'admin', creatorToken } = body || {};
    
    if (!email || !password || !name) {
        return response(400, { error: 'Email, password, and name are required' });
    }
    
    if (password.length < 6) {
        return response(400, { error: 'Password must be at least 6 characters' });
    }
    
    const lowerEmail = email.toLowerCase();
    
    try {
        // Check if user has admin token (super admin bypass)
        let hasAdminToken = false;
        if (creatorToken) {
            const tokenPayload = validateSessionToken(creatorToken);
            if (tokenPayload) {
                const creatorResult = await docClient.send(new GetCommand({
                    TableName: TABLE_NAME,
                    Key: { pk: `ADMIN#${tokenPayload.email}`, sk: 'PROFILE' }
                }));
                hasAdminToken = creatorResult.Item?.role === 'super_admin';
            }
        }
        
        // If no admin token, verify employee is in the org hierarchy
        if (!hasAdminToken) {
            let isAuthorizedEmployee = false;
            
            try {
                // Query org data to find employee
                const orgResult = await docClient.send(new ScanCommand({
                    TableName: TABLE_NAME,
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
            
            if (!isAuthorizedEmployee) {
                return response(403, { 
                    error: 'This email is not registered in the employee hierarchy. Only authorized employees can create accounts.' 
                });
            }
        }
        
        // Check if user already exists
        const existingResult = await docClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { pk: `ADMIN#${lowerEmail}`, sk: 'PROFILE' }
        }));
        
        if (existingResult.Item) {
            return response(409, { error: 'User already exists' });
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
        
        await docClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: newUser
        }));
        
        console.log(`✅ User registered: ${lowerEmail}`);
        
        return response(200, {
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
        return response(500, { error: 'Internal server error' });
    }
}

/**
 * GET /auth/validate - Validate session token
 */
async function handleValidate(authHeader) {
    const token = extractBearerToken(authHeader);
    
    if (!token) {
        return response(401, { error: 'No token provided', valid: false });
    }
    
    const payload = validateSessionToken(token);
    
    if (!payload) {
        return response(401, { error: 'Invalid or expired token', valid: false });
    }
    
    try {
        // Get user details
        const result = await docClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { pk: `ADMIN#${payload.email}`, sk: 'PROFILE' }
        }));
        
        const user = result.Item;
        
        if (!user || user.isActive === false) {
            return response(401, { error: 'User not found or inactive', valid: false });
        }
        
        return response(200, {
            valid: true,
            user: {
                email: user.email,
                name: user.name,
                role: user.role
            }
        });
        
    } catch (error) {
        console.error('Token validation error:', error);
        return response(500, { error: 'Internal server error', valid: false });
    }
}

/**
 * POST /auth/forgot-password - Request password reset
 */
async function handleForgotPassword(body) {
    const { email } = body || {};
    
    if (!email) {
        return response(400, { error: 'Email is required' });
    }
    
    const lowerEmail = email.toLowerCase();
    
    try {
        // Check if user exists
        const result = await docClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { pk: `ADMIN#${lowerEmail}`, sk: 'PROFILE' }
        }));
        
        // Always return success to prevent email enumeration
        if (!result.Item) {
            return response(200, {
                success: true,
                message: 'If an account exists with this email, a reset link will be sent'
            });
        }
        
        // Generate reset token
        const resetToken = generateToken();
        const expiresAt = Date.now() + (60 * 60 * 1000); // 1 hour
        
        // Store reset token
        await docClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                pk: `RESET#${resetToken}`,
                sk: 'TOKEN',
                email: lowerEmail,
                expiresAt,
                createdAt: new Date().toISOString()
            }
        }));
        
        console.log(`🔑 Password reset token generated for: ${lowerEmail}`);
        
        // In production, send email here
        // For now, return the token (development only)
        return response(200, {
            success: true,
            message: 'If an account exists with this email, a reset link will be sent',
            // DEV ONLY - Remove in production
            _devToken: resetToken,
            _devNote: 'Token shown for development. In production, this would be emailed.'
        });
        
    } catch (error) {
        console.error('Forgot password error:', error);
        return response(500, { error: 'Internal server error' });
    }
}

/**
 * POST /auth/reset-password - Reset password with token
 */
async function handleResetPassword(body) {
    const { token, newPassword } = body || {};
    
    if (!token || !newPassword) {
        return response(400, { error: 'Token and new password required' });
    }
    
    if (newPassword.length < 6) {
        return response(400, { error: 'Password must be at least 6 characters' });
    }
    
    try {
        // Get reset token data
        const result = await docClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { pk: `RESET#${token}`, sk: 'TOKEN' }
        }));
        
        const resetData = result.Item;
        
        if (!resetData) {
            return response(400, { error: 'Invalid or expired reset token' });
        }
        
        if (Date.now() > resetData.expiresAt) {
            // Clean up expired token
            await docClient.send(new DeleteCommand({
                TableName: TABLE_NAME,
                Key: { pk: `RESET#${token}`, sk: 'TOKEN' }
            }));
            return response(400, { error: 'Reset token has expired' });
        }
        
        // Update password
        const hashedPassword = hashPassword(newPassword);
        
        await docClient.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { pk: `ADMIN#${resetData.email}`, sk: 'PROFILE' },
            UpdateExpression: 'SET password = :password',
            ExpressionAttributeValues: { ':password': hashedPassword }
        }));
        
        // Delete reset token
        await docClient.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { pk: `RESET#${token}`, sk: 'TOKEN' }
        }));
        
        console.log(`✅ Password reset successful: ${resetData.email}`);
        
        return response(200, {
            success: true,
            message: 'Password reset successfully'
        });
        
    } catch (error) {
        console.error('Reset password error:', error);
        return response(500, { error: 'Internal server error' });
    }
}

/**
 * GET /auth/users - List all admin users (super_admin only)
 */
async function handleListUsers(authHeader) {
    const token = extractBearerToken(authHeader);
    
    if (!token) {
        return response(401, { error: 'No token provided' });
    }
    
    const payload = validateSessionToken(token);
    
    if (!payload) {
        return response(401, { error: 'Invalid or expired token' });
    }
    
    try {
        // Check if requester is super_admin
        const requesterResult = await docClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { pk: `ADMIN#${payload.email}`, sk: 'PROFILE' }
        }));
        
        const requester = requesterResult.Item;
        
        if (!requester || requester.role !== 'super_admin') {
            return response(403, { error: 'Only super admins can view all users' });
        }
        
        // Get all admin users
        const result = await docClient.send(new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: 'dataType = :type',
            ExpressionAttributeValues: { ':type': 'admin_user' }
        }));
        
        const users = (result.Items || []).map(u => ({
            email: u.email,
            name: u.name,
            role: u.role,
            createdAt: u.createdAt,
            lastLogin: u.lastLogin,
            isActive: u.isActive
        }));
        
        return response(200, { users });
        
    } catch (error) {
        console.error('List users error:', error);
        return response(500, { error: 'Internal server error' });
    }
}

/**
 * PUT /auth/users/{email} - Update admin user
 */
async function handleUpdateUser(authHeader, targetEmail, body) {
    const token = extractBearerToken(authHeader);
    
    if (!token) {
        return response(401, { error: 'No token provided' });
    }
    
    const payload = validateSessionToken(token);
    
    if (!payload) {
        return response(401, { error: 'Invalid or expired token' });
    }
    
    const lowerTargetEmail = targetEmail.toLowerCase();
    const { name, role, isActive, password } = body || {};
    
    try {
        // Check if requester is super_admin or updating own profile
        const requesterResult = await docClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { pk: `ADMIN#${payload.email}`, sk: 'PROFILE' }
        }));
        
        const requester = requesterResult.Item;
        const isSelf = payload.email === lowerTargetEmail;
        const isSuperAdmin = requester && requester.role === 'super_admin';
        
        if (!isSelf && !isSuperAdmin) {
            return response(403, { error: 'Permission denied' });
        }
        
        // Build update expression
        const updateExpressions = [];
        const expressionValues = {};
        
        if (name) {
            updateExpressions.push('name = :name');
            expressionValues[':name'] = name;
        }
        if (isSuperAdmin && role) {
            updateExpressions.push('role = :role');
            expressionValues[':role'] = role;
        }
        if (isSuperAdmin && typeof isActive === 'boolean') {
            updateExpressions.push('isActive = :isActive');
            expressionValues[':isActive'] = isActive;
        }
        if (password) {
            updateExpressions.push('password = :password');
            expressionValues[':password'] = hashPassword(password);
        }
        
        if (updateExpressions.length > 0) {
            await docClient.send(new UpdateCommand({
                TableName: TABLE_NAME,
                Key: { pk: `ADMIN#${lowerTargetEmail}`, sk: 'PROFILE' },
                UpdateExpression: `SET ${updateExpressions.join(', ')}`,
                ExpressionAttributeValues: expressionValues
            }));
        }
        
        console.log(`✅ User updated: ${lowerTargetEmail}`);
        
        return response(200, {
            success: true,
            message: 'User updated successfully'
        });
        
    } catch (error) {
        console.error('Update user error:', error);
        return response(500, { error: 'Internal server error' });
    }
}

/**
 * DELETE /auth/users/{email} - Delete admin user
 */
async function handleDeleteUser(authHeader, targetEmail) {
    const token = extractBearerToken(authHeader);
    
    if (!token) {
        return response(401, { error: 'No token provided' });
    }
    
    const payload = validateSessionToken(token);
    
    if (!payload) {
        return response(401, { error: 'Invalid or expired token' });
    }
    
    const lowerTargetEmail = targetEmail.toLowerCase();
    
    try {
        // Check if requester is super_admin
        const requesterResult = await docClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { pk: `ADMIN#${payload.email}`, sk: 'PROFILE' }
        }));
        
        const requester = requesterResult.Item;
        
        if (!requester || requester.role !== 'super_admin') {
            return response(403, { error: 'Only super admins can delete users' });
        }
        
        // Prevent deleting self
        if (payload.email === lowerTargetEmail) {
            return response(400, { error: 'Cannot delete your own account' });
        }
        
        await docClient.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { pk: `ADMIN#${lowerTargetEmail}`, sk: 'PROFILE' }
        }));
        
        console.log(`✅ User deleted: ${lowerTargetEmail}`);
        
        return response(200, {
            success: true,
            message: 'User deleted successfully'
        });
        
    } catch (error) {
        console.error('Delete user error:', error);
        return response(500, { error: 'Internal server error' });
    }
}

// ==========================================
// LAMBDA HANDLER
// ==========================================

export const handler = async (event) => {
    console.log('Auth request:', event.httpMethod || event.requestContext?.http?.method, event.path || event.rawPath);
    
    // Handle preflight CORS
    const method = event.httpMethod || event.requestContext?.http?.method;
    if (method === 'OPTIONS') {
        return response(200, { message: 'OK' });
    }
    
    // Parse path and body
    const path = event.path || event.rawPath || '';
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    
    let body = {};
    if (event.body) {
        try {
            body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        } catch (e) {
            console.error('Failed to parse body:', e);
        }
    }
    
    try {
        // Route requests
        
        // POST /auth/login
        if (method === 'POST' && path.includes('/auth/login')) {
            return await handleLogin(body);
        }
        
        // POST /auth/register
        if (method === 'POST' && path.includes('/auth/register')) {
            return await handleRegister(body);
        }
        
        // GET /auth/validate
        if (method === 'GET' && path.includes('/auth/validate')) {
            return await handleValidate(authHeader);
        }
        
        // POST /auth/forgot-password
        if (method === 'POST' && path.includes('/auth/forgot-password')) {
            return await handleForgotPassword(body);
        }
        
        // POST /auth/reset-password
        if (method === 'POST' && path.includes('/auth/reset-password')) {
            return await handleResetPassword(body);
        }
        
        // GET /auth/users - List all users
        if (method === 'GET' && path.match(/\/auth\/users\/?$/)) {
            return await handleListUsers(authHeader);
        }
        
        // PUT /auth/users/{email}
        if (method === 'PUT' && path.includes('/auth/users/')) {
            const emailMatch = path.match(/\/auth\/users\/([^\/]+)/);
            if (emailMatch) {
                return await handleUpdateUser(authHeader, decodeURIComponent(emailMatch[1]), body);
            }
        }
        
        // DELETE /auth/users/{email}
        if (method === 'DELETE' && path.includes('/auth/users/')) {
            const emailMatch = path.match(/\/auth\/users\/([^\/]+)/);
            if (emailMatch) {
                return await handleDeleteUser(authHeader, decodeURIComponent(emailMatch[1]));
            }
        }
        
        // Not found
        return response(404, { error: 'Not found', path, method });
        
    } catch (error) {
        console.error('Unhandled error:', error);
        return response(500, { error: 'Internal server error' });
    }
};

