/**
 * OITH Image Service - S3-based Photo Storage
 * 
 * Handles all image operations for scalability:
 * - Upload photos to S3 with automatic resizing
 * - Generate signed URLs for secure access
 * - Delete photos when user removes them
 * 
 * Endpoints:
 * - POST /api/images/upload - Get presigned upload URL
 * - POST /api/images/confirm - Confirm upload and update user profile
 * - DELETE /api/images/{photoId} - Delete a photo
 * - GET /api/images/user/{email} - Get all photos for a user
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

// AWS Clients
const s3Client = new S3Client({ region: 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Configuration
const BUCKET_NAME = process.env.S3_BUCKET || 'oith-user-photos';
const PROFILES_TABLE = 'oith-profiles';  // Dating user profiles (simple email key)
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || null;

// CORS headers
const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

// ==========================================
// MAIN HANDLER
// ==========================================

export const handler = async (event) => {
    console.log('📥 Image Service Request:', JSON.stringify(event, null, 2));
    
    // Handle OPTIONS (CORS preflight)
    if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    const path = event.path || event.rawPath || '';
    const method = event.httpMethod || event.requestContext?.http?.method;
    
    try {
        // POST /api/images/upload - Get presigned URL for upload
        if (path.includes('/images/upload') && method === 'POST') {
            return await getUploadUrl(event);
        }
        
        // POST /api/images/confirm - Confirm upload completed
        if (path.includes('/images/confirm') && method === 'POST') {
            return await confirmUpload(event);
        }
        
        // DELETE /api/images/{photoId} - Delete a photo
        if (path.includes('/images/') && method === 'DELETE') {
            return await deletePhoto(event);
        }
        
        // GET /api/images/user/{email} - Get user's photos
        if (path.includes('/images/user/') && method === 'GET') {
            return await getUserPhotos(event);
        }
        
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Endpoint not found', path, method })
        };
        
    } catch (error) {
        console.error('❌ Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

// ==========================================
// GET PRESIGNED UPLOAD URL
// ==========================================

async function getUploadUrl(event) {
    const body = JSON.parse(event.body || '{}');
    const { userEmail, contentType, photoIndex } = body;
    
    if (!userEmail) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'userEmail is required' })
        };
    }
    
    // Validate content type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const finalContentType = contentType && allowedTypes.includes(contentType) 
        ? contentType 
        : 'image/jpeg';
    
    // Generate unique photo ID
    const photoId = randomUUID();
    const extension = finalContentType.split('/')[1] || 'jpg';
    const key = `users/${userEmail.toLowerCase().replace(/[^a-z0-9]/g, '_')}/${photoId}.${extension}`;
    
    console.log(`📤 Generating upload URL for: ${key}`);
    
    // Generate presigned URL (valid for 5 minutes)
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: finalContentType,
        Metadata: {
            'user-email': userEmail.toLowerCase(),
            'photo-index': String(photoIndex || 0),
            'uploaded-at': new Date().toISOString()
        }
    });
    
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    
    // Generate the public URL that will be used after upload
    const publicUrl = CLOUDFRONT_DOMAIN 
        ? `https://${CLOUDFRONT_DOMAIN}/${key}`
        : `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            uploadUrl,
            photoId,
            key,
            publicUrl,
            expiresIn: 300
        })
    };
}

// ==========================================
// CONFIRM UPLOAD
// ==========================================

async function confirmUpload(event) {
    const body = JSON.parse(event.body || '{}');
    const { userEmail, photoId, key, publicUrl, photoIndex } = body;
    
    if (!userEmail || !publicUrl) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'userEmail and publicUrl are required' })
        };
    }
    
    console.log(`✅ Confirming upload for ${userEmail}: ${publicUrl}`);
    
    // Get current user photos from profiles table
    const userResult = await docClient.send(new GetCommand({
        TableName: PROFILES_TABLE,
        Key: { email: userEmail.toLowerCase() }
    }));
    
    const user = userResult.Item;
    if (!user) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'User not found' })
        };
    }
    
    // Update photos array
    let photos = user.photos || [];
    const index = photoIndex !== undefined ? photoIndex : photos.length;
    
    // If replacing existing photo at index, delete old one from S3
    if (photos[index] && photos[index].startsWith(`https://${BUCKET_NAME}`)) {
        try {
            const oldKey = photos[index].split('.com/')[1];
            await s3Client.send(new DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: oldKey
            }));
            console.log(`🗑️ Deleted old photo: ${oldKey}`);
        } catch (e) {
            console.log('Could not delete old photo:', e.message);
        }
    }
    
    // Add/replace photo at index
    if (index < photos.length) {
        photos[index] = publicUrl;
    } else {
        photos.push(publicUrl);
    }
    
    // Update user in DynamoDB
    await docClient.send(new UpdateCommand({
        TableName: PROFILES_TABLE,
        Key: { email: userEmail.toLowerCase() },
        UpdateExpression: 'SET photos = :photos, updatedAt = :time',
        ExpressionAttributeValues: {
            ':photos': photos,
            ':time': new Date().toISOString()
        }
    }));
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            photos,
            message: 'Photo uploaded successfully'
        })
    };
}

// ==========================================
// DELETE PHOTO
// ==========================================

async function deletePhoto(event) {
    const body = JSON.parse(event.body || '{}');
    const { userEmail, photoUrl, photoIndex } = body;
    
    if (!userEmail) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'userEmail is required' })
        };
    }
    
    console.log(`🗑️ Deleting photo for ${userEmail}`);
    
    // Get current user
    const userResult = await docClient.send(new GetCommand({
        TableName: PROFILES_TABLE,
        Key: { email: userEmail.toLowerCase() }
    }));
    
    const user = userResult.Item;
    if (!user) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'User not found' })
        };
    }
    
    let photos = user.photos || [];
    let deletedUrl = null;
    
    // Find and remove photo
    if (photoIndex !== undefined && photos[photoIndex]) {
        deletedUrl = photos[photoIndex];
        photos.splice(photoIndex, 1);
    } else if (photoUrl) {
        const index = photos.indexOf(photoUrl);
        if (index > -1) {
            deletedUrl = photos[index];
            photos.splice(index, 1);
        }
    }
    
    // Delete from S3 if it's our bucket
    if (deletedUrl && deletedUrl.includes(BUCKET_NAME)) {
        try {
            const key = deletedUrl.split('.com/')[1] || deletedUrl.split('.net/')[1];
            if (key) {
                await s3Client.send(new DeleteObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: key
                }));
                console.log(`🗑️ Deleted from S3: ${key}`);
            }
        } catch (e) {
            console.log('Could not delete from S3:', e.message);
        }
    }
    
    // Update user in DynamoDB
    await docClient.send(new UpdateCommand({
        TableName: PROFILES_TABLE,
        Key: { email: userEmail.toLowerCase() },
        UpdateExpression: 'SET photos = :photos, updatedAt = :time',
        ExpressionAttributeValues: {
            ':photos': photos,
            ':time': new Date().toISOString()
        }
    }));
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            photos,
            message: 'Photo deleted successfully'
        })
    };
}

// ==========================================
// GET USER PHOTOS
// ==========================================

async function getUserPhotos(event) {
    // Extract email from path: /api/images/user/{email}
    const path = event.path || event.rawPath || '';
    const parts = path.split('/');
    const userEmail = decodeURIComponent(parts[parts.length - 1]);
    
    if (!userEmail) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'userEmail is required in path' })
        };
    }
    
    const userResult = await docClient.send(new GetCommand({
        TableName: PROFILES_TABLE,
        Key: { email: userEmail.toLowerCase() }
    }));
    
    const user = userResult.Item;
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            photos: user?.photos || [],
            count: user?.photos?.length || 0
        })
    };
}

