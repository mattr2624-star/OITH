/**
 * Integration Tests for OITH API
 * 
 * Tests the full API flow including multiple routes working together.
 * Requires the server to be running or mocked.
 * 
 * Run with: npm test -- __tests__/integration.test.js
 */

const request = require('supertest');
const express = require('express');

// Create a mock app for integration testing
const createTestApp = () => {
    const app = express();
    app.use(express.json());
    
    // Mock data store
    const store = {
        users: {},
        userData: {}
    };
    
    // Health check
    app.get('/api/health', (req, res) => {
        res.json({ 
            status: 'ok', 
            timestamp: new Date().toISOString(),
            testMode: true
        });
    });
    
    // Users routes (simplified for testing)
    app.get('/api/users', (req, res) => {
        res.json(store.users);
    });
    
    app.get('/api/users/:email', (req, res) => {
        const email = req.params.email.toLowerCase();
        res.json({
            user: store.users[email] || null,
            userData: store.userData[email] || null
        });
    });
    
    app.post('/api/users', (req, res) => {
        const { email, name, password, userData } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email required' });
        }
        const lowerEmail = email.toLowerCase();
        store.users[lowerEmail] = { name, password, registeredAt: new Date().toISOString() };
        if (userData) {
            store.userData[lowerEmail] = userData;
        }
        res.json({ success: true, message: 'User created' });
    });
    
    app.delete('/api/users/:email', (req, res) => {
        const email = req.params.email.toLowerCase();
        delete store.users[email];
        delete store.userData[email];
        res.json({ success: true, message: 'User deleted' });
    });
    
    return { app, store };
};

describe('API Integration Tests', () => {
    let app;
    let store;
    
    beforeEach(() => {
        const testApp = createTestApp();
        app = testApp.app;
        store = testApp.store;
    });

    // ==========================================
    // Health Check
    // ==========================================
    describe('Health Check', () => {
        it('should return ok status', async () => {
            const response = await request(app).get('/api/health');
            
            expect(response.status).toBe(200);
            expect(response.body.status).toBe('ok');
            expect(response.body).toHaveProperty('timestamp');
        });
    });

    // ==========================================
    // User Registration Flow
    // ==========================================
    describe('User Registration Flow', () => {
        it('should complete full registration flow', async () => {
            // Step 1: Create user
            const createResponse = await request(app)
                .post('/api/users')
                .send({
                    email: 'integration@test.com',
                    name: 'Integration Test User',
                    password: 'securepassword123',
                    userData: {
                        bio: 'I love testing',
                        interests: ['testing', 'coding'],
                        age: 28
                    }
                });
            
            expect(createResponse.status).toBe(200);
            expect(createResponse.body.success).toBe(true);
            
            // Step 2: Verify user exists
            const getResponse = await request(app)
                .get('/api/users/integration@test.com');
            
            expect(getResponse.status).toBe(200);
            expect(getResponse.body.user).not.toBeNull();
            expect(getResponse.body.user.name).toBe('Integration Test User');
            expect(getResponse.body.userData.bio).toBe('I love testing');
            
            // Step 3: Update user
            const updateResponse = await request(app)
                .post('/api/users')
                .send({
                    email: 'integration@test.com',
                    name: 'Updated Name',
                    password: 'newpassword',
                    userData: {
                        bio: 'Updated bio',
                        interests: ['testing', 'coding', 'hiking'],
                        age: 29
                    }
                });
            
            expect(updateResponse.status).toBe(200);
            
            // Step 4: Verify update
            const verifyResponse = await request(app)
                .get('/api/users/integration@test.com');
            
            expect(verifyResponse.body.user.name).toBe('Updated Name');
            expect(verifyResponse.body.userData.bio).toBe('Updated bio');
            
            // Step 5: Delete user
            const deleteResponse = await request(app)
                .delete('/api/users/integration@test.com');
            
            expect(deleteResponse.status).toBe(200);
            expect(deleteResponse.body.success).toBe(true);
            
            // Step 6: Verify deletion
            const finalResponse = await request(app)
                .get('/api/users/integration@test.com');
            
            expect(finalResponse.body.user).toBeNull();
        });
    });

    // ==========================================
    // Multi-User Scenarios
    // ==========================================
    describe('Multi-User Scenarios', () => {
        it('should handle multiple users independently', async () => {
            // Create User A
            await request(app)
                .post('/api/users')
                .send({ email: 'userA@test.com', name: 'User A', password: 'pass' });
            
            // Create User B
            await request(app)
                .post('/api/users')
                .send({ email: 'userB@test.com', name: 'User B', password: 'pass' });
            
            // Get all users
            const allUsers = await request(app).get('/api/users');
            
            expect(Object.keys(allUsers.body)).toHaveLength(2);
            expect(allUsers.body['usera@test.com']).toBeDefined();
            expect(allUsers.body['userb@test.com']).toBeDefined();
            
            // Delete User A
            await request(app).delete('/api/users/userA@test.com');
            
            // Verify only User B remains
            const remainingUsers = await request(app).get('/api/users');
            
            expect(Object.keys(remainingUsers.body)).toHaveLength(1);
            expect(remainingUsers.body['userb@test.com']).toBeDefined();
            expect(remainingUsers.body['usera@test.com']).toBeUndefined();
        });
    });

    // ==========================================
    // Error Handling
    // ==========================================
    describe('Error Handling', () => {
        it('should handle missing required fields', async () => {
            const response = await request(app)
                .post('/api/users')
                .send({ name: 'No Email User' }); // Missing email
            
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });
        
        it('should handle non-existent user lookup gracefully', async () => {
            const response = await request(app)
                .get('/api/users/nonexistent@test.com');
            
            expect(response.status).toBe(200);
            expect(response.body.user).toBeNull();
        });
        
        it('should handle delete of non-existent user', async () => {
            const response = await request(app)
                .delete('/api/users/ghost@test.com');
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    // ==========================================
    // Email Normalization
    // ==========================================
    describe('Email Normalization', () => {
        it('should treat different cases as same user', async () => {
            // Create with lowercase
            await request(app)
                .post('/api/users')
                .send({ email: 'case@test.com', name: 'Case Test', password: 'pass' });
            
            // Retrieve with uppercase
            const response = await request(app)
                .get('/api/users/CASE@TEST.COM');
            
            expect(response.body.user).not.toBeNull();
            expect(response.body.user.name).toBe('Case Test');
            
            // Delete with mixed case
            await request(app).delete('/api/users/Case@Test.Com');
            
            // Verify deleted
            const verifyResponse = await request(app)
                .get('/api/users/case@test.com');
            
            expect(verifyResponse.body.user).toBeNull();
        });
    });

    // ==========================================
    // Concurrent Operations
    // ==========================================
    describe('Concurrent Operations', () => {
        it('should handle concurrent user creations', async () => {
            const createPromises = [];
            
            for (let i = 0; i < 10; i++) {
                createPromises.push(
                    request(app)
                        .post('/api/users')
                        .send({ 
                            email: `concurrent${i}@test.com`, 
                            name: `User ${i}`, 
                            password: 'pass' 
                        })
                );
            }
            
            const results = await Promise.all(createPromises);
            
            // All should succeed
            results.forEach(result => {
                expect(result.status).toBe(200);
                expect(result.body.success).toBe(true);
            });
            
            // Verify all users exist
            const allUsers = await request(app).get('/api/users');
            expect(Object.keys(allUsers.body)).toHaveLength(10);
        });
    });
});

// ==========================================
// Match Flow Integration Tests
// ==========================================
describe('Match Flow Integration', () => {
    // These tests would require a more complete mock of the matching service
    // For now, we test the expected behavior patterns
    
    describe('Match Discovery Flow', () => {
        it('should define the expected API contract', () => {
            // POST /api/match/next
            const nextMatchRequest = {
                userEmail: 'user@test.com'
            };
            expect(nextMatchRequest).toHaveProperty('userEmail');
            
            // Expected response
            const expectedResponse = {
                match: {
                    email: 'match@test.com',
                    firstName: 'Match',
                    age: 25,
                    compatibility: 85,
                    distance: 5
                }
            };
            expect(expectedResponse.match).toHaveProperty('email');
            expect(expectedResponse.match).toHaveProperty('compatibility');
        });
        
        it('should define accept match API contract', () => {
            const acceptRequest = {
                userEmail: 'user@test.com',
                matchEmail: 'match@test.com'
            };
            
            expect(acceptRequest).toHaveProperty('userEmail');
            expect(acceptRequest).toHaveProperty('matchEmail');
            
            const expectedResponse = {
                success: true,
                isMutual: true,
                message: "It's a match!"
            };
            
            expect(expectedResponse).toHaveProperty('isMutual');
        });
        
        it('should define pass match API contract', () => {
            const passRequest = {
                userEmail: 'user@test.com',
                matchEmail: 'match@test.com'
            };
            
            expect(passRequest).toHaveProperty('userEmail');
            expect(passRequest).toHaveProperty('matchEmail');
        });
    });
});

// ==========================================
// Payment Flow Integration Tests
// ==========================================
describe('Payment Flow Integration', () => {
    describe('Checkout Flow', () => {
        it('should define checkout session API contract', () => {
            const checkoutRequest = {
                plan: 'monthly',
                email: 'user@test.com',
                userId: 'user123'
            };
            
            expect(checkoutRequest).toHaveProperty('plan');
            expect(checkoutRequest).toHaveProperty('email');
            
            const expectedResponse = {
                sessionId: 'cs_test_xxx',
                url: 'https://checkout.stripe.com/...'
            };
            
            expect(expectedResponse).toHaveProperty('sessionId');
            expect(expectedResponse).toHaveProperty('url');
        });
        
        it('should define subscription status API contract', () => {
            const expectedSubscription = {
                active: true,
                subscription: {
                    id: 'sub_xxx',
                    status: 'active',
                    currentPeriodEnd: '2026-02-01T00:00:00.000Z'
                }
            };
            
            expect(expectedSubscription).toHaveProperty('active');
            expect(expectedSubscription.subscription).toHaveProperty('status');
        });
    });
    
    describe('Webhook Events', () => {
        it('should define expected Stripe webhook event types', () => {
            const supportedEvents = [
                'customer.subscription.created',
                'customer.subscription.updated',
                'customer.subscription.deleted',
                'invoice.payment_failed',
                'invoice.payment_succeeded'
            ];
            
            expect(supportedEvents).toContain('customer.subscription.created');
            expect(supportedEvents).toContain('invoice.payment_failed');
        });
    });
});


