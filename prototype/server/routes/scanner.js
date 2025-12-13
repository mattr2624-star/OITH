/**
 * Document Scanner API Routes
 * Scans company folder for document completeness against established tasks
 * Calibrates overall progress and saves to AWS
 * 
 * Features:
 * - Scans company/ folder for markdown documents
 * - Matches against established task registry
 * - Calculates completion percentage per category
 * - Saves progress to AWS DynamoDB (with local JSON backup)
 * - Auto-syncs local data to AWS when connection restored
 */

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { docClient, TABLES, isAWSConfigured } = require('../aws-config');
const { PutCommand, GetCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

// ==========================================
// LOCAL STORAGE BACKUP (for offline/no-AWS scenarios)
// ==========================================
const LOCAL_STORAGE_PATH = path.resolve(__dirname, '../../data/scanner_progress.json');

/**
 * Load progress from local JSON file
 */
async function loadLocalProgress() {
    try {
        const data = await fs.readFile(LOCAL_STORAGE_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return null;
    }
}

/**
 * Save progress to local JSON file
 */
async function saveLocalProgress(data) {
    try {
        // Ensure directory exists
        const dir = path.dirname(LOCAL_STORAGE_PATH);
        await fs.mkdir(dir, { recursive: true });
        
        await fs.writeFile(LOCAL_STORAGE_PATH, JSON.stringify(data, null, 2));
        console.log('📁 Scanner progress saved to local file');
        return true;
    } catch (error) {
        console.error('Failed to save local progress:', error.message);
        return false;
    }
}

/**
 * Save progress to AWS DynamoDB with retry
 */
async function saveToAWS(data, retries = 3) {
    if (!isAWSConfigured()) {
        return { success: false, reason: 'AWS not configured' };
    }
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            // Save timestamped record
            await docClient.send(new PutCommand({
                TableName: TABLES.USERS,
                Item: {
                    pk: 'SCANNER#PROGRESS',
                    sk: `SCAN#${data.timestamp}`,
                    ...data,
                    ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90 days TTL
                }
            }));
            
            // Save as latest
            await docClient.send(new PutCommand({
                TableName: TABLES.USERS,
                Item: {
                    pk: 'SCANNER#PROGRESS',
                    sk: 'LATEST',
                    ...data
                }
            }));
            
            console.log(`✅ Scanner progress saved to AWS (attempt ${attempt})`);
            return { success: true };
        } catch (error) {
            console.error(`AWS save attempt ${attempt} failed:`, error.message);
            if (attempt === retries) {
                return { success: false, reason: error.message };
            }
            // Wait before retry with exponential backoff
            await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 100));
        }
    }
}

/**
 * Load progress from AWS DynamoDB
 */
async function loadFromAWS() {
    if (!isAWSConfigured()) {
        return null;
    }
    
    try {
        const result = await docClient.send(new GetCommand({
            TableName: TABLES.USERS,
            Key: {
                pk: 'SCANNER#PROGRESS',
                sk: 'LATEST'
            }
        }));
        
        return result.Item || null;
    } catch (error) {
        console.error('Failed to load from AWS:', error.message);
        return null;
    }
}

/**
 * Sync local data to AWS (for when AWS connection is restored)
 */
async function syncLocalToAWS() {
    const localData = await loadLocalProgress();
    if (!localData) return { synced: false, reason: 'No local data' };
    
    if (!isAWSConfigured()) {
        return { synced: false, reason: 'AWS not configured' };
    }
    
    const awsData = await loadFromAWS();
    
    // If local is newer than AWS, sync to AWS
    if (!awsData || new Date(localData.timestamp) > new Date(awsData.timestamp || 0)) {
        const result = await saveToAWS(localData);
        if (result.success) {
            return { synced: true, message: 'Local data synced to AWS' };
        }
        return { synced: false, reason: result.reason };
    }
    
    return { synced: false, reason: 'AWS data is current' };
}

// ==========================================
// TASK DEFINITIONS - From VC Checklist & Launch Requirements
// ==========================================

const TASK_REGISTRY = {
    // PHASE 1: COMPANY FOUNDATION
    'business-formation': {
        category: 'Foundation',
        phase: 1,
        tasks: [
            { id: 'llc-registration', name: 'LLC Registration', requiredDocs: ['ARTICLES_OF_ORGANIZATION'] },
            { id: 'ein-application', name: 'EIN Application', requiredDocs: ['EIN_APPLICATION_GUIDE'] },
            { id: 'operating-agreement', name: 'Operating Agreement', requiredDocs: ['OPERATING_AGREEMENT'] },
            { id: 'org-chart', name: 'Organizational Chart', requiredDocs: ['ORGANIZATIONAL_CHART'] },
            { id: 'authority-matrix', name: 'Authority Matrix', requiredDocs: ['AUTHORITY_MATRIX'] }
        ]
    },
    
    // PHASE 2: LEGAL & IP
    'legal-foundation': {
        category: 'Legal',
        phase: 2,
        tasks: [
            { id: 'ai-ethics', name: 'AI Ethics Policy', requiredDocs: ['AI_ETHICS_POLICY'] },
            { id: 'app-store-requirements', name: 'App Store Publishing Requirements', requiredDocs: ['APP_STORE_PUBLISHING_REQUIREMENTS'] },
            { id: 'nda-template', name: 'NDA Template', requiredDocs: ['NDA_TEMPLATE'] },
            { id: 'contractor-agreement', name: 'Contractor Agreement', requiredDocs: ['CONTRACTOR_AGREEMENT'] }
        ]
    },
    
    // COMPLIANCE
    'compliance': {
        category: 'Compliance',
        phase: 2,
        tasks: [
            { id: 'compliance-overview', name: 'Compliance Overview', requiredDocs: ['COMPLIANCE_OVERVIEW'] },
            { id: 'app-store-compliance', name: 'App Store Compliance', requiredDocs: ['APP_STORE_COMPLIANCE'] },
            { id: 'business-continuity', name: 'Business Continuity', requiredDocs: ['BUSINESS_CONTINUITY'] },
            { id: 'feature-gap', name: 'Feature Gap Analysis', requiredDocs: ['FEATURE_GAP_ANALYSIS'] },
            { id: 'fraud-prevention', name: 'Fraud Prevention', requiredDocs: ['FRAUD_PREVENTION'] },
            { id: 'infrastructure-docs', name: 'Infrastructure Documentation', requiredDocs: ['INFRASTRUCTURE_DOCUMENTATION'] },
            { id: 'legal-documents', name: 'Legal Documents Required', requiredDocs: ['LEGAL_DOCUMENTS_REQUIRED'] },
            { id: 'operational-compliance', name: 'Operational Compliance', requiredDocs: ['OPERATIONAL_COMPLIANCE'] },
            { id: 'payment-compliance', name: 'Payment Compliance', requiredDocs: ['PAYMENT_COMPLIANCE'] },
            { id: 'privacy-data', name: 'Privacy & Data Protection', requiredDocs: ['PRIVACY_DATA_PROTECTION'] },
            { id: 'security-data', name: 'Security & Data Handling', requiredDocs: ['SECURITY_DATA_HANDLING'] },
            { id: 'user-identity', name: 'User Identity & Safety', requiredDocs: ['USER_IDENTITY_SAFETY'] }
        ]
    },
    
    // FINANCE
    'finance': {
        category: 'Finance',
        phase: 1,
        tasks: [
            { id: 'capital-structure', name: 'Capital Structure', requiredDocs: ['CAPITAL_STRUCTURE'] },
            { id: 'cost-breakdown', name: 'Detailed Cost Breakdown', requiredDocs: ['DETAILED_COST_BREAKDOWN'] },
            { id: 'initial-budget', name: 'Initial Budget', requiredDocs: ['INITIAL_BUDGET'] },
            { id: 'revenue-projections', name: 'Revenue Projections', requiredDocs: ['REVENUE_PROJECTIONS'] }
        ]
    },
    
    // OPERATIONS
    'operations': {
        category: 'Operations',
        phase: 3,
        tasks: [
            { id: 'company-policies', name: 'Company Policies', requiredDocs: ['COMPANY_POLICIES'] },
            { id: 'department-missions', name: 'Department Missions', requiredDocs: ['DEPARTMENT_MISSIONS'] },
            { id: 'launch-requirements', name: 'Launch Requirements', requiredDocs: ['LAUNCH_REQUIREMENTS_FEB_2026'] },
            { id: 'test-plan', name: 'Test Plan', requiredDocs: ['TEST_PLAN'] }
        ]
    },
    
    // MARKETING
    'marketing': {
        category: 'Marketing',
        phase: 4,
        tasks: [
            { id: 'marketing-overview', name: 'Marketing Overview', requiredDocs: ['MARKETING_OVERVIEW'] },
            { id: 'advertising-strategy', name: 'Advertising Strategy', requiredDocs: ['ADVERTISING_STRATEGY'] }
        ]
    },
    
    // TEMPLATES & BRANDING
    'templates': {
        category: 'Templates',
        phase: 5,
        tasks: [
            { id: 'brand-guide', name: 'Brand Guide', requiredDocs: ['BRAND_GUIDE'] },
            { id: 'one-pager', name: 'One Pager', requiredDocs: ['ONE_PAGER'] },
            { id: 'pitch-deck', name: 'Pitch Deck Outline', requiredDocs: ['PITCH_DECK_OUTLINE'] }
        ]
    },
    
    // VC READINESS
    'vc-readiness': {
        category: 'VC Readiness',
        phase: 5,
        tasks: [
            { id: 'vc-checklist', name: 'VC Readiness Checklist', requiredDocs: ['VC_READINESS_CHECKLIST'] },
            { id: 'company-overview', name: 'Company Overview', requiredDocs: ['COMPANY_OVERVIEW'] }
        ]
    }
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Recursively scan a directory for all markdown files
 */
async function scanDirectory(dirPath, basePath = '') {
    const files = [];
    
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const relativePath = path.join(basePath, entry.name);
            
            if (entry.isDirectory()) {
                const subFiles = await scanDirectory(fullPath, relativePath);
                files.push(...subFiles);
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                // Extract document name without extension
                const docName = entry.name.replace('.md', '');
                files.push({
                    name: docName,
                    path: relativePath,
                    fullPath: fullPath
                });
            }
        }
    } catch (error) {
        console.error(`Error scanning directory ${dirPath}:`, error.message);
    }
    
    return files;
}

/**
 * Analyze document content for completeness indicators
 */
async function analyzeDocument(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        
        const analysis = {
            exists: true,
            lineCount: lines.length,
            wordCount: content.split(/\s+/).filter(w => w.length > 0).length,
            hasHeaders: (content.match(/^#+\s/gm) || []).length,
            hasTables: (content.match(/\|.*\|/g) || []).length,
            hasChecklists: (content.match(/- \[[ x]\]/gi) || []).length,
            completedChecks: (content.match(/- \[x\]/gi) || []).length,
            pendingChecks: (content.match(/- \[ \]/g) || []).length,
            hasContent: content.trim().length > 100,
            lastModified: null
        };
        
        // Get file stats for last modified time
        try {
            const stats = await fs.stat(filePath);
            analysis.lastModified = stats.mtime.toISOString();
        } catch (e) {
            // Ignore stat errors
        }
        
        // Calculate document quality score (0-100)
        let qualityScore = 0;
        if (analysis.hasContent) qualityScore += 30;
        if (analysis.hasHeaders > 0) qualityScore += 15;
        if (analysis.lineCount > 50) qualityScore += 15;
        if (analysis.wordCount > 200) qualityScore += 15;
        if (analysis.hasTables > 0) qualityScore += 10;
        if (analysis.hasChecklists > 0) {
            const checklistCompletion = analysis.completedChecks / (analysis.completedChecks + analysis.pendingChecks);
            qualityScore += Math.round(checklistCompletion * 15);
        } else {
            qualityScore += 15; // No checklists = assume complete
        }
        
        analysis.qualityScore = Math.min(qualityScore, 100);
        
        return analysis;
    } catch (error) {
        return {
            exists: false,
            error: error.message,
            qualityScore: 0
        };
    }
}

/**
 * Calculate overall progress from task results
 */
function calculateProgress(taskResults) {
    const totals = {
        totalTasks: 0,
        completedTasks: 0,
        partialTasks: 0,
        missingTasks: 0,
        overallScore: 0,
        byCategory: {},
        byPhase: {}
    };
    
    for (const [groupId, group] of Object.entries(taskResults)) {
        const category = group.category;
        const phase = group.phase;
        
        if (!totals.byCategory[category]) {
            totals.byCategory[category] = { total: 0, completed: 0, score: 0 };
        }
        if (!totals.byPhase[phase]) {
            totals.byPhase[phase] = { total: 0, completed: 0, score: 0 };
        }
        
        for (const task of group.tasks) {
            totals.totalTasks++;
            totals.byCategory[category].total++;
            totals.byPhase[phase].total++;
            
            if (task.status === 'complete') {
                totals.completedTasks++;
                totals.byCategory[category].completed++;
                totals.byPhase[phase].completed++;
            } else if (task.status === 'partial') {
                totals.partialTasks++;
                totals.byCategory[category].completed += 0.5;
                totals.byPhase[phase].completed += 0.5;
            } else {
                totals.missingTasks++;
            }
            
            totals.overallScore += task.score || 0;
            totals.byCategory[category].score += task.score || 0;
            totals.byPhase[phase].score += task.score || 0;
        }
    }
    
    // Calculate percentages
    totals.overallPercentage = totals.totalTasks > 0 
        ? Math.round((totals.overallScore / (totals.totalTasks * 100)) * 100) 
        : 0;
    
    for (const cat of Object.values(totals.byCategory)) {
        cat.percentage = cat.total > 0 ? Math.round((cat.completed / cat.total) * 100) : 0;
        cat.avgScore = cat.total > 0 ? Math.round(cat.score / cat.total) : 0;
    }
    
    for (const phase of Object.values(totals.byPhase)) {
        phase.percentage = phase.total > 0 ? Math.round((phase.completed / phase.total) * 100) : 0;
        phase.avgScore = phase.total > 0 ? Math.round(phase.score / phase.total) : 0;
    }
    
    return totals;
}

// ==========================================
// API ROUTES
// ==========================================

/**
 * GET /api/scanner/scan
 * Perform full document scan of company folder
 */
router.get('/scan', async (req, res) => {
    try {
        // Determine company folder path
        const companyPath = path.resolve(__dirname, '../../../company');
        
        console.log('📂 Scanning company folder:', companyPath);
        
        // Scan all documents
        const foundDocs = await scanDirectory(companyPath);
        console.log(`📄 Found ${foundDocs.length} documents`);
        
        // Create lookup map
        const docMap = {};
        for (const doc of foundDocs) {
            docMap[doc.name] = doc;
        }
        
        // Analyze each task group
        const taskResults = {};
        
        for (const [groupId, group] of Object.entries(TASK_REGISTRY)) {
            taskResults[groupId] = {
                category: group.category,
                phase: group.phase,
                tasks: []
            };
            
            for (const task of group.tasks) {
                const taskResult = {
                    id: task.id,
                    name: task.name,
                    requiredDocs: task.requiredDocs,
                    foundDocs: [],
                    status: 'missing',
                    score: 0,
                    analysis: null
                };
                
                // Check if required documents exist
                for (const docName of task.requiredDocs) {
                    if (docMap[docName]) {
                        const doc = docMap[docName];
                        const analysis = await analyzeDocument(doc.fullPath);
                        
                        taskResult.foundDocs.push({
                            name: docName,
                            path: doc.path,
                            analysis
                        });
                        
                        // Use highest score from found docs
                        if (analysis.qualityScore > taskResult.score) {
                            taskResult.score = analysis.qualityScore;
                            taskResult.analysis = analysis;
                        }
                    }
                }
                
                // Determine status
                if (taskResult.foundDocs.length === task.requiredDocs.length) {
                    taskResult.status = taskResult.score >= 70 ? 'complete' : 'partial';
                } else if (taskResult.foundDocs.length > 0) {
                    taskResult.status = 'partial';
                } else {
                    taskResult.status = 'missing';
                }
                
                taskResults[groupId].tasks.push(taskResult);
            }
        }
        
        // Calculate overall progress
        const progress = calculateProgress(taskResults);
        
        const scanResult = {
            timestamp: new Date().toISOString(),
            companyPath,
            documentsFound: foundDocs.length,
            taskResults,
            progress,
            summary: {
                totalTasks: progress.totalTasks,
                completed: progress.completedTasks,
                partial: progress.partialTasks,
                missing: progress.missingTasks,
                overallPercentage: progress.overallPercentage
            },
            storage: {
                local: false,
                aws: false
            }
        };
        
        // ALWAYS save to local file first (backup/offline support)
        const localSaved = await saveLocalProgress(scanResult);
        scanResult.storage.local = localSaved;
        
        // Save to AWS with retry
        const awsResult = await saveToAWS(scanResult);
        scanResult.storage.aws = awsResult.success;
        scanResult.savedToAWS = awsResult.success;
        
        if (awsResult.success) {
            console.log('✅ Scan results saved to both local and AWS');
        } else {
            console.log('📁 Scan results saved to local file (AWS: ' + awsResult.reason + ')');
            scanResult.awsMessage = awsResult.reason;
        }
        
        res.json(scanResult);
        
    } catch (error) {
        console.error('Error scanning documents:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/scanner/progress
 * Get latest saved progress (AWS first, then local fallback)
 */
router.get('/progress', async (req, res) => {
    try {
        // Try AWS first
        const awsData = await loadFromAWS();
        if (awsData) {
            return res.json({
                source: 'aws',
                ...awsData
            });
        }
        
        // Fallback to local storage
        const localData = await loadLocalProgress();
        if (localData) {
            return res.json({
                source: 'local',
                ...localData
            });
        }
        
        // No data found anywhere
        return res.json({
            source: 'none',
            message: 'No previous scan found - run a new scan',
            awsConfigured: isAWSConfigured()
        });
        
    } catch (error) {
        console.error('Error fetching progress:', error);
        
        // Try local as fallback on error
        try {
            const localData = await loadLocalProgress();
            if (localData) {
                return res.json({
                    source: 'local',
                    ...localData,
                    awsError: error.message
                });
            }
        } catch (localError) {
            // Both failed
        }
        
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/scanner/history
 * Get scan history from AWS
 */
router.get('/history', async (req, res) => {
    try {
        if (!isAWSConfigured()) {
            return res.json({ history: [], source: 'none' });
        }
        
        const result = await docClient.send(new ScanCommand({
            TableName: TABLES.USERS,
            FilterExpression: 'pk = :pk AND sk <> :latest',
            ExpressionAttributeValues: {
                ':pk': 'SCANNER#PROGRESS',
                ':latest': 'LATEST'
            },
            Limit: 30
        }));
        
        const history = (result.Items || [])
            .map(item => ({
                timestamp: item.timestamp,
                summary: item.summary,
                progress: item.progress
            }))
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        res.json({
            history,
            count: history.length,
            source: 'aws'
        });
        
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/scanner/save
 * Manually save progress snapshot to AWS
 */
router.post('/save', async (req, res) => {
    try {
        const { progress, summary, taskResults } = req.body;
        
        if (!progress) {
            return res.status(400).json({ error: 'Progress data required' });
        }
        
        const timestamp = new Date().toISOString();
        
        const saveData = {
            timestamp,
            progress,
            summary,
            taskResults,
            savedManually: true
        };
        
        if (!isAWSConfigured()) {
            return res.json({
                success: false,
                message: 'AWS not configured',
                data: saveData
            });
        }
        
        // Save timestamped record
        await docClient.send(new PutCommand({
            TableName: TABLES.USERS,
            Item: {
                pk: 'SCANNER#PROGRESS',
                sk: `MANUAL#${timestamp}`,
                ...saveData,
                ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year TTL
            }
        }));
        
        // Update latest
        await docClient.send(new PutCommand({
            TableName: TABLES.USERS,
            Item: {
                pk: 'SCANNER#PROGRESS',
                sk: 'LATEST',
                ...saveData
            }
        }));
        
        res.json({
            success: true,
            message: 'Progress saved to AWS',
            timestamp
        });
        
    } catch (error) {
        console.error('Error saving progress:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/scanner/tasks
 * Get task registry definitions
 */
router.get('/tasks', (req, res) => {
    res.json({
        registry: TASK_REGISTRY,
        totalTasks: Object.values(TASK_REGISTRY).reduce((sum, group) => sum + group.tasks.length, 0),
        categories: [...new Set(Object.values(TASK_REGISTRY).map(g => g.category))],
        phases: [...new Set(Object.values(TASK_REGISTRY).map(g => g.phase))].sort()
    });
});

/**
 * GET /api/scanner/status
 * Check AWS connection status and storage info
 */
router.get('/status', async (req, res) => {
    try {
        const awsConfigured = isAWSConfigured();
        let awsConnected = false;
        let awsError = null;
        
        // Test AWS connection
        if (awsConfigured) {
            try {
                await docClient.send(new GetCommand({
                    TableName: TABLES.USERS,
                    Key: { pk: 'SCANNER#PROGRESS', sk: 'LATEST' }
                }));
                awsConnected = true;
            } catch (error) {
                awsError = error.message;
            }
        }
        
        // Check local storage
        const localData = await loadLocalProgress();
        const hasLocalData = localData !== null;
        
        res.json({
            aws: {
                configured: awsConfigured,
                connected: awsConnected,
                error: awsError,
                table: TABLES.USERS,
                region: process.env.AWS_REGION || 'not set'
            },
            local: {
                path: LOCAL_STORAGE_PATH,
                hasData: hasLocalData,
                lastScan: localData?.timestamp || null
            },
            recommendations: awsConnected 
                ? ['Storage is synced with AWS'] 
                : awsConfigured 
                    ? ['AWS configured but connection failed - check credentials']
                    : ['Configure AWS credentials in .env file for cloud sync', 'Data is currently stored locally only']
        });
        
    } catch (error) {
        console.error('Error checking status:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/scanner/sync
 * Sync local data to AWS (call when AWS connection is restored)
 */
router.post('/sync', async (req, res) => {
    try {
        const result = await syncLocalToAWS();
        
        if (result.synced) {
            res.json({
                success: true,
                message: result.message
            });
        } else {
            res.json({
                success: false,
                reason: result.reason
            });
        }
        
    } catch (error) {
        console.error('Error syncing to AWS:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

