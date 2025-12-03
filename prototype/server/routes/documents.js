/**
 * Documents API Routes
 * Handles file uploads to S3 for patents, compliance, etc.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { s3Client, docClient, TABLES, S3_BUCKET, isAWSConfigured } = require('../aws-config');
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { PutCommand, GetCommand, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// In-memory fallback
let localDocuments = {
    patents: {},
    compliance: {}
};

// GET all documents for a category (patents, compliance, etc.)
router.get('/:category', async (req, res) => {
    try {
        const { category } = req.params;

        if (!isAWSConfigured()) {
            return res.json(localDocuments[category] || {});
        }

        const result = await docClient.send(new QueryCommand({
            TableName: TABLES.USERS,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: { ':pk': `DOCS#${category}` }
        }));

        const docs = {};
        result.Items?.forEach(item => {
            if (!docs[item.parentId]) {
                docs[item.parentId] = [];
            }
            docs[item.parentId].push({
                id: item.docId,
                fileName: item.fileName,
                fileType: item.fileType,
                fileSize: item.fileSize,
                uploadedAt: item.uploadedAt,
                s3Key: item.s3Key
            });
        });

        res.json(docs);
    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET documents for specific item (e.g., patent ID)
router.get('/:category/:itemId', async (req, res) => {
    try {
        const { category, itemId } = req.params;

        if (!isAWSConfigured()) {
            return res.json(localDocuments[category]?.[itemId] || []);
        }

        const result = await docClient.send(new QueryCommand({
            TableName: TABLES.USERS,
            KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
            ExpressionAttributeValues: { 
                ':pk': `DOCS#${category}`,
                ':sk': `${itemId}#`
            }
        }));

        const docs = result.Items?.map(item => ({
            id: item.docId,
            fileName: item.fileName,
            fileType: item.fileType,
            fileSize: item.fileSize,
            uploadedAt: item.uploadedAt,
            s3Key: item.s3Key
        })) || [];

        res.json(docs);
    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST upload document
router.post('/:category/:itemId', upload.single('file'), async (req, res) => {
    try {
        const { category, itemId } = req.params;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        const docId = uuidv4();
        const s3Key = `${category}/${itemId}/${docId}-${file.originalname}`;

        if (!isAWSConfigured()) {
            // Store base64 locally
            if (!localDocuments[category]) {
                localDocuments[category] = {};
            }
            if (!localDocuments[category][itemId]) {
                localDocuments[category][itemId] = [];
            }
            localDocuments[category][itemId].push({
                id: docId,
                fileName: file.originalname,
                fileType: file.mimetype,
                fileSize: file.size,
                uploadedAt: new Date().toISOString(),
                data: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
            });
            return res.json({ 
                success: true, 
                docId,
                message: 'Document saved (local mode)' 
            });
        }

        // Upload to S3
        await s3Client.send(new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: s3Key,
            Body: file.buffer,
            ContentType: file.mimetype,
            Metadata: {
                originalName: file.originalname,
                category,
                itemId
            }
        }));

        // Save metadata to DynamoDB
        await docClient.send(new PutCommand({
            TableName: TABLES.USERS,
            Item: {
                pk: `DOCS#${category}`,
                sk: `${itemId}#${docId}`,
                docId,
                parentId: itemId,
                fileName: file.originalname,
                fileType: file.mimetype,
                fileSize: file.size,
                s3Key,
                uploadedAt: new Date().toISOString()
            }
        }));

        res.json({ 
            success: true, 
            docId,
            s3Key,
            message: 'Document uploaded to S3' 
        });
    } catch (error) {
        console.error('Error uploading document:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST upload with base64 data (for frontend compatibility)
router.post('/:category/:itemId/base64', async (req, res) => {
    try {
        const { category, itemId } = req.params;
        const { fileName, fileType, fileSize, data } = req.body;

        const docId = uuidv4();
        const s3Key = `${category}/${itemId}/${docId}-${fileName}`;

        if (!isAWSConfigured()) {
            if (!localDocuments[category]) {
                localDocuments[category] = {};
            }
            if (!localDocuments[category][itemId]) {
                localDocuments[category][itemId] = [];
            }
            localDocuments[category][itemId].push({
                id: docId,
                fileName,
                fileType,
                fileSize,
                uploadedAt: new Date().toISOString(),
                data
            });
            return res.json({ 
                success: true, 
                docId,
                message: 'Document saved (local mode)' 
            });
        }

        // Convert base64 to buffer
        const base64Data = data.replace(/^data:.*?;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // Upload to S3
        await s3Client.send(new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: s3Key,
            Body: buffer,
            ContentType: fileType
        }));

        // Save metadata
        await docClient.send(new PutCommand({
            TableName: TABLES.USERS,
            Item: {
                pk: `DOCS#${category}`,
                sk: `${itemId}#${docId}`,
                docId,
                parentId: itemId,
                fileName,
                fileType,
                fileSize,
                s3Key,
                uploadedAt: new Date().toISOString()
            }
        }));

        res.json({ success: true, docId, s3Key });
    } catch (error) {
        console.error('Error uploading document:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET download URL for document
router.get('/:category/:itemId/:docId/download', async (req, res) => {
    try {
        const { category, itemId, docId } = req.params;

        if (!isAWSConfigured()) {
            const doc = localDocuments[category]?.[itemId]?.find(d => d.id === docId);
            if (!doc) {
                return res.status(404).json({ error: 'Document not found' });
            }
            return res.json({ url: doc.data, fileName: doc.fileName });
        }

        // Get document metadata
        const result = await docClient.send(new GetCommand({
            TableName: TABLES.USERS,
            Key: { pk: `DOCS#${category}`, sk: `${itemId}#${docId}` }
        }));

        if (!result.Item) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Generate presigned URL
        const url = await getSignedUrl(s3Client, new GetObjectCommand({
            Bucket: S3_BUCKET,
            Key: result.Item.s3Key
        }), { expiresIn: 3600 }); // 1 hour

        res.json({ url, fileName: result.Item.fileName });
    } catch (error) {
        console.error('Error getting download URL:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE document
router.delete('/:category/:itemId/:docId', async (req, res) => {
    try {
        const { category, itemId, docId } = req.params;

        if (!isAWSConfigured()) {
            if (localDocuments[category]?.[itemId]) {
                localDocuments[category][itemId] = localDocuments[category][itemId].filter(d => d.id !== docId);
            }
            return res.json({ success: true, message: 'Document deleted (local mode)' });
        }

        // Get document metadata first
        const result = await docClient.send(new GetCommand({
            TableName: TABLES.USERS,
            Key: { pk: `DOCS#${category}`, sk: `${itemId}#${docId}` }
        }));

        if (result.Item?.s3Key) {
            // Delete from S3
            await s3Client.send(new DeleteObjectCommand({
                Bucket: S3_BUCKET,
                Key: result.Item.s3Key
            }));
        }

        // Delete metadata from DynamoDB
        await docClient.send(new DeleteCommand({
            TableName: TABLES.USERS,
            Key: { pk: `DOCS#${category}`, sk: `${itemId}#${docId}` }
        }));

        res.json({ success: true, message: 'Document deleted from S3' });
    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

