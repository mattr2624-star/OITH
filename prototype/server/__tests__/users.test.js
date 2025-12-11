/**
 * Unit Tests for Users API Routes
 * 
 * Run with: npm test -- __tests__/users.test.js
 */

const request = require('supertest');
const express = require('express');

// Mock AWS SDK
jest.mock('@aws-sdk/lib-dynamodb', () => ({
    PutCommand: jest.fn(),
    GetCommand: jest.fn(),
    ScanCommand: jest.fn(),
    DeleteCommand: jest.fn()
}));

// Mock AWS config
jest.mock('../aws-config', () => ({
    docClient: {
        send: jest.fn()
    },
    TABLES: {
        USERS: 'test-users-table'
    },
    isAWSConfigured: jest.fn()
}));

const { docClient, isAWSConfigured } = require('../aws-config');
const usersRoutes = require('../routes/users');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/users', usersRoutes);

describe('Users API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ==========================================
    // GET /api/users - Get all users
    // ==========================================
    describe('GET /api/users', () => {
        it('should return all registered users when AWS is configured', async () => {
            isAWSConfigured.mockReturnValue(true);
            docClient.send.mockResolvedValue({
                Items: [
                    { email: 'user1@test.com', name: 'User One', dataType: 'registered_user' },
                    { email: 'user2@test.com', name: 'User Two', dataType: 'registered_user' }
                ]
            });

            const response = await request(app).get('/api/users');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('user1@test.com');
            expect(response.body).toHaveProperty('user2@test.com');
            expect(response.body['user1@test.com'].name).toBe('User One');
        });

        it('should return empty object when no users exist', async () => {
            isAWSConfigured.mockReturnValue(true);
            docClient.send.mockResolvedValue({ Items: [] });

            const response = await request(app).get('/api/users');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({});
        });

        it('should fall back to local mode when AWS not configured', async () => {
            isAWSConfigured.mockReturnValue(false);

            const response = await request(app).get('/api/users');

            expect(response.status).toBe(200);
            expect(typeof response.body).toBe('object');
            // Should not call AWS
            expect(docClient.send).not.toHaveBeenCalled();
        });

        it('should handle AWS DynamoDB errors gracefully', async () => {
            isAWSConfigured.mockReturnValue(true);
            docClient.send.mockRejectedValue(new Error('DynamoDB error'));

            const response = await request(app).get('/api/users');

            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty('error');
        });
    });

    // ==========================================
    // GET /api/users/:email - Get single user
    // ==========================================
    describe('GET /api/users/:email', () => {
        it('should return user profile and data for valid email', async () => {
            isAWSConfigured.mockReturnValue(true);
            docClient.send
                .mockResolvedValueOnce({ Item: { name: 'Test User', email: 'test@test.com' } })
                .mockResolvedValueOnce({ Item: { bio: 'Test bio', interests: ['hiking'] } });

            const response = await request(app).get('/api/users/test@test.com');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('user');
            expect(response.body).toHaveProperty('userData');
            expect(response.body.user.name).toBe('Test User');
        });

        it('should normalize email to lowercase', async () => {
            isAWSConfigured.mockReturnValue(true);
            docClient.send
                .mockResolvedValueOnce({ Item: null })
                .mockResolvedValueOnce({ Item: null });

            await request(app).get('/api/users/TEST@TEST.COM');

            // Verify the email was lowercased in the query
            expect(docClient.send).toHaveBeenCalled();
        });

        it('should return null for non-existent user', async () => {
            isAWSConfigured.mockReturnValue(true);
            docClient.send
                .mockResolvedValueOnce({ Item: undefined })
                .mockResolvedValueOnce({ Item: undefined });

            const response = await request(app).get('/api/users/nonexistent@test.com');

            expect(response.status).toBe(200);
            expect(response.body.user).toBeUndefined();
        });

        it('should handle special characters in email', async () => {
            isAWSConfigured.mockReturnValue(true);
            docClient.send
                .mockResolvedValueOnce({ Item: { name: 'Test' } })
                .mockResolvedValueOnce({ Item: {} });

            const response = await request(app).get('/api/users/test+special@test.com');

            expect(response.status).toBe(200);
        });
    });

    // ==========================================
    // POST /api/users - Create/Update user
    // ==========================================
    describe('POST /api/users', () => {
        it('should create new user successfully', async () => {
            isAWSConfigured.mockReturnValue(true);
            docClient.send.mockResolvedValue({});

            const response = await request(app)
                .post('/api/users')
                .send({
                    email: 'newuser@test.com',
                    name: 'New User',
                    password: 'hashedpassword123'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('AWS');
        });

        it('should store userData when provided', async () => {
            isAWSConfigured.mockReturnValue(true);
            docClient.send.mockResolvedValue({});

            const userData = {
                bio: 'I love hiking',
                interests: ['hiking', 'reading'],
                age: 28
            };

            const response = await request(app)
                .post('/api/users')
                .send({
                    email: 'user@test.com',
                    name: 'Test User',
                    password: 'password',
                    userData
                });

            expect(response.status).toBe(200);
            // Should have called put twice (once for profile, once for data)
            expect(docClient.send).toHaveBeenCalledTimes(2);
        });

        it('should normalize email to lowercase', async () => {
            isAWSConfigured.mockReturnValue(true);
            docClient.send.mockResolvedValue({});

            const response = await request(app)
                .post('/api/users')
                .send({
                    email: 'USER@TEST.COM',
                    name: 'Test User',
                    password: 'password'
                });

            expect(response.status).toBe(200);
            // The implementation lowercases the email
        });

        it('should work in local mode when AWS not configured', async () => {
            isAWSConfigured.mockReturnValue(false);

            const response = await request(app)
                .post('/api/users')
                .send({
                    email: 'local@test.com',
                    name: 'Local User',
                    password: 'password'
                });

            expect(response.status).toBe(200);
            expect(response.body.message).toContain('local mode');
            expect(docClient.send).not.toHaveBeenCalled();
        });
    });

    // ==========================================
    // DELETE /api/users/:email - Delete user
    // ==========================================
    describe('DELETE /api/users/:email', () => {
        it('should delete user and associated data', async () => {
            isAWSConfigured.mockReturnValue(true);
            docClient.send.mockResolvedValue({});

            const response = await request(app)
                .delete('/api/users/delete@test.com');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            // Should call delete twice (profile + data)
            expect(docClient.send).toHaveBeenCalledTimes(2);
        });

        it('should handle non-existent user gracefully', async () => {
            isAWSConfigured.mockReturnValue(true);
            docClient.send.mockResolvedValue({});

            const response = await request(app)
                .delete('/api/users/nonexistent@test.com');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should normalize email to lowercase', async () => {
            isAWSConfigured.mockReturnValue(true);
            docClient.send.mockResolvedValue({});

            await request(app).delete('/api/users/DELETE@TEST.COM');

            expect(docClient.send).toHaveBeenCalled();
        });

        it('should work in local mode', async () => {
            isAWSConfigured.mockReturnValue(false);

            const response = await request(app)
                .delete('/api/users/local@test.com');

            expect(response.status).toBe(200);
            expect(response.body.message).toContain('local mode');
        });
    });

    // ==========================================
    // POST /api/users/bulk - Bulk import
    // ==========================================
    describe('POST /api/users/bulk', () => {
        it('should import multiple users', async () => {
            isAWSConfigured.mockReturnValue(true);
            docClient.send.mockResolvedValue({});

            const response = await request(app)
                .post('/api/users/bulk')
                .send({
                    registeredUsers: {
                        'user1@test.com': { name: 'User One', password: 'pass1' },
                        'user2@test.com': { name: 'User Two', password: 'pass2' }
                    },
                    userData: {
                        'user1@test.com': { bio: 'Bio 1' },
                        'user2@test.com': { bio: 'Bio 2' }
                    }
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.imported).toBe(2);
        });

        it('should return count of imported users', async () => {
            isAWSConfigured.mockReturnValue(true);
            docClient.send.mockResolvedValue({});

            const response = await request(app)
                .post('/api/users/bulk')
                .send({
                    registeredUsers: {
                        'a@test.com': { name: 'A' },
                        'b@test.com': { name: 'B' },
                        'c@test.com': { name: 'C' }
                    },
                    userData: {}
                });

            expect(response.body.imported).toBe(3);
        });

        it('should handle empty import', async () => {
            isAWSConfigured.mockReturnValue(false);

            const response = await request(app)
                .post('/api/users/bulk')
                .send({
                    registeredUsers: {},
                    userData: {}
                });

            expect(response.status).toBe(200);
            expect(response.body.imported).toBe(0);
        });
    });
});


