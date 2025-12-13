/**
 * Market Data API Routes
 * Provides real-time market data for supply/demand estimator
 * Fetches from AWS DynamoDB or generates simulated data based on industry benchmarks
 */

const express = require('express');
const router = express.Router();
const { docClient, TABLES, isAWSConfigured } = require('../aws-config');
const { GetCommand, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

// Industry benchmark data (updated regularly based on public data)
const INDUSTRY_BENCHMARKS = {
    lastUpdated: '2025-12-01',
    sources: ['Sensor Tower', 'App Annie', 'Statista', 'IBISWorld'],
    competitors: {
        hinge: {
            company: 'Match Group',
            pricing: { monthly: 29.99, sixMonth: 19.99, annual: 14.99 },
            marketSharePercent: 12,
            estimatedMAU: 6000000,
            elasticityEstimate: -0.8,
            targetDemo: '25-35'
        },
        bumble: {
            company: 'Bumble Inc.',
            pricing: { monthly: 32.99, sixMonth: 19.99, annual: 14.99 },
            marketSharePercent: 15,
            estimatedMAU: 7500000,
            elasticityEstimate: -0.9,
            targetDemo: '22-35'
        },
        tinder: {
            company: 'Match Group',
            pricing: { monthly: 14.99, gold: 29.99, platinum: 39.99 },
            marketSharePercent: 28,
            estimatedMAU: 14000000,
            elasticityEstimate: -0.7,
            targetDemo: '18-28'
        },
        match: {
            company: 'Match Group',
            pricing: { monthly: 44.99, sixMonth: 29.99, annual: 22.99 },
            marketSharePercent: 8,
            estimatedMAU: 4000000,
            elasticityEstimate: -0.6,
            targetDemo: '30-50'
        }
    },
    totalMarketSize: 50000000, // US dating app users
    growthRatePercent: 8.5 // Annual growth rate
};

// Cache for market data
let cachedMarketData = null;
let cacheTimestamp = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// GET - Fetch market data
router.get('/', async (req, res) => {
    try {
        const now = Date.now();
        
        // Return cached data if fresh
        if (cachedMarketData && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION_MS)) {
            return res.json({
                ...cachedMarketData,
                fromCache: true,
                cacheAge: Math.round((now - cacheTimestamp) / 1000) + 's'
            });
        }
        
        let marketData = null;
        
        // Try to fetch from AWS DynamoDB
        if (isAWSConfigured()) {
            try {
                const result = await docClient.send(new GetCommand({
                    TableName: TABLES.USERS,
                    Key: { pk: 'MARKET_DATA', sk: 'CURRENT' }
                }));
                
                if (result.Item && result.Item.data) {
                    marketData = result.Item.data;
                    marketData.dataSource = 'aws';
                }
            } catch (dbError) {
                console.warn('Could not fetch market data from DynamoDB:', dbError.message);
            }
        }
        
        // If no AWS data, generate from industry benchmarks
        if (!marketData) {
            marketData = generateMarketDataFromBenchmarks();
        }
        
        // Cache the result
        cachedMarketData = marketData;
        cacheTimestamp = now;
        
        res.json(marketData);
        
    } catch (error) {
        console.error('Market data error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST - Update market data (admin only)
router.post('/', async (req, res) => {
    try {
        const { competitors, oithData } = req.body;
        
        if (!competitors && !oithData) {
            return res.status(400).json({ error: 'No data provided' });
        }
        
        // Build updated market data
        const updatedData = generateMarketDataFromBenchmarks();
        
        // Merge in OITH-specific data if provided
        if (oithData) {
            updatedData.competitors.oith = {
                ...updatedData.competitors.oith,
                ...oithData
            };
        }
        
        // Override competitor data if provided
        if (competitors) {
            Object.entries(competitors).forEach(([key, value]) => {
                if (updatedData.competitors[key]) {
                    updatedData.competitors[key] = {
                        ...updatedData.competitors[key],
                        ...value
                    };
                }
            });
        }
        
        updatedData.lastUpdated = new Date().toISOString();
        
        // Save to AWS if configured
        if (isAWSConfigured()) {
            try {
                await docClient.send(new PutCommand({
                    TableName: TABLES.USERS,
                    Item: {
                        pk: 'MARKET_DATA',
                        sk: 'CURRENT',
                        data: updatedData,
                        updatedAt: updatedData.lastUpdated
                    }
                }));
                console.log('✅ Market data saved to AWS');
            } catch (dbError) {
                console.warn('Could not save market data to DynamoDB:', dbError.message);
            }
        }
        
        // Update cache
        cachedMarketData = updatedData;
        cacheTimestamp = Date.now();
        
        res.json({
            success: true,
            message: 'Market data updated',
            data: updatedData
        });
        
    } catch (error) {
        console.error('Update market data error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Fetch OITH-specific metrics from actual app data
router.get('/oith-metrics', async (req, res) => {
    try {
        let oithMetrics = {
            currentPrice: 9.99,
            totalUsers: 0,
            paidUsers: 0,
            conversionRate: 0,
            churnRate: 0,
            dataSource: 'estimated'
        };
        
        // Try to get real data from AWS
        if (isAWSConfigured()) {
            try {
                // Scan for user data
                const usersResult = await docClient.send(new ScanCommand({
                    TableName: TABLES.USERS,
                    FilterExpression: 'begins_with(pk, :prefix)',
                    ExpressionAttributeValues: { ':prefix': 'USER#' }
                }));
                
                const users = usersResult.Items || [];
                oithMetrics.totalUsers = users.length;
                oithMetrics.paidUsers = users.filter(u => u.subscription === 'premium' || u.isPaid).length;
                oithMetrics.conversionRate = oithMetrics.totalUsers > 0 
                    ? (oithMetrics.paidUsers / oithMetrics.totalUsers * 100).toFixed(1)
                    : 0;
                oithMetrics.dataSource = 'aws';
                
                // Try to get pricing from config
                const configResult = await docClient.send(new GetCommand({
                    TableName: TABLES.USERS,
                    Key: { pk: 'CONFIG', sk: 'PRICING' }
                }));
                
                if (configResult.Item && configResult.Item.monthlyPrice) {
                    oithMetrics.currentPrice = configResult.Item.monthlyPrice;
                }
            } catch (dbError) {
                console.warn('Could not fetch OITH metrics:', dbError.message);
            }
        }
        
        res.json(oithMetrics);
        
    } catch (error) {
        console.error('OITH metrics error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper function to generate market data from industry benchmarks
function generateMarketDataFromBenchmarks() {
    const bench = INDUSTRY_BENCHMARKS;
    
    // Add realistic variance (±10%) to simulate market fluctuations
    const variance = () => 1 + (Math.random() - 0.5) * 0.2;
    
    const totalMarket = Math.round(bench.totalMarketSize * variance() / 10); // Scale down for addressable market
    
    const competitors = {
        oith: {
            price: 9.99,
            marketShare: 0.02 * variance(),
            elasticity: -1.2 * variance(),
            users: Math.round(totalMarket * 0.02 * variance())
        }
    };
    
    // Add competitor data with variance
    Object.entries(bench.competitors).forEach(([key, comp]) => {
        const share = (comp.marketSharePercent / 100) * variance();
        competitors[key] = {
            price: comp.pricing.monthly * variance(),
            marketShare: share,
            elasticity: comp.elasticityEstimate * variance(),
            users: Math.round(totalMarket * share)
        };
    });
    
    return {
        competitors,
        totalMarket,
        lastUpdated: new Date().toISOString(),
        dataSource: 'benchmark',
        benchmarkDate: bench.lastUpdated,
        sources: bench.sources,
        growthRate: bench.growthRatePercent
    };
}

module.exports = router;

