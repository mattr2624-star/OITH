/**
 * AWS Lambda Function for OITH User Sync
 * Deploy this to AWS Lambda and connect to API Gateway
 * 
 * Environment Variables Required:
 * - DYNAMODB_TABLE: Your DynamoDB table name (e.g., 'oith-users')
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMODB_TABLE || 'oith-users';

// CORS headers for cross-origin requests
const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    try {
        const path = event.path || event.rawPath || '';
        const method = event.httpMethod || event.requestContext?.http?.method;
        
        // POST /users - Save user profile
        if (method === 'POST' && path.includes('/users')) {
            const body = JSON.parse(event.body || '{}');
            const { email, name, password, userData } = body;
            
            if (!email) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Email is required' })
                };
            }
            
            const lowerEmail = email.toLowerCase();
            const timestamp = new Date().toISOString();
            
            // Save user profile
            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    pk: `USER#${lowerEmail}`,
                    sk: 'PROFILE',
                    dataType: 'registered_user',
                    email: lowerEmail,
                    name: name || '',
                    password: password || '',
                    registeredAt: timestamp,
                    updatedAt: timestamp
                }
            }));
            
            // Save user data if provided
            if (userData) {
                await docClient.send(new PutCommand({
                    TableName: TABLE_NAME,
                    Item: {
                        pk: `USER#${lowerEmail}`,
                        sk: 'DATA',
                        dataType: 'user_data',
                        email: lowerEmail,
                        userData: userData,
                        updatedAt: timestamp
                    }
                }));
            }
            
            console.log(`✅ User saved: ${lowerEmail}`);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: true, 
                    message: 'User saved to AWS',
                    email: lowerEmail,
                    timestamp 
                })
            };
        }
        
        // GET /users - Get all users
        if (method === 'GET' && path.includes('/users')) {
            const result = await docClient.send(new ScanCommand({
                TableName: TABLE_NAME,
                FilterExpression: 'dataType = :type',
                ExpressionAttributeValues: { ':type': 'registered_user' }
            }));
            
            const users = {};
            result.Items?.forEach(item => {
                users[item.email] = {
                    name: item.name,
                    registeredAt: item.registeredAt,
                    updatedAt: item.updatedAt
                };
            });
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(users)
            };
        }
        
        // Health check
        if (path.includes('/health')) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ status: 'ok', table: TABLE_NAME })
            };
        }
        
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Not found' })
        };
        
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

