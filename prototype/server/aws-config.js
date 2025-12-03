/**
 * AWS Configuration
 * Initializes AWS SDK clients for S3 and DynamoDB
 */

const { S3Client } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

// Check if AWS is configured
const isAWSConfigured = () => {
    return !!(
        process.env.AWS_ACCESS_KEY_ID && 
        process.env.AWS_SECRET_ACCESS_KEY && 
        process.env.AWS_REGION
    );
};

// AWS Configuration
const awsConfig = {
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: process.env.AWS_ACCESS_KEY_ID ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    } : undefined
};

// S3 Client for file storage
const s3Client = new S3Client(awsConfig);

// DynamoDB Client for data storage
const dynamoClient = new DynamoDBClient(awsConfig);
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
    marshallOptions: {
        removeUndefinedValues: true
    }
});

// Table names
const TABLES = {
    USERS: process.env.AWS_DYNAMODB_TABLE || 'oith-admin-data',
    // All data stored in single table with partition keys for different data types
};

// S3 Bucket
const S3_BUCKET = process.env.AWS_S3_BUCKET || 'oith-admin-documents';

module.exports = {
    s3Client,
    docClient,
    dynamoClient,
    TABLES,
    S3_BUCKET,
    isAWSConfigured
};

