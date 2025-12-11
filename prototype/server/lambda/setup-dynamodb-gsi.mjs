/**
 * DynamoDB Table Setup with GSI for OITH Matching
 * 
 * Run this script to create or update DynamoDB tables with
 * the required Global Secondary Indexes for optimized matching.
 * 
 * Usage:
 *   node setup-dynamodb-gsi.mjs
 *   node setup-dynamodb-gsi.mjs --create    # Create new tables
 *   node setup-dynamodb-gsi.mjs --update    # Update existing tables with GSI
 *   node setup-dynamodb-gsi.mjs --status    # Check current GSI status
 * 
 * Required environment variables:
 *   AWS_REGION (default: us-east-1)
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 */

import { 
    DynamoDBClient, 
    CreateTableCommand,
    UpdateTableCommand,
    DescribeTableCommand,
    ListTablesCommand
} from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({ 
    region: process.env.AWS_REGION || 'us-east-1' 
});

// ==========================================
// TABLE DEFINITIONS
// ==========================================

const TABLES = {
    // Main profiles table with GSIs for efficient matching
    profiles: {
        TableName: 'oith-profiles',
        KeySchema: [
            { AttributeName: 'email', KeyType: 'HASH' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'email', AttributeType: 'S' },
            { AttributeName: 'geohash_prefix', AttributeType: 'S' },
            { AttributeName: 'lastSeen', AttributeType: 'S' },
            { AttributeName: 'gender', AttributeType: 'S' }
        ],
        GlobalSecondaryIndexes: [
            // GSI 1: Location-based queries (geohash + lastSeen)
            // Use case: Find active users near a location
            {
                IndexName: 'geohash-lastSeen-index',
                KeySchema: [
                    { AttributeName: 'geohash_prefix', KeyType: 'HASH' },
                    { AttributeName: 'lastSeen', KeyType: 'RANGE' }
                ],
                Projection: { ProjectionType: 'ALL' },
                ProvisionedThroughput: {
                    ReadCapacityUnits: 10,
                    WriteCapacityUnits: 5
                }
            },
            // GSI 2: Gender + Location queries (most efficient for matching)
            // Use case: Find women in a specific area
            {
                IndexName: 'gender-geohash-index',
                KeySchema: [
                    { AttributeName: 'gender', KeyType: 'HASH' },
                    { AttributeName: 'geohash_prefix', KeyType: 'RANGE' }
                ],
                Projection: { ProjectionType: 'ALL' },
                ProvisionedThroughput: {
                    ReadCapacityUnits: 10,
                    WriteCapacityUnits: 5
                }
            }
        ],
        BillingMode: 'PROVISIONED',
        ProvisionedThroughput: {
            ReadCapacityUnits: 25,
            WriteCapacityUnits: 10
        }
    },
    
    // Match history table
    matchHistory: {
        TableName: 'oith-match-history',
        KeySchema: [
            { AttributeName: 'userEmail', KeyType: 'HASH' },
            { AttributeName: 'matchEmail', KeyType: 'RANGE' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'userEmail', AttributeType: 'S' },
            { AttributeName: 'matchEmail', AttributeType: 'S' },
            { AttributeName: 'action', AttributeType: 'S' },
            { AttributeName: 'timestamp', AttributeType: 'S' }
        ],
        GlobalSecondaryIndexes: [
            // GSI: Query by action type (find all passes, accepts, etc.)
            {
                IndexName: 'action-timestamp-index',
                KeySchema: [
                    { AttributeName: 'action', KeyType: 'HASH' },
                    { AttributeName: 'timestamp', KeyType: 'RANGE' }
                ],
                Projection: { ProjectionType: 'ALL' },
                ProvisionedThroughput: {
                    ReadCapacityUnits: 5,
                    WriteCapacityUnits: 5
                }
            }
        ],
        BillingMode: 'PROVISIONED',
        ProvisionedThroughput: {
            ReadCapacityUnits: 10,
            WriteCapacityUnits: 10
        }
    },
    
    // Blocks table with GSI for reverse lookups
    blocks: {
        TableName: 'oith-blocks',
        KeySchema: [
            { AttributeName: 'blockerEmail', KeyType: 'HASH' },
            { AttributeName: 'blockedEmail', KeyType: 'RANGE' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'blockerEmail', AttributeType: 'S' },
            { AttributeName: 'blockedEmail', AttributeType: 'S' }
        ],
        GlobalSecondaryIndexes: [
            // GSI: Reverse lookup - who blocked this user?
            // Critical for efficient exclusion list building
            {
                IndexName: 'blockedEmail-blockerEmail-index',
                KeySchema: [
                    { AttributeName: 'blockedEmail', KeyType: 'HASH' },
                    { AttributeName: 'blockerEmail', KeyType: 'RANGE' }
                ],
                Projection: { ProjectionType: 'KEYS_ONLY' },
                ProvisionedThroughput: {
                    ReadCapacityUnits: 5,
                    WriteCapacityUnits: 5
                }
            }
        ],
        BillingMode: 'PROVISIONED',
        ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
        }
    },
    
    // Active matches table
    matches: {
        TableName: 'oith-matches',
        KeySchema: [
            { AttributeName: 'matchId', KeyType: 'HASH' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'matchId', AttributeType: 'S' },
            { AttributeName: 'userEmail', AttributeType: 'S' },
            { AttributeName: 'status', AttributeType: 'S' }
        ],
        GlobalSecondaryIndexes: [
            // GSI: Find matches by user email
            {
                IndexName: 'userEmail-status-index',
                KeySchema: [
                    { AttributeName: 'userEmail', KeyType: 'HASH' },
                    { AttributeName: 'status', KeyType: 'RANGE' }
                ],
                Projection: { ProjectionType: 'ALL' },
                ProvisionedThroughput: {
                    ReadCapacityUnits: 5,
                    WriteCapacityUnits: 5
                }
            }
        ],
        BillingMode: 'PROVISIONED',
        ProvisionedThroughput: {
            ReadCapacityUnits: 10,
            WriteCapacityUnits: 10
        }
    },
    
    // Notifications table
    notifications: {
        TableName: 'oith-notifications',
        KeySchema: [
            { AttributeName: 'userEmail', KeyType: 'HASH' },
            { AttributeName: 'notificationId', KeyType: 'RANGE' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'userEmail', AttributeType: 'S' },
            { AttributeName: 'notificationId', AttributeType: 'S' }
        ],
        BillingMode: 'PROVISIONED',
        ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
        }
    },
    
    // Conversations/chat table
    conversations: {
        TableName: 'oith-conversations',
        KeySchema: [
            { AttributeName: 'conversationId', KeyType: 'HASH' },
            { AttributeName: 'messageId', KeyType: 'RANGE' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'conversationId', AttributeType: 'S' },
            { AttributeName: 'messageId', AttributeType: 'S' }
        ],
        BillingMode: 'PROVISIONED',
        ProvisionedThroughput: {
            ReadCapacityUnits: 10,
            WriteCapacityUnits: 10
        }
    },
    
    // Reports table
    reports: {
        TableName: 'oith-reports',
        KeySchema: [
            { AttributeName: 'reportId', KeyType: 'HASH' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'reportId', AttributeType: 'S' },
            { AttributeName: 'status', AttributeType: 'S' },
            { AttributeName: 'createdAt', AttributeType: 'S' }
        ],
        GlobalSecondaryIndexes: [
            // GSI: Find reports by status for moderation
            {
                IndexName: 'status-createdAt-index',
                KeySchema: [
                    { AttributeName: 'status', KeyType: 'HASH' },
                    { AttributeName: 'createdAt', KeyType: 'RANGE' }
                ],
                Projection: { ProjectionType: 'ALL' },
                ProvisionedThroughput: {
                    ReadCapacityUnits: 2,
                    WriteCapacityUnits: 2
                }
            }
        ],
        BillingMode: 'PROVISIONED',
        ProvisionedThroughput: {
            ReadCapacityUnits: 2,
            WriteCapacityUnits: 2
        }
    }
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

async function tableExists(tableName) {
    try {
        await client.send(new DescribeTableCommand({ TableName: tableName }));
        return true;
    } catch (err) {
        if (err.name === 'ResourceNotFoundException') {
            return false;
        }
        throw err;
    }
}

async function getTableGSIs(tableName) {
    try {
        const result = await client.send(new DescribeTableCommand({ TableName: tableName }));
        return result.Table.GlobalSecondaryIndexes || [];
    } catch (err) {
        return [];
    }
}

async function waitForTableActive(tableName, maxWaitSeconds = 120) {
    console.log(`  Waiting for ${tableName} to become ACTIVE...`);
    const startTime = Date.now();
    
    while (true) {
        const result = await client.send(new DescribeTableCommand({ TableName: tableName }));
        const status = result.Table.TableStatus;
        
        // Check GSI statuses too
        const gsiStatuses = (result.Table.GlobalSecondaryIndexes || []).map(g => g.IndexStatus);
        const allActive = status === 'ACTIVE' && gsiStatuses.every(s => s === 'ACTIVE');
        
        if (allActive) {
            console.log(`  ✅ ${tableName} is ACTIVE`);
            return;
        }
        
        if ((Date.now() - startTime) / 1000 > maxWaitSeconds) {
            throw new Error(`Timeout waiting for ${tableName} to become ACTIVE`);
        }
        
        process.stdout.write('.');
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
}

// ==========================================
// CREATE TABLES
// ==========================================

async function createTables() {
    console.log('\n📦 Creating DynamoDB Tables with GSIs\n');
    console.log('=' .repeat(60));
    
    for (const [key, tableConfig] of Object.entries(TABLES)) {
        const tableName = tableConfig.TableName;
        console.log(`\n📋 ${tableName}`);
        
        if (await tableExists(tableName)) {
            console.log(`  ⚠️ Table already exists, skipping creation`);
            continue;
        }
        
        try {
            await client.send(new CreateTableCommand(tableConfig));
            console.log(`  ✅ Created table`);
            
            if (tableConfig.GlobalSecondaryIndexes) {
                console.log(`  📊 GSIs: ${tableConfig.GlobalSecondaryIndexes.map(g => g.IndexName).join(', ')}`);
            }
            
            await waitForTableActive(tableName);
        } catch (err) {
            console.log(`  ❌ Error: ${err.message}`);
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Table creation complete\n');
}

// ==========================================
// UPDATE EXISTING TABLES WITH GSI
// ==========================================

async function updateTablesWithGSI() {
    console.log('\n🔄 Updating Existing Tables with GSIs\n');
    console.log('='.repeat(60));
    
    // Focus on the profiles table which needs GSIs most
    const tableName = 'oith-profiles';
    console.log(`\n📋 ${tableName}`);
    
    if (!await tableExists(tableName)) {
        console.log('  ⚠️ Table does not exist. Run with --create first.');
        return;
    }
    
    const existingGSIs = await getTableGSIs(tableName);
    const existingGSINames = existingGSIs.map(g => g.IndexName);
    console.log(`  Current GSIs: ${existingGSINames.join(', ') || 'none'}`);
    
    const requiredGSIs = TABLES.profiles.GlobalSecondaryIndexes;
    
    for (const gsi of requiredGSIs) {
        if (existingGSINames.includes(gsi.IndexName)) {
            console.log(`  ✓ ${gsi.IndexName} already exists`);
            continue;
        }
        
        console.log(`  Creating GSI: ${gsi.IndexName}...`);
        
        try {
            await client.send(new UpdateTableCommand({
                TableName: tableName,
                AttributeDefinitions: TABLES.profiles.AttributeDefinitions,
                GlobalSecondaryIndexUpdates: [
                    {
                        Create: gsi
                    }
                ]
            }));
            
            console.log(`  ⏳ GSI creation initiated. This may take 5-10 minutes.`);
            await waitForTableActive(tableName, 600); // 10 minute timeout for GSI
            console.log(`  ✅ ${gsi.IndexName} created successfully`);
        } catch (err) {
            console.log(`  ❌ Error creating ${gsi.IndexName}: ${err.message}`);
        }
        
        // Wait between GSI creations (DynamoDB limit: 1 GSI operation at a time)
        if (requiredGSIs.indexOf(gsi) < requiredGSIs.length - 1) {
            console.log('  Waiting 30s before next GSI...');
            await new Promise(resolve => setTimeout(resolve, 30000));
        }
    }
    
    // Update blocks table for reverse lookup GSI
    const blocksTable = 'oith-blocks';
    console.log(`\n📋 ${blocksTable}`);
    
    if (await tableExists(blocksTable)) {
        const blocksGSIs = await getTableGSIs(blocksTable);
        const blocksGSINames = blocksGSIs.map(g => g.IndexName);
        
        const reverseGSI = TABLES.blocks.GlobalSecondaryIndexes[0];
        
        if (!blocksGSINames.includes(reverseGSI.IndexName)) {
            console.log(`  Creating GSI: ${reverseGSI.IndexName}...`);
            
            try {
                await client.send(new UpdateTableCommand({
                    TableName: blocksTable,
                    AttributeDefinitions: TABLES.blocks.AttributeDefinitions,
                    GlobalSecondaryIndexUpdates: [
                        { Create: reverseGSI }
                    ]
                }));
                
                await waitForTableActive(blocksTable, 600);
                console.log(`  ✅ ${reverseGSI.IndexName} created successfully`);
            } catch (err) {
                console.log(`  ❌ Error: ${err.message}`);
            }
        } else {
            console.log(`  ✓ ${reverseGSI.IndexName} already exists`);
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ GSI update complete\n');
}

// ==========================================
// CHECK STATUS
// ==========================================

async function checkStatus() {
    console.log('\n📊 DynamoDB Table Status\n');
    console.log('='.repeat(60));
    
    for (const [key, tableConfig] of Object.entries(TABLES)) {
        const tableName = tableConfig.TableName;
        console.log(`\n📋 ${tableName}`);
        
        if (!await tableExists(tableName)) {
            console.log('  ❌ Does not exist');
            continue;
        }
        
        try {
            const result = await client.send(new DescribeTableCommand({ TableName: tableName }));
            const table = result.Table;
            
            console.log(`  Status: ${table.TableStatus}`);
            console.log(`  Items: ${table.ItemCount?.toLocaleString() || 0}`);
            console.log(`  Size: ${((table.TableSizeBytes || 0) / 1024 / 1024).toFixed(2)} MB`);
            
            if (table.GlobalSecondaryIndexes?.length > 0) {
                console.log(`  GSIs:`);
                for (const gsi of table.GlobalSecondaryIndexes) {
                    console.log(`    - ${gsi.IndexName}: ${gsi.IndexStatus} (${gsi.ItemCount?.toLocaleString() || 0} items)`);
                }
            } else {
                console.log(`  GSIs: none`);
            }
        } catch (err) {
            console.log(`  ❌ Error: ${err.message}`);
        }
    }
    
    // Check for required GSIs
    console.log('\n' + '='.repeat(60));
    console.log('\n🔍 Required GSI Check\n');
    
    const profilesGSIs = await getTableGSIs('oith-profiles');
    const profilesGSINames = profilesGSIs.map(g => g.IndexName);
    
    const required = [
        'geohash-lastSeen-index',
        'gender-geohash-index'
    ];
    
    let allPresent = true;
    for (const gsi of required) {
        const exists = profilesGSINames.includes(gsi);
        console.log(`  ${exists ? '✅' : '❌'} ${gsi}`);
        if (!exists) allPresent = false;
    }
    
    if (!allPresent) {
        console.log('\n⚠️ Some required GSIs are missing!');
        console.log('Run: node setup-dynamodb-gsi.mjs --update');
    } else {
        console.log('\n✅ All required GSIs are present');
    }
    
    console.log('');
}

// ==========================================
// MAIN
// ==========================================

async function main() {
    const args = process.argv.slice(2);
    
    console.log('\n🗄️ OITH DynamoDB Setup Tool\n');
    
    if (args.includes('--create')) {
        await createTables();
    } else if (args.includes('--update')) {
        await updateTablesWithGSI();
    } else if (args.includes('--status')) {
        await checkStatus();
    } else {
        console.log('Usage:');
        console.log('  node setup-dynamodb-gsi.mjs --create   Create all tables with GSIs');
        console.log('  node setup-dynamodb-gsi.mjs --update   Add GSIs to existing tables');
        console.log('  node setup-dynamodb-gsi.mjs --status   Check table and GSI status');
        console.log('');
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});

