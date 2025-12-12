# 🏗️ OITH Enterprise Scale Architecture

## Stress Test Results & Solutions

This document addresses the critical issues identified in stress testing and provides a comprehensive enterprise-scale architecture.

---

## 📊 Stress Test Summary

| Issue | Current | Target | Severity | Status |
|-------|---------|--------|----------|--------|
| Network Failure Rate | 1.00% | < 0.5% | 🔴 Critical | ✅ Addressed |
| Peak Concurrency | 50 req/s | 500+ req/s | 🟡 Warning | ✅ Addressed |
| Database Latency | 89.2ms | < 30ms | 🟡 Warning | ✅ Addressed |
| P95 Response Time | 458.2ms | < 200ms | 🔴 Critical | ✅ Addressed |
| Profile Scan Count | 4,266 | < 500 | 🟡 Warning | ✅ Addressed |
| Scale Target | 100K | 100M+ | 🔴 Critical | ✅ Addressed |

---

## 🏛️ Enterprise Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           OITH ENTERPRISE ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                         GLOBAL TRAFFIC LAYER                             │   │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │   │
│   │  │ Route 53     │→│ CloudFront   │→│ AWS WAF      │                    │   │
│   │  │ (Geo-DNS)    │  │ (Global CDN) │  │ (Security)   │                   │   │
│   │  └──────────────┘  └──────────────┘  └──────────────┘                   │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                          │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                         REGIONAL CLUSTERS                                │   │
│   │                                                                          │   │
│   │  ┌─────────────────────┐         ┌─────────────────────┐                │   │
│   │  │   US-EAST-1         │         │   US-WEST-2         │                │   │
│   │  │  (Primary Region)   │◄───────►│  (Secondary Region) │                │   │
│   │  └─────────────────────┘         └─────────────────────┘                │   │
│   │            │                               │                             │   │
│   └────────────┼───────────────────────────────┼─────────────────────────────┘   │
│                │                               │                                 │
│   ┌────────────▼───────────────────────────────▼─────────────────────────────┐  │
│   │                         API GATEWAY LAYER                                 │  │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                    │  │
│   │  │ API Gateway  │  │ Rate Limiter │  │ Request     │                    │  │
│   │  │ (HTTP API)   │→│ (Throttling) │→│ Validator   │                     │  │
│   │  └──────────────┘  └──────────────┘  └──────────────┘                    │  │
│   └──────────────────────────────────────────────────────────────────────────┘  │
│                                       │                                          │
│   ┌───────────────────────────────────▼──────────────────────────────────────┐  │
│   │                         COMPUTE LAYER                                     │  │
│   │                                                                           │  │
│   │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐  │  │
│   │  │ User Sync   │   │ Matching    │   │ Image       │   │ Payment     │  │  │
│   │  │ Lambda      │   │ Step Func   │   │ Lambda      │   │ Lambda      │  │  │
│   │  │             │   │             │   │             │   │             │  │  │
│   │  │ Provisioned │   │ Express     │   │ Provisioned │   │ Standard    │  │  │
│   │  │ Concurrency │   │ Workflow    │   │ Concurrency │   │ Concurrency │  │  │
│   │  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘  │  │
│   │                           │                                              │  │
│   │                   ┌───────▼───────┐                                      │  │
│   │                   │ SQS Queue     │                                      │  │
│   │                   │ (Async Match) │                                      │  │
│   │                   └───────────────┘                                      │  │
│   └──────────────────────────────────────────────────────────────────────────┘  │
│                                       │                                          │
│   ┌───────────────────────────────────▼──────────────────────────────────────┐  │
│   │                         CACHING LAYER                                     │  │
│   │                                                                           │  │
│   │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                    │  │
│   │  │ ElastiCache │   │ DynamoDB    │   │ CloudFront  │                    │  │
│   │  │ Redis       │   │ DAX         │   │ Edge Cache  │                    │  │
│   │  │ (Cluster)   │   │ (In-Memory) │   │ (Static)    │                    │  │
│   │  └─────────────┘   └─────────────┘   └─────────────┘                    │  │
│   └──────────────────────────────────────────────────────────────────────────┘  │
│                                       │                                          │
│   ┌───────────────────────────────────▼──────────────────────────────────────┐  │
│   │                         DATA LAYER                                        │  │
│   │                                                                           │  │
│   │  ┌─────────────────────────────────────────────────────────────────────┐ │  │
│   │  │                    DynamoDB Global Tables                            │ │  │
│   │  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐        │ │  │
│   │  │  │ Users     │  │ Matches   │  │ Messages  │  │ Analytics │        │ │  │
│   │  │  │ (On-Dem)  │  │ (On-Dem)  │  │ (On-Dem)  │  │ (On-Dem)  │        │ │  │
│   │  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘        │ │  │
│   │  └─────────────────────────────────────────────────────────────────────┘ │  │
│   │                                                                           │  │
│   │  ┌─────────────────────┐     ┌─────────────────────┐                     │  │
│   │  │ S3 (Multi-Region)   │     │ Aurora Global DB    │                     │  │
│   │  │ Photo Storage       │     │ (Analytics/Reports) │                     │  │
│   │  └─────────────────────┘     └─────────────────────┘                     │  │
│   └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔴 Issue #1: High Network Failure Rate (1.00%)

### Root Cause
Single points of failure, no retry logic, missing circuit breakers.

### Solution: Resilience Patterns

#### 1. Circuit Breakers
```javascript
// See: utils/resilience.js
const { CircuitBreaker, resilientCall } = require('./utils/resilience');

// Usage
const result = await resilientCall('dynamodb', async () => {
    return docClient.send(new GetCommand({ TableName, Key }));
});
```

#### 2. Retry with Exponential Backoff + Jitter
```javascript
const { retryWithBackoff } = require('./utils/resilience');

await retryWithBackoff(async () => {
    return await apiCall();
}, {
    maxRetries: 3,
    baseDelayMs: 100,
    maxDelayMs: 10000,
    jitterFactor: 0.3  // Prevents thundering herd
});
```

#### 3. Multi-AZ Deployment
```yaml
# CloudFormation snippet
DynamoDBTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: oith-users
    BillingMode: PAY_PER_REQUEST
    SSESpecification:
      SSEEnabled: true
    PointInTimeRecoverySpecification:
      PointInTimeRecoveryEnabled: true
    # Multi-AZ is automatic with DynamoDB
```

#### 4. Health Checks & Failover
```javascript
// Endpoint: GET /health
app.get('/health', (req, res) => {
    const health = getResilienceHealth();
    const allHealthy = Object.values(health.circuitBreakers)
        .every(cb => cb.state === 'CLOSED');
    
    res.status(allHealthy ? 200 : 503).json(health);
});
```

---

## 🟡 Issue #2: High Concurrency During Peak Hours (50 req/s)

### Root Cause
Synchronous processing, no queuing, Lambda cold starts.

### Solution: Async Processing with SQS

#### 1. SQS Queue for Matching Requests
```bash
# Create FIFO queue for ordered processing
aws sqs create-queue \
    --queue-name oith-matching-queue.fifo \
    --attributes '{
        "FifoQueue": "true",
        "ContentBasedDeduplication": "true",
        "VisibilityTimeout": "60",
        "MessageRetentionPeriod": "86400"
    }'
```

#### 2. Lambda with SQS Trigger
```javascript
// matchingQueueProcessor.mjs
export const handler = async (event) => {
    const results = [];
    
    for (const record of event.Records) {
        const request = JSON.parse(record.body);
        
        try {
            const match = await processMatchRequest(request);
            results.push({ success: true, match });
        } catch (error) {
            // Return to queue for retry
            throw error;
        }
    }
    
    return { processed: results.length };
};
```

#### 3. Provisioned Concurrency
```bash
# Reserve 50 warm instances for peak hours
aws lambda put-provisioned-concurrency-config \
    --function-name oith-matching-service \
    --qualifier prod \
    --provisioned-concurrent-executions 50
```

#### 4. Request Throttling
```javascript
const { RateLimiter } = require('./utils/resilience');

const apiLimiter = new RateLimiter({
    maxRequests: 100,
    windowMs: 1000
});

app.use('/api', async (req, res, next) => {
    try {
        await apiLimiter.acquire();
        next();
    } catch (error) {
        res.status(429).json({ error: 'Too many requests' });
    }
});
```

---

## 🟡 Issue #3: Database Latency Under Load (89.2ms → 30ms)

### Root Cause
Direct DynamoDB queries, no caching, inefficient scans.

### Solution: Multi-Tier Caching

#### 1. DynamoDB DAX (In-Memory Cache)
```bash
# Create DAX cluster
aws dax create-cluster \
    --cluster-name oith-cache \
    --node-type dax.r5.large \
    --replication-factor 3 \
    --iam-role-arn arn:aws:iam::ACCOUNT:role/OITHDAXRole \
    --subnet-group-name oith-dax-subnets \
    --security-group-ids sg-xxx
```

**Expected Improvement:** 89.2ms → 1-5ms for cached reads

#### 2. ElastiCache Redis Cluster
```bash
# Create Redis cluster
aws elasticache create-replication-group \
    --replication-group-id oith-cache \
    --replication-group-description "OITH Cache Cluster" \
    --engine redis \
    --cache-node-type cache.r6g.large \
    --num-cache-clusters 3 \
    --automatic-failover-enabled \
    --multi-az-enabled
```

**Usage:**
```javascript
const { getCacheManager, CacheKeys } = require('./utils/caching');

const cache = getCacheManager({
    redisHost: process.env.REDIS_HOST,
    redisPort: 6379
});

// Cache user profiles
const profile = await cache.get(
    CacheKeys.userProfile(email),
    async () => fetchFromDynamoDB(email)  // Fetcher on miss
);
```

#### 3. Connection Pooling
```javascript
// Reuse DynamoDB client across requests
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
    marshallOptions: { removeUndefinedValues: true }
});

// Lambda keeps connections warm between invocations
```

---

## 🔴 Issue #4: Slow P95 Response Time (458ms → 200ms)

### Root Cause
No pre-computation, expensive runtime calculations, large payloads.

### Solution: Pre-Computation & Optimization

#### 1. Pre-Compute Compatibility Scores (Nightly Job)
```javascript
// precomputeCompatibility.mjs - Run as scheduled Lambda
export const handler = async (event) => {
    const users = await getAllActiveUsers();
    
    for (const user of users) {
        const candidates = await getCandidatesInRadius(user, 50);
        const scores = [];
        
        for (const candidate of candidates) {
            const score = calculateCompatibility(user, candidate);
            if (score >= 50) {
                scores.push({ email: candidate.email, score });
            }
        }
        
        // Store top 100 pre-computed matches
        scores.sort((a, b) => b.score - a.score);
        await cacheManager.set(
            CacheKeys.matchCandidates(user.email),
            scores.slice(0, 100),
            { l2TTL: 86400 }  // 24 hours
        );
    }
};
```

**Schedule:**
```bash
aws events put-rule \
    --name oith-precompute-matches \
    --schedule-expression "cron(0 4 * * ? *)"  # 4 AM daily
```

#### 2. Response Compression
```javascript
const compression = require('compression');
app.use(compression({ threshold: 1024 }));
```

#### 3. Field Projection
```javascript
// Only fetch needed fields
const { Items } = await docClient.send(new QueryCommand({
    TableName: 'oith-users',
    KeyConditionExpression: 'geohash = :geo',
    ProjectionExpression: 'email, firstName, age, photos, coordinates',
    ExpressionAttributeValues: { ':geo': geohash }
}));
```

---

## 🟡 Issue #5: High Scan Count (4,266 profiles)

### Root Cause
Full table scans, inefficient indexes, no pagination.

### Solution: Smart Querying with Pagination

#### 1. Pagination for Large Results
```javascript
async function* paginatedQuery(params) {
    let lastKey = undefined;
    
    do {
        const response = await docClient.send(new QueryCommand({
            ...params,
            ExclusiveStartKey: lastKey,
            Limit: 100  // Process in chunks
        }));
        
        yield response.Items;
        lastKey = response.LastEvaluatedKey;
    } while (lastKey);
}

// Usage
for await (const batch of paginatedQuery(queryParams)) {
    await processBatch(batch);
}
```

#### 2. Step Functions for Large Pools
```json
{
  "Comment": "Distributed Matching Workflow",
  "StartAt": "GetUserPool",
  "States": {
    "GetUserPool": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:oith-get-pool",
      "Next": "DistributeMatching"
    },
    "DistributeMatching": {
      "Type": "Map",
      "ItemsPath": "$.chunks",
      "MaxConcurrency": 10,
      "Iterator": {
        "StartAt": "ProcessChunk",
        "States": {
          "ProcessChunk": {
            "Type": "Task",
            "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:oith-process-chunk",
            "End": true
          }
        }
      },
      "Next": "AggregateResults"
    },
    "AggregateResults": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:oith-aggregate",
      "End": true
    }
  }
}
```

#### 3. Geohash Sharding
```javascript
// Divide into smaller geographic regions
const GEOHASH_PRECISION = 4;  // ~40km cells

async function getMatchCandidates(user) {
    const userGeohash = computeGeohash(user.coordinates, GEOHASH_PRECISION);
    const neighbors = getGeohashNeighbors(userGeohash);
    
    // Query each cell in parallel
    const results = await Promise.all(
        [userGeohash, ...neighbors].map(geo => 
            queryByGeohash(geo, user.preferences)
        )
    );
    
    return results.flat();
}
```

---

## 🔴 Issue #6: Million+ User Scale Architecture

### DynamoDB Global Tables (Multi-Region)
```bash
# Create global table
aws dynamodb create-global-table \
    --global-table-name oith-users \
    --replication-group RegionName=us-east-1 RegionName=us-west-2 RegionName=eu-west-1
```

### Regional Sharding Strategy
```
┌────────────────────────────────────────────────────────────────┐
│                    REGIONAL SHARDING                            │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  US-EAST    │  │  US-WEST    │  │  EU-WEST    │            │
│  │  Shard      │  │  Shard      │  │  Shard      │            │
│  │             │  │             │  │             │            │
│  │ Users: 40M  │  │ Users: 30M  │  │ Users: 30M  │            │
│  │ Region: NA  │  │ Region: NA  │  │ Region: EU  │            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
│         │                │                │                    │
│         └────────────────┼────────────────┘                    │
│                          │                                      │
│                  ┌───────▼───────┐                             │
│                  │ Global Router  │                             │
│                  │ (Route 53)     │                             │
│                  └───────────────┘                             │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Capacity Planning
```javascript
// Auto-scaling configuration
const autoScalingConfig = {
    dynamodb: {
        mode: 'ON_DEMAND',  // Auto-scales automatically
        globalTables: true
    },
    lambda: {
        provisionedConcurrency: {
            matching: 100,
            userSync: 50,
            imageService: 30
        },
        reservedConcurrency: {
            matching: 500,
            userSync: 200
        }
    },
    elasticache: {
        nodeType: 'cache.r6g.xlarge',
        numCacheClusters: 3,
        autoMinorVersionUpgrade: true
    }
};
```

---

## 📊 Monitoring & Alerting

### CloudWatch Dashboard
```javascript
const dashboardWidgets = [
    {
        title: 'P95 Response Time',
        metric: 'OITH/API/ResponseTime',
        stat: 'p95',
        alarm: { threshold: 200, comparison: 'GreaterThan' }
    },
    {
        title: 'Error Rate',
        metric: 'OITH/API/ErrorRate',
        stat: 'Average',
        alarm: { threshold: 0.5, comparison: 'GreaterThan' }
    },
    {
        title: 'Circuit Breaker State',
        metric: 'OITH/Resilience/CircuitState',
        stat: 'Maximum',
        alarm: { threshold: 1, comparison: 'Equals' }  // 1 = OPEN
    },
    {
        title: 'Cache Hit Rate',
        metric: 'OITH/Cache/HitRate',
        stat: 'Average',
        alarm: { threshold: 60, comparison: 'LessThan' }
    },
    {
        title: 'DynamoDB Latency',
        metric: 'AWS/DynamoDB/SuccessfulRequestLatency',
        stat: 'p95',
        alarm: { threshold: 30, comparison: 'GreaterThan' }
    }
];
```

### Alert Escalation
| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| P95 Latency | > 150ms | > 300ms | Scale Lambda, Check Cache |
| Error Rate | > 0.5% | > 1% | Check Circuit Breakers |
| Cache Hit Rate | < 70% | < 50% | Increase Cache Size |
| DB Latency | > 20ms | > 50ms | Enable DAX |
| Queue Depth | > 1000 | > 5000 | Scale Consumers |

---

## 💰 Cost Estimates at Scale

### 100M Users Monthly Cost

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| DynamoDB | On-Demand, 3 regions | $45,000 |
| Lambda | 500 provisioned concurrency | $8,000 |
| ElastiCache | 3x r6g.xlarge cluster | $2,500 |
| DAX | 3x r5.large cluster | $1,500 |
| S3 | 10TB photos | $230 |
| CloudFront | 100TB transfer | $8,500 |
| API Gateway | 10B requests | $35,000 |
| **Total** | - | **~$100,000/mo** |

### Cost Optimization
1. **Reserved Capacity:** Save 40% on Lambda/ElastiCache
2. **Spot Instances:** Use for batch processing
3. **S3 Intelligent Tiering:** Auto-optimize storage
4. **Right-Sizing:** Monitor and adjust instance types

---

## 🚀 Implementation Roadmap

### Phase 1: Quick Wins (Week 1-2)
- [x] Implement circuit breakers
- [x] Add retry with jitter
- [x] Enable DynamoDB on-demand
- [ ] Deploy ElastiCache Redis

### Phase 2: Caching Layer (Week 3-4)
- [ ] Configure DAX cluster
- [ ] Implement multi-tier caching
- [ ] Pre-compute compatibility scores

### Phase 3: Async Processing (Week 5-6)
- [ ] Set up SQS queues
- [ ] Migrate matching to Step Functions
- [ ] Implement pagination

### Phase 4: Multi-Region (Week 7-8)
- [ ] Enable DynamoDB Global Tables
- [ ] Set up Route 53 geo-routing
- [ ] Deploy to secondary regions

### Phase 5: Monitoring (Ongoing)
- [ ] Configure CloudWatch dashboards
- [ ] Set up PagerDuty integration
- [ ] Implement runbooks

---

## 📁 Related Files

| File | Purpose |
|------|---------|
| `utils/resilience.js` | Circuit breakers, retry, rate limiting |
| `utils/caching.js` | Multi-tier caching implementation |
| `lambda/matchingService-optimized.mjs` | Optimized matching algorithm |
| `lambda/setup-dynamodb-gsi.mjs` | GSI configuration |
| `SCALING_INFRASTRUCTURE_GUIDE.md` | Base infrastructure setup |
| `PERFORMANCE_OPTIMIZATION.md` | Performance tuning guide |

---

*Last Updated: December 2024*
*Document Location: `prototype/server/ENTERPRISE_SCALE_ARCHITECTURE.md`*

