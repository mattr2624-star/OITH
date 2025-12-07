/**
 * AWS Lambda Function for OITH User Sync (ES Module version)
 * Handles user profile storage and retrieval from DynamoDB
 * Enables users to match with other AWS users
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMODB_TABLE || 'oith-users';

export const handler = async (event) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': '*'
    };
    
    const method = event.httpMethod || event.requestContext?.http?.method;
    const path = event.path || event.rawPath || '';
    
    // Handle CORS preflight
    if (method === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    try {
        // POST /users - Save user profile
        if (method === 'POST') {
            const body = JSON.parse(event.body || '{}');
            const { email, name, password, userData } = body;
            
            if (!email) {
                return { 
                    statusCode: 400, 
                    headers, 
                    body: JSON.stringify({ error: 'Email required' }) 
                };
            }
            
            const lowerEmail = email.toLowerCase();
            const timestamp = new Date().toISOString();
            
            // Extract profile info for matching
            const userProfile = userData?.user || {};
            
            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    pk: `USER#${lowerEmail}`,
                    sk: 'PROFILE',
                    email: lowerEmail,
                    name: name || userProfile.firstName || '',
                    password: password || '',
                    // Profile data for matching
                    firstName: userProfile.firstName || name || '',
                    age: userProfile.age || null,
                    gender: userProfile.gender || '',
                    location: userProfile.location || '',
                    occupation: userProfile.occupation || '',
                    bio: userProfile.bio || '',
                    photo: userProfile.photos?.[0] || '',
                    photos: userProfile.photos || [],
                    education: userProfile.education || '',
                    // Full userData for complete sync
                    userData: userData || {},
                    registeredAt: timestamp,
                    updatedAt: timestamp
                }
            }));
            
            console.log(`✅ User saved: ${lowerEmail}`);
            
            return { 
                statusCode: 200, 
                headers, 
                body: JSON.stringify({ success: true, email: lowerEmail, timestamp }) 
            };
        }
        
        // GET /users - Get all users for matching
        if (method === 'GET' && path.includes('/users')) {
            const result = await docClient.send(new ScanCommand({ 
                TableName: TABLE_NAME,
                FilterExpression: 'sk = :sk',
                ExpressionAttributeValues: { ':sk': 'PROFILE' }
            }));
            
            const users = {};
            result.Items?.forEach(item => {
                if (item.email) {
                    users[item.email] = {
                        name: item.name || item.firstName || 'User',
                        firstName: item.firstName || item.name || '',
                        age: item.age,
                        gender: item.gender || '',
                        location: item.location || '',
                        occupation: item.occupation || '',
                        bio: item.bio || '',
                        photo: item.photo || '',
                        photos: item.photos || [],
                        education: item.education || '',
                        registeredAt: item.registeredAt || item.updatedAt
                    };
                }
            });
            
            console.log(`📊 Returning ${Object.keys(users).length} users`);
            
            return { 
                statusCode: 200, 
                headers, 
                body: JSON.stringify(users) 
            };
        }
        
        // Health check
        return { 
            statusCode: 200, 
            headers, 
            body: JSON.stringify({ status: 'ok', table: TABLE_NAME }) 
        };
        
    } catch (error) {
        console.error('Lambda error:', error);
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ error: error.message }) 
        };
    }
};

