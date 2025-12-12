/**
 * File Storage API Routes
 * Handles file uploads, downloads, and management with AWS S3
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { s3Client, docClient, TABLES, S3_BUCKET, isAWSConfigured } = require('../aws-config');
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { PutCommand, GetCommand, QueryCommand, DeleteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// In-memory fallback
let localFiles = [];

// File categories/folders
const FILE_CATEGORIES = [
    'general',
    'reports',
    'compliance',
    'patents',
    'contracts',
    'marketing',
    'financial',
    'hr',
    'technical',
    'archives'
];

// GET - List all files
router.get('/', async (req, res) => {
    try {
        const { category, search, sortBy = 'uploadedAt', sortOrder = 'desc' } = req.query;

        let files = [];

        if (!isAWSConfigured()) {
            files = [...localFiles];
        } else {
            const result = await docClient.send(new ScanCommand({
                TableName: TABLES.USERS,
                FilterExpression: 'dataType = :type',
                ExpressionAttributeValues: { ':type': 'admin_file' }
            }));

            files = result.Items?.map(item => ({
                id: item.fileId,
                fileName: item.fileName,
                originalName: item.originalName,
                fileType: item.fileType,
                fileSize: item.fileSize,
                category: item.category,
                description: item.description,
                tags: item.tags || [],
                uploadedAt: item.uploadedAt,
                uploadedBy: item.uploadedBy,
                s3Key: item.s3Key,
                source: item.source || 'manual',
                sourceSection: item.sourceSection
            })) || [];
        }

        // Filter by category
        if (category && category !== 'all') {
            files = files.filter(f => f.category === category);
        }

        // Search
        if (search) {
            const searchLower = search.toLowerCase();
            files = files.filter(f => 
                f.fileName?.toLowerCase().includes(searchLower) ||
                f.originalName?.toLowerCase().includes(searchLower) ||
                f.description?.toLowerCase().includes(searchLower) ||
                f.tags?.some(t => t.toLowerCase().includes(searchLower))
            );
        }

        // Sort
        files.sort((a, b) => {
            let aVal = a[sortBy] || '';
            let bVal = b[sortBy] || '';
            
            if (sortBy === 'fileSize') {
                aVal = parseInt(aVal) || 0;
                bVal = parseInt(bVal) || 0;
            }
            
            if (sortOrder === 'desc') {
                return bVal > aVal ? 1 : -1;
            }
            return aVal > bVal ? 1 : -1;
        });

        res.json({
            files,
            total: files.length,
            categories: FILE_CATEGORIES
        });

    } catch (error) {
        console.error('Error listing files:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Get single file metadata
router.get('/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;

        let file;
        if (!isAWSConfigured()) {
            file = localFiles.find(f => f.id === fileId);
        } else {
            const result = await docClient.send(new GetCommand({
                TableName: TABLES.USERS,
                Key: { pk: `FILE#${fileId}`, sk: 'METADATA' }
            }));
            
            if (result.Item) {
                file = {
                    id: result.Item.fileId,
                    fileName: result.Item.fileName,
                    originalName: result.Item.originalName,
                    fileType: result.Item.fileType,
                    fileSize: result.Item.fileSize,
                    category: result.Item.category,
                    description: result.Item.description,
                    tags: result.Item.tags || [],
                    uploadedAt: result.Item.uploadedAt,
                    uploadedBy: result.Item.uploadedBy,
                    s3Key: result.Item.s3Key,
                    source: result.Item.source,
                    sourceSection: result.Item.sourceSection
                };
            }
        }

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        res.json({ file });

    } catch (error) {
        console.error('Error getting file:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Download file (get presigned URL or data)
router.get('/:fileId/download', async (req, res) => {
    try {
        const { fileId } = req.params;

        let file;
        if (!isAWSConfigured()) {
            file = localFiles.find(f => f.id === fileId);
            if (!file) {
                return res.status(404).json({ error: 'File not found' });
            }
            return res.json({ 
                url: file.data, 
                fileName: file.originalName,
                fileType: file.fileType
            });
        }

        const result = await docClient.send(new GetCommand({
            TableName: TABLES.USERS,
            Key: { pk: `FILE#${fileId}`, sk: 'METADATA' }
        }));

        if (!result.Item) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Generate presigned URL
        const url = await getSignedUrl(s3Client, new GetObjectCommand({
            Bucket: S3_BUCKET,
            Key: result.Item.s3Key
        }), { expiresIn: 3600 }); // 1 hour

        res.json({ 
            url, 
            fileName: result.Item.originalName,
            fileType: result.Item.fileType
        });

    } catch (error) {
        console.error('Error getting download URL:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST - Upload file
router.post('/', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        const { category = 'general', description = '', tags = '', source = 'manual', sourceSection = '' } = req.body;

        if (!file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        const fileId = uuidv4();
        const fileName = `${fileId}-${file.originalname}`;
        const s3Key = `admin-files/${category}/${fileName}`;
        const tagsArray = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

        const fileData = {
            id: fileId,
            fileId: fileId,
            fileName: fileName,
            originalName: file.originalname,
            fileType: file.mimetype,
            fileSize: file.size,
            category,
            description,
            tags: tagsArray,
            uploadedAt: new Date().toISOString(),
            uploadedBy: req.body.uploadedBy || 'admin',
            s3Key,
            source,
            sourceSection
        };

        if (!isAWSConfigured()) {
            fileData.data = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
            localFiles.push(fileData);
        } else {
            // Upload to S3
            await s3Client.send(new PutObjectCommand({
                Bucket: S3_BUCKET,
                Key: s3Key,
                Body: file.buffer,
                ContentType: file.mimetype,
                Metadata: {
                    originalName: file.originalname,
                    category,
                    fileId
                }
            }));

            // Save metadata to DynamoDB
            await docClient.send(new PutCommand({
                TableName: TABLES.USERS,
                Item: {
                    pk: `FILE#${fileId}`,
                    sk: 'METADATA',
                    dataType: 'admin_file',
                    ...fileData
                }
            }));
        }

        res.json({
            success: true,
            message: isAWSConfigured() ? 'File uploaded to S3' : 'File saved (local mode)',
            file: {
                id: fileId,
                fileName,
                originalName: file.originalname,
                fileType: file.mimetype,
                fileSize: file.size,
                category,
                s3Key
            }
        });

    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST - Upload file with base64 data (for frontend compatibility)
router.post('/base64', async (req, res) => {
    try {
        const { fileName, fileType, fileSize, data, category = 'general', description = '', tags = [], source = 'manual', sourceSection = '' } = req.body;

        if (!fileName || !data) {
            return res.status(400).json({ error: 'fileName and data are required' });
        }

        const fileId = uuidv4();
        const storedFileName = `${fileId}-${fileName}`;
        const s3Key = `admin-files/${category}/${storedFileName}`;
        const tagsArray = Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []);

        const fileData = {
            id: fileId,
            fileId: fileId,
            fileName: storedFileName,
            originalName: fileName,
            fileType: fileType || 'application/octet-stream',
            fileSize: fileSize || 0,
            category,
            description,
            tags: tagsArray,
            uploadedAt: new Date().toISOString(),
            uploadedBy: req.body.uploadedBy || 'admin',
            s3Key,
            source,
            sourceSection
        };

        if (!isAWSConfigured()) {
            fileData.data = data;
            localFiles.push(fileData);
        } else {
            // Convert base64 to buffer
            const base64Data = data.replace(/^data:.*?;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');

            // Upload to S3
            await s3Client.send(new PutObjectCommand({
                Bucket: S3_BUCKET,
                Key: s3Key,
                Body: buffer,
                ContentType: fileType || 'application/octet-stream'
            }));

            // Save metadata to DynamoDB
            await docClient.send(new PutCommand({
                TableName: TABLES.USERS,
                Item: {
                    pk: `FILE#${fileId}`,
                    sk: 'METADATA',
                    dataType: 'admin_file',
                    ...fileData
                }
            }));
        }

        res.json({
            success: true,
            message: isAWSConfigured() ? 'File uploaded to S3' : 'File saved (local mode)',
            file: {
                id: fileId,
                fileName: storedFileName,
                originalName: fileName,
                category,
                s3Key
            }
        });

    } catch (error) {
        console.error('Error uploading base64 file:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT - Update file metadata
router.put('/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        const { category, description, tags } = req.body;

        if (!isAWSConfigured()) {
            const fileIndex = localFiles.findIndex(f => f.id === fileId);
            if (fileIndex === -1) {
                return res.status(404).json({ error: 'File not found' });
            }

            if (category) localFiles[fileIndex].category = category;
            if (description !== undefined) localFiles[fileIndex].description = description;
            if (tags) localFiles[fileIndex].tags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());

            return res.json({ success: true, message: 'File updated' });
        }

        const updateExpressions = [];
        const expressionValues = {};

        if (category) {
            updateExpressions.push('category = :category');
            expressionValues[':category'] = category;
        }
        if (description !== undefined) {
            updateExpressions.push('description = :description');
            expressionValues[':description'] = description;
        }
        if (tags) {
            updateExpressions.push('tags = :tags');
            expressionValues[':tags'] = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
        }

        if (updateExpressions.length > 0) {
            const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');
            await docClient.send(new UpdateCommand({
                TableName: TABLES.USERS,
                Key: { pk: `FILE#${fileId}`, sk: 'METADATA' },
                UpdateExpression: `SET ${updateExpressions.join(', ')}`,
                ExpressionAttributeValues: expressionValues
            }));
        }

        res.json({ success: true, message: 'File updated' });

    } catch (error) {
        console.error('Error updating file:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE - Delete file
router.delete('/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;

        if (!isAWSConfigured()) {
            const fileIndex = localFiles.findIndex(f => f.id === fileId);
            if (fileIndex === -1) {
                return res.status(404).json({ error: 'File not found' });
            }
            localFiles.splice(fileIndex, 1);
            return res.json({ success: true, message: 'File deleted' });
        }

        // Get file metadata first
        const result = await docClient.send(new GetCommand({
            TableName: TABLES.USERS,
            Key: { pk: `FILE#${fileId}`, sk: 'METADATA' }
        }));

        if (!result.Item) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Delete from S3
        if (result.Item.s3Key) {
            await s3Client.send(new DeleteObjectCommand({
                Bucket: S3_BUCKET,
                Key: result.Item.s3Key
            }));
        }

        // Delete metadata from DynamoDB
        await docClient.send(new DeleteCommand({
            TableName: TABLES.USERS,
            Key: { pk: `FILE#${fileId}`, sk: 'METADATA' }
        }));

        res.json({ success: true, message: 'File deleted from S3' });

    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Get storage stats
router.get('/stats/summary', async (req, res) => {
    try {
        let files = [];

        if (!isAWSConfigured()) {
            files = [...localFiles];
        } else {
            const result = await docClient.send(new ScanCommand({
                TableName: TABLES.USERS,
                FilterExpression: 'dataType = :type',
                ExpressionAttributeValues: { ':type': 'admin_file' }
            }));
            files = result.Items || [];
        }

        const totalSize = files.reduce((sum, f) => sum + (parseInt(f.fileSize) || 0), 0);
        const byCategory = {};
        
        FILE_CATEGORIES.forEach(cat => {
            const catFiles = files.filter(f => f.category === cat);
            byCategory[cat] = {
                count: catFiles.length,
                size: catFiles.reduce((sum, f) => sum + (parseInt(f.fileSize) || 0), 0)
            };
        });

        const recentFiles = files
            .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
            .slice(0, 10);

        res.json({
            totalFiles: files.length,
            totalSize,
            totalSizeFormatted: formatBytes(totalSize),
            byCategory,
            categories: FILE_CATEGORIES,
            recentFiles: recentFiles.map(f => ({
                id: f.id || f.fileId,
                fileName: f.originalName || f.fileName,
                category: f.category,
                uploadedAt: f.uploadedAt,
                fileSize: f.fileSize
            }))
        });

    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: error.message });
    }
});

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = router;

