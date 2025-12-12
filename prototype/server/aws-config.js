/**
 * AWS Configuration
 * Initializes AWS SDK clients for S3 and DynamoDB
 * 
 * Enhanced with resilience patterns based on stress test results:
 * - Circuit breakers for fault tolerance
 * - Retry with exponential backoff + jitter
 * - Connection pooling and keep-alive
 * - Multi-tier caching support
 */

const { S3Client } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { NodeHttpHandler } = require('@aws-sdk/node-http-handler');
const https = require('https');

// Check if AWS is configured
const isAWSConfigured = () => {
    return !!(
        process.env.AWS_ACCESS_KEY_ID && 
        process.env.AWS_SECRET_ACCESS_KEY && 
        process.env.AWS_REGION
    );
};

// Optimized HTTPS agent with connection pooling
const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 50,  // Increased for high concurrency
    maxFreeSockets: 10,
    timeout: 5000
});

// Custom HTTP handler for better performance
const httpHandler = new NodeHttpHandler({
    httpsAgent,
    connectionTimeout: 3000,
    socketTimeout: 5000
});

// AWS Configuration with retry settings
const awsConfig = {
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: process.env.AWS_ACCESS_KEY_ID ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    } : undefined,
    requestHandler: httpHandler,
    // Built-in retry configuration
    maxAttempts: 3
};

// S3 Client for file storage
const s3Client = new S3Client({
    ...awsConfig,
    // S3-specific settings
    forcePathStyle: false,
    useAccelerateEndpoint: process.env.S3_ACCELERATE === 'true'
});

// DynamoDB Client for data storage with optimized settings
const dynamoClient = new DynamoDBClient({
    ...awsConfig,
    // DynamoDB-specific retry settings
    maxAttempts: 5
});

// Document Client with marshalling options
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
    marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: false
    },
    unmarshallOptions: {
        wrapNumbers: false
    }
});

// Table names
const TABLES = {
    USERS: process.env.AWS_DYNAMODB_TABLE || 'oith-admin-data',
    PROFILES: process.env.PROFILES_TABLE || 'oith-profiles',
    MATCHES: process.env.MATCHES_TABLE || 'oith-matches',
    CONVERSATIONS: process.env.CONVERSATIONS_TABLE || 'oith-conversations',
    ANALYTICS: process.env.ANALYTICS_TABLE || 'oith-analytics'
};

// S3 Buckets
const S3_BUCKETS = {
    DOCUMENTS: process.env.AWS_S3_BUCKET || 'oith-admin-documents',
    PHOTOS: process.env.S3_PHOTOS_BUCKET || 'oith-user-photos',
    BACKUPS: process.env.S3_BACKUPS_BUCKET || 'oith-backups'
};

// Legacy export for backwards compatibility
const S3_BUCKET = S3_BUCKETS.DOCUMENTS;

// ==========================================
// RESILIENT WRAPPER FUNCTIONS
// ==========================================

let resilience = null;
let caching = null;

// Lazy load resilience module
function getResilience() {
    if (!resilience) {
        try {
            resilience = require('./utils/resilience');
        } catch (e) {
            console.warn('Resilience module not available, using direct calls');
            resilience = {
                resilientCall: async (name, fn) => fn(),
                circuitBreakers: {},
                getResilienceHealth: () => ({ status: 'module_not_loaded' })
            };
        }
    }
    return resilience;
}

// Lazy load caching module
function getCaching() {
    if (!caching) {
        try {
            caching = require('./utils/caching');
        } catch (e) {
            console.warn('Caching module not available');
            caching = {
                profileCache: { get: () => null, set: () => {} },
                getCacheManager: () => null
            };
        }
    }
    return caching;
}

/**
 * Resilient DynamoDB operation with circuit breaker and retry
 */
async function resilientDynamoDBCall(operation) {
    const { resilientCall } = getResilience();
    return resilientCall('dynamodb', operation, {
        maxRetries: 3,
        baseDelayMs: 50
    });
}

/**
 * Resilient S3 operation with circuit breaker and retry
 */
async function resilientS3Call(operation) {
    const { resilientCall } = getResilience();
    return resilientCall('s3', operation, {
        maxRetries: 3,
        baseDelayMs: 100
    });
}

/**
 * Get health status of all AWS connections
 */
function getAWSHealth() {
    const { getResilienceHealth } = getResilience();
    return {
        isConfigured: isAWSConfigured(),
        region: process.env.AWS_REGION || 'us-east-1',
        resilience: getResilienceHealth(),
        tables: TABLES,
        buckets: S3_BUCKETS
    };
}

// ==========================================
// DAX CLIENT (Optional - for production)
// ==========================================

let daxClient = null;

async function getDaxClient() {
    if (daxClient) return daxClient;
    
    const daxEndpoints = process.env.DAX_ENDPOINTS;
    if (!daxEndpoints) {
        console.log('DAX not configured, using standard DynamoDB');
        return null;
    }
    
    try {
        const { getCaching } = require('./utils/caching');
        const { DAXCache } = getCaching();
        
        const daxCache = new DAXCache({
            endpoints: daxEndpoints.split(','),
            region: process.env.AWS_REGION
        });
        
        daxClient = await daxCache.connect();
        return daxClient;
    } catch (error) {
        console.error('Failed to connect to DAX:', error.message);
        return null;
    }
}

module.exports = {
    // Clients
    s3Client,
    docClient,
    dynamoClient,
    
    // Configuration
    TABLES,
    S3_BUCKET,
    S3_BUCKETS,
    isAWSConfigured,
    
    // Resilient operations
    resilientDynamoDBCall,
    resilientS3Call,
    getAWSHealth,
    
    // DAX (production caching)
    getDaxClient,
    
    // Module accessors
    getResilience,
    getCaching
};

