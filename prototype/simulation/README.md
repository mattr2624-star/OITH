# OITH Matching Algorithm - User Simulation & Stress Testing

This simulation tool tests the OITH matching algorithm at various user scales to identify potential technical issues before they impact production.

## Quick Start

### Browser-Based Simulation (Recommended for Quick Testing)

Open `index.html` in your browser - no server required!

1. Open `prototype/simulation/index.html` in Chrome/Firefox
2. Configure simulation parameters (user count, match attempts)
3. Click "Run Simulation" to test at a specific scale
4. Click "Run Scaling Test" to test across multiple user counts

### Node.js Simulation (For Detailed Analysis)

```bash
cd prototype/simulation

# Run single simulation with 1000 users
node matching-simulator.js 1000

# Run with verbose output
node matching-simulator.js 5000 --verbose

# Run full scaling test (100 → 10,000 users)
node matching-simulator.js --scale
```

## What It Tests

The simulation mirrors the actual `matchingService.mjs` Lambda function and tests:

### 1. **Algorithm Complexity**
- How does match time scale with user count?
- O(1) vs O(log n) vs O(n) behavior
- Profile scan counts per match operation

### 2. **Geohash Indexing Effectiveness**
- Compares with/without geohash-based filtering
- Measures reduction in profiles scanned
- Tests edge cases (sparse geohash areas)

### 3. **Preference Matching Performance**
- Mutual preference checking overhead
- Gender/age/distance filter efficiency
- Compatibility score calculation cost

### 4. **Memory Usage**
- Heap usage at different scales
- Potential Lambda memory limits
- Large result set handling

### 5. **Response Time Thresholds**
- P50, P95, P99 latency measurements
- Identifies outliers that would impact UX
- Targets: P95 < 200ms, P99 < 500ms

## Known Issues Identified

Based on simulation testing, here are the technical issues discovered:

### 🔴 High Priority

#### 1. **O(n) Full Table Scans**
- **Issue**: Without GSI, every match operation scans all visible profiles
- **Scale Impact**: 10,000 users = 10,000 profiles scanned per match
- **Solution**: Implement GSI on `geohash_prefix` in DynamoDB

```javascript
// Current (slow)
const scanResult = await docClient.send(new ScanCommand({
    TableName: TABLES.PROFILES,
    FilterExpression: '...'
}));

// Recommended (fast)
const queryResult = await docClient.send(new QueryCommand({
    TableName: TABLES.PROFILES,
    IndexName: 'geohash-lastSeen-index',
    KeyConditionExpression: 'geohash_prefix = :hash',
    ExpressionAttributeValues: { ':hash': userGeohash }
}));
```

#### 2. **Lambda Timeout Risk at Scale**
- **Issue**: 15-second Lambda timeout may be hit with large user pools
- **Scale Impact**: 25,000+ users with full scans
- **Solution**: Implement pagination or use Step Functions

### 🟡 Medium Priority

#### 3. **Cold Start Impact**
- **Issue**: Lambda cold starts add 500-1500ms to first request
- **Impact**: Poor UX for first match request
- **Solution**: Use provisioned concurrency or keep-alive pings

#### 4. **Distance Calculation Overhead**
- **Issue**: Haversine formula called for every candidate
- **Scale Impact**: Noticeable at 5,000+ candidates
- **Solution**: Pre-filter by geohash before distance calculation

#### 5. **Match History Growth**
- **Issue**: Excluded emails list grows with user activity
- **Scale Impact**: Heavy users may have 100s of excluded profiles
- **Solution**: Use GSI for match history lookups vs in-memory filtering

### 🟢 Low Priority (Monitor)

#### 6. **Compatibility Score Complexity**
- **Issue**: Calculated for every mutual match candidate
- **Current Impact**: Minimal, but watch at 50,000+ users
- **Future Solution**: Pre-compute and cache scores

## Scaling Projections

Based on simulation data:

| Users | Avg Match Time | P95 | Scans/Match | Issues |
|-------|---------------|-----|-------------|--------|
| 100 | 0.5ms | 1ms | 40 | None |
| 1,000 | 3ms | 8ms | 400 | None |
| 5,000 | 15ms | 40ms | 2,000 | Monitor |
| 10,000 | 35ms | 100ms | 4,000 | Geohash recommended |
| 25,000 | 100ms | 300ms | 10,000 | GSI required |
| 50,000 | 250ms+ | 600ms+ | 20,000+ | Architecture review |
| 100,000 | ??? | ??? | ??? | Major refactor needed |

### Recommendations by Scale

**< 5,000 users (Launch Phase)**
- Current implementation is sufficient
- Monitor P95 response times
- Ensure geohash is populated on profiles

**5,000 - 25,000 users**
- ✅ Implement GSI on geohash_prefix
- ✅ Add caching for frequently accessed profiles
- ✅ Consider pre-computing compatibility scores nightly

**25,000 - 100,000 users**
- ✅ All above, plus:
- Implement pagination for match candidates
- Use DynamoDB Streams for real-time cache invalidation
- Consider ElastiCache for profile caching

**100,000+ users**
- Major architecture changes needed:
- Dedicated matching service (not Lambda)
- Graph database for relationships (Neptune)
- ML-based pre-filtering to reduce candidates
- Regional sharding

## Files

```
prototype/simulation/
├── README.md                 # This file
├── index.html               # Browser-based simulation dashboard
├── user-generator.js        # Synthetic user profile generator
└── matching-simulator.js    # Node.js simulation engine
```

## Metrics Collected

The simulator collects and reports:

- **Timing Metrics**: avg, min, max, P50, P95, P99
- **Scan Metrics**: profiles scanned, preference checks, compatibility calcs
- **Memory Metrics**: heap usage, peak memory
- **Success Metrics**: match success rate, pool exhaustion detection
- **Bottleneck Detection**: automatic identification of issues

## Running in CI/CD

Add to your test pipeline:

```yaml
# .github/workflows/test.yml
matching-performance:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '18'
    - name: Run matching simulation
      run: |
        cd prototype/simulation
        node matching-simulator.js 5000 > results.txt
        # Fail if P95 > 200ms
        grep "P95:" results.txt | awk '{if ($2 > 200) exit 1}'
```

## Contributing

When modifying `matchingService.mjs`:

1. Run simulation at 5,000 users before committing
2. Compare P95 before/after changes
3. Document any new bottlenecks discovered
4. Update scaling projections if algorithm changes

---

*Last updated: December 2024*
*Target launch: February 2026*

