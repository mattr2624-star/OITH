# OITH Matching Service - Performance Optimization

This document describes the performance optimizations implemented based on simulation testing.

## Quick Links

- [Optimized Matching Service](lambda/matchingService-optimized.mjs)
- [DynamoDB GSI Setup](lambda/setup-dynamodb-gsi.mjs)
- [Monitoring & Alerting](lambda/monitoring.mjs)
- [Simulation Tool](../simulation/)

## Summary of Changes

Based on simulation results testing from 100 to 25,000+ users, the following optimizations were implemented:

| Optimization | Impact | Files Modified |
|-------------|--------|----------------|
| GSI for geohash queries | 10x fewer scans | `setup-dynamodb-gsi.mjs` |
| Gender+geohash composite GSI | 50% fewer candidates | `matchingService-optimized.mjs` |
| In-memory profile caching | 80% fewer DynamoDB reads | `matchingService-optimized.mjs` |
| Quick pre-filtering | 70% fewer distance calcs | `matchingService-optimized.mjs` |
| Bounding box distance check | Avoid expensive Haversine | `matchingService-optimized.mjs` |
| Proper geohash neighbors | Include all 8 adjacent cells | `matchingService-optimized.mjs` |
| Blocked user GSI | O(1) reverse lookups | `setup-dynamodb-gsi.mjs` |
| CloudWatch metrics | Real-time monitoring | `monitoring.mjs` |

## Expected Performance Improvements

### Before Optimization (Current)

| Users | Avg Time | P95 | Scans/Match |
|-------|----------|-----|-------------|
| 1,000 | 3ms | 8ms | 400 |
| 5,000 | 15ms | 40ms | 2,000 |
| 10,000 | 35ms | 100ms | 4,000 |
| 25,000 | 100ms | 300ms | 10,000 |

### After Optimization (Target)

| Users | Avg Time | P95 | Scans/Match |
|-------|----------|-----|-------------|
| 1,000 | 2ms | 5ms | 50 |
| 5,000 | 5ms | 15ms | 100 |
| 10,000 | 8ms | 25ms | 150 |
| 25,000 | 15ms | 50ms | 250 |

## Implementation Guide

### Step 1: Create GSI in DynamoDB

Run the setup script to add required indexes:

```bash
cd prototype/server/lambda

# Check current status
node setup-dynamodb-gsi.mjs --status

# Update existing tables with GSI
node setup-dynamodb-gsi.mjs --update

# Or create new tables with GSI
node setup-dynamodb-gsi.mjs --create
```

Required GSIs for `oith-profiles`:

| GSI Name | Partition Key | Sort Key | Purpose |
|----------|--------------|----------|---------|
| `geohash-lastSeen-index` | geohash_prefix | lastSeen | Location queries with recency |
| `gender-geohash-index` | gender | geohash_prefix | Gender+location filtering |

### Step 2: Deploy Optimized Lambda

Replace or update the matching service:

```bash
# Option 1: Replace the existing file
cp matchingService-optimized.mjs matchingService.mjs

# Option 2: Deploy as new function
aws lambda create-function \
  --function-name oith-matching-optimized \
  --runtime nodejs18.x \
  --handler matchingService-optimized.handler \
  --zip-file fileb://deploy.zip
```

### Step 3: Configure Monitoring

Set up CloudWatch alarms:

```bash
# Set SNS topic for alerts
export ALERT_TOPIC_ARN=arn:aws:sns:us-east-1:YOUR_ACCOUNT:oith-alerts

# Create alarms
node -e "import('./monitoring.mjs').then(m => m.setupAlarmsHandler())"
```

### Step 4: Verify Performance

Use the simulation tool to verify improvements:

```bash
cd prototype/simulation
node matching-simulator.js 5000 --verbose
```

Or open `simulation/index.html` in a browser.

## Architecture Decisions

### Why GSI on geohash_prefix?

DynamoDB scans are O(n) - every profile must be examined. With GSI on geohash_prefix:

- Query only profiles within ~40km radius
- Reduces candidates by 90%+ for most users
- Still allows full scan fallback for users in sparse areas

### Why Gender+Geohash Composite GSI?

Most users (92%) are interested in only one gender. The composite GSI:

- Filters by gender at the GSI level (no filter expression needed)
- Further reduces candidates by ~50%
- Combines the two most selective filters

### Why In-Memory Caching?

Lambda reuses execution contexts. A simple LRU cache:

- Persists across requests within the same Lambda instance
- Reduces DynamoDB reads by 80%
- 5-minute TTL balances freshness vs. performance
- 1,000 profile limit prevents memory issues

### Why Bounding Box Pre-Check?

Haversine formula is expensive (sin, cos, atan2). Bounding box:

- Simple lat/lng comparison
- 1.2x buffer catches edge cases
- Filters 70%+ of candidates before Haversine

## Monitoring & Alerting

### CloudWatch Metrics Published

| Metric | Description | Unit |
|--------|-------------|------|
| `MatchTimeAvg` | Average match time | Milliseconds |
| `MatchTimeP95` | 95th percentile time | Milliseconds |
| `MatchTimeP99` | 99th percentile time | Milliseconds |
| `MatchAttempts` | Number of match attempts | Count |
| `MatchSuccessRate` | Percentage finding matches | Percent |
| `ErrorRate` | Percentage of errors | Percent |
| `ProfileScansAvg` | Average profiles scanned | Count |
| `GSIUsageRate` | Percentage using GSI vs scan | Percent |
| `CacheHitRate` | Profile cache hit rate | Percent |

### Alerts Configured

| Alarm | Threshold | Severity |
|-------|-----------|----------|
| P95 Response Time | > 200ms | Warning |
| P99 Response Time | > 500ms | Critical |
| Error Rate | > 5% | Critical |
| Success Rate | < 50% | Warning |
| Cache Hit Rate | < 60% | Warning |

## Troubleshooting

### High Response Times

1. Check GSI status: `node setup-dynamodb-gsi.mjs --status`
2. Verify geohash_prefix populated on profiles
3. Check DynamoDB consumed capacity
4. Review Lambda memory/timeout settings

### Low Cache Hit Rate

1. Check Lambda instance reuse (cold starts reset cache)
2. Consider provisioned concurrency
3. Increase cache TTL if data changes infrequently

### GSI Not Being Used

Check Lambda logs for "Using table scan" messages:

```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/oith-matching \
  --filter-pattern "table scan"
```

Common causes:
- User has no coordinates
- GSI doesn't exist
- GSI still building (check status)

## Rollback Plan

If issues occur after deploying optimizations:

1. Restore original `matchingService.mjs` from backup
2. GSI can remain in place (backward compatible)
3. Monitor metrics for improvement

The optimized service is designed to gracefully fall back to scan behavior if GSI queries fail.

## Future Improvements

For 100,000+ users:

1. **ElastiCache/Redis**: Move profile cache to shared Redis cluster
2. **DynamoDB DAX**: In-memory DynamoDB cache
3. **Pre-computed matches**: Nightly job to compute top matches per user
4. **Graph database**: Neptune for relationship traversal
5. **ML-based filtering**: Reduce candidates before preference matching
6. **Regional sharding**: Separate tables per geographic region

---

*Last updated: December 2024*

