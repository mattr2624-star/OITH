/**
 * OITH Matching Algorithm Simulator
 * 
 * Simulates the matching algorithm at various scales to identify
 * performance bottlenecks and scalability issues.
 */

const { generateUsers, getUserPoolStats, encodeGeohash } = require('./user-generator');

// Configuration matching the actual service
const CONFIG = {
    MATCH_EXPIRATION_HOURS: 24,
    ACTIVE_USER_DAYS: 14,
    MAX_SCAN_LIMIT: 500,
    GEOHASH_PRECISION: 4,
    RATE_LIMIT_REQUESTS: 20,
    RATE_LIMIT_WINDOW_SECONDS: 60
};

// Performance metrics collector
class MetricsCollector {
    constructor() {
        this.reset();
    }
    
    reset() {
        this.metrics = {
            totalOperations: 0,
            matchingAttempts: 0,
            successfulMatches: 0,
            noMatchesFound: 0,
            avgMatchTime: 0,
            maxMatchTime: 0,
            minMatchTime: Infinity,
            matchTimes: [],
            profileScansTotal: 0,
            profileScansPerMatch: [],
            preferenceChecks: 0,
            compatibilityCalculations: 0,
            distanceCalculations: 0,
            geohashLookups: 0,
            memoryUsage: [],
            errors: [],
            bottlenecks: []
        };
        this.startTime = Date.now();
    }
    
    recordMatchAttempt(result) {
        this.metrics.matchingAttempts++;
        this.metrics.matchTimes.push(result.duration);
        this.metrics.profileScansPerMatch.push(result.profilesScanned);
        this.metrics.profileScansTotal += result.profilesScanned;
        this.metrics.preferenceChecks += result.preferenceChecks || 0;
        this.metrics.compatibilityCalculations += result.compatibilityCalcs || 0;
        this.metrics.distanceCalculations += result.distanceCalcs || 0;
        
        if (result.match) {
            this.metrics.successfulMatches++;
        } else {
            this.metrics.noMatchesFound++;
        }
        
        if (result.duration > this.metrics.maxMatchTime) {
            this.metrics.maxMatchTime = result.duration;
        }
        if (result.duration < this.metrics.minMatchTime) {
            this.metrics.minMatchTime = result.duration;
        }
    }
    
    recordMemoryUsage() {
        if (typeof process !== 'undefined' && process.memoryUsage) {
            const usage = process.memoryUsage();
            this.metrics.memoryUsage.push({
                timestamp: Date.now() - this.startTime,
                heapUsed: usage.heapUsed,
                heapTotal: usage.heapTotal,
                external: usage.external
            });
        }
    }
    
    recordBottleneck(type, description, severity) {
        this.metrics.bottlenecks.push({
            type,
            description,
            severity, // 'low', 'medium', 'high', 'critical'
            timestamp: Date.now() - this.startTime
        });
    }
    
    getReport() {
        const times = this.metrics.matchTimes;
        const scans = this.metrics.profileScansPerMatch;
        
        return {
            summary: {
                totalDuration: Date.now() - this.startTime,
                matchingAttempts: this.metrics.matchingAttempts,
                successfulMatches: this.metrics.successfulMatches,
                matchSuccessRate: (this.metrics.successfulMatches / this.metrics.matchingAttempts * 100).toFixed(2) + '%',
                noMatchesFound: this.metrics.noMatchesFound
            },
            timing: {
                avgMatchTime: times.length ? (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2) : 0,
                maxMatchTime: this.metrics.maxMatchTime,
                minMatchTime: this.metrics.minMatchTime === Infinity ? 0 : this.metrics.minMatchTime,
                p50: this.percentile(times, 50),
                p95: this.percentile(times, 95),
                p99: this.percentile(times, 99)
            },
            scanning: {
                totalProfileScans: this.metrics.profileScansTotal,
                avgScansPerMatch: scans.length ? (scans.reduce((a, b) => a + b, 0) / scans.length).toFixed(2) : 0,
                maxScansPerMatch: Math.max(...scans, 0),
                preferenceChecks: this.metrics.preferenceChecks,
                compatibilityCalculations: this.metrics.compatibilityCalculations,
                distanceCalculations: this.metrics.distanceCalculations
            },
            memory: this.metrics.memoryUsage.length > 0 ? {
                peakHeapUsed: Math.max(...this.metrics.memoryUsage.map(m => m.heapUsed)),
                avgHeapUsed: this.metrics.memoryUsage.reduce((a, b) => a + b.heapUsed, 0) / this.metrics.memoryUsage.length
            } : null,
            bottlenecks: this.metrics.bottlenecks,
            errors: this.metrics.errors
        };
    }
    
    percentile(arr, p) {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const idx = Math.ceil((p / 100) * sorted.length) - 1;
        return sorted[Math.max(0, idx)].toFixed(2);
    }
}

/**
 * Calculate distance between two points (Haversine formula)
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    if (!lat1 || !lng1 || !lat2 || !lng2) return 9999;
    
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return Math.round(R * c);
}

/**
 * Check if a profile matches preferences
 */
function checkPreferenceMatch(profile, prefs, viewerProfile, metrics) {
    metrics.preferenceChecks++;
    
    // Gender preference
    const interestedIn = prefs.interestedIn || 'everyone';
    if (interestedIn !== 'everyone') {
        const profileGender = profile.gender?.toLowerCase();
        const wantsGender = interestedIn.toLowerCase();
        const genderMap = { 'men': 'male', 'women': 'female', 'male': 'male', 'female': 'female' };
        const targetGender = genderMap[wantsGender] || wantsGender;
        if (profileGender !== targetGender) {
            return { matches: false, reason: 'gender_mismatch' };
        }
    }
    
    // Age range
    const ageMin = prefs.ageMin || 18;
    const ageMax = prefs.ageMax || 99;
    const profileAge = profile.age || 25;
    if (profileAge < ageMin || profileAge > ageMax) {
        return { matches: false, reason: 'age_out_of_range' };
    }
    
    // Distance
    const maxDistance = prefs.maxDistance || 100;
    const viewerCoords = viewerProfile.coordinates || {};
    const profileCoords = profile.coordinates || {};
    
    metrics.distanceCalculations++;
    const distance = calculateDistance(
        viewerCoords.lat, viewerCoords.lng,
        profileCoords.lat, profileCoords.lng
    );
    if (distance > maxDistance) {
        return { matches: false, reason: 'too_far', distance };
    }
    
    // Smoking preference
    if (prefs.smoking && prefs.smoking.length > 0) {
        const profileSmoking = profile.smoking?.toLowerCase();
        if (profileSmoking && !prefs.smoking.map(s => s.toLowerCase()).includes(profileSmoking)) {
            return { matches: false, reason: 'smoking_mismatch' };
        }
    }
    
    // Drinking preference
    if (prefs.drinking && prefs.drinking.length > 0) {
        const profileDrinking = profile.drinking?.toLowerCase();
        if (profileDrinking && !prefs.drinking.map(d => d.toLowerCase()).includes(profileDrinking)) {
            return { matches: false, reason: 'drinking_mismatch' };
        }
    }
    
    return { matches: true, distance };
}

/**
 * Calculate compatibility score
 */
function calculateCompatibility(profile1, profile2, metrics) {
    metrics.compatibilityCalculations++;
    
    let score = 50;
    
    // Interest overlap
    const interests1 = profile1.interests || [];
    const interests2 = profile2.interests || [];
    if (interests1.length > 0 && interests2.length > 0) {
        const overlap = interests1.filter(i => 
            interests2.some(i2 => i2.toLowerCase() === i.toLowerCase())
        ).length;
        const maxPossible = Math.min(interests1.length, interests2.length);
        score += maxPossible > 0 ? (overlap / maxPossible) * 25 : 0;
    }
    
    // Lifestyle alignment
    if (profile1.drinking?.toLowerCase() === profile2.drinking?.toLowerCase()) score += 3;
    if (profile1.smoking?.toLowerCase() === profile2.smoking?.toLowerCase()) score += 3;
    if (profile1.exercise?.toLowerCase() === profile2.exercise?.toLowerCase()) score += 3;
    if (profile1.children === profile2.children) score += 3;
    if (profile1.religion?.toLowerCase() === profile2.religion?.toLowerCase()) score += 3;
    
    // Looking for alignment
    if (profile1.lookingFor?.toLowerCase() === profile2.lookingFor?.toLowerCase()) {
        score += 10;
    }
    
    return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Simulate finding a match for a user
 * This mimics the getNextMatch function from matchingService.mjs
 */
function simulateGetNextMatch(currentUser, allUsers, excludeEmails, metrics, useGeohash = true) {
    const startTime = Date.now();
    let profilesScanned = 0;
    let preferenceChecks = 0;
    let compatibilityCalcs = 0;
    let distanceCalcs = 0;
    
    const localMetrics = {
        preferenceChecks: 0,
        compatibilityCalculations: 0,
        distanceCalculations: 0
    };
    
    const myPrefs = currentUser.matchPreferences || {};
    
    // Filter potential matches
    let potentialMatches;
    
    if (useGeohash && currentUser.geohash) {
        // Simulate GSI query - filter by geohash first
        metrics.geohashLookups++;
        potentialMatches = allUsers.filter(u => {
            if (excludeEmails.includes(u.email)) return false;
            if (!u.isVisible) return false;
            // Geohash prefix matching (simulates GSI)
            if (u.geohash && u.geohash.substring(0, 3) === currentUser.geohash.substring(0, 3)) {
                return true;
            }
            return false;
        });
        
        // If geohash returns too few, fall back to full scan
        if (potentialMatches.length < 10) {
            potentialMatches = allUsers.filter(u => 
                !excludeEmails.includes(u.email) && u.isVisible !== false
            );
        }
    } else {
        // Full table scan
        potentialMatches = allUsers.filter(u => 
            !excludeEmails.includes(u.email) && u.isVisible !== false
        );
    }
    
    profilesScanned = potentialMatches.length;
    
    // Apply mutual preference matching
    const mutualMatches = [];
    
    for (const match of potentialMatches) {
        const matchProfile = {
            ...match,
            matchPreferences: match.matchPreferences || {}
        };
        
        // Check if match fits my preferences
        const matchFitsMine = checkPreferenceMatch(matchProfile, myPrefs, currentUser, localMetrics);
        if (!matchFitsMine.matches) continue;
        
        // Check if I fit match's preferences
        const iFitTheirs = checkPreferenceMatch(currentUser, matchProfile.matchPreferences, matchProfile, localMetrics);
        if (!iFitTheirs.matches) continue;
        
        // Calculate compatibility
        const compatibility = calculateCompatibility(currentUser, matchProfile, localMetrics);
        
        mutualMatches.push({
            email: match.email,
            firstName: match.firstName,
            compatibility,
            distance: matchFitsMine.distance || 0
        });
    }
    
    // Sort by compatibility
    mutualMatches.sort((a, b) => b.compatibility - a.compatibility);
    
    const duration = Date.now() - startTime;
    
    // Record metrics
    metrics.recordMatchAttempt({
        duration,
        profilesScanned,
        preferenceChecks: localMetrics.preferenceChecks,
        compatibilityCalcs: localMetrics.compatibilityCalculations,
        distanceCalcs: localMetrics.distanceCalculations,
        match: mutualMatches.length > 0 ? mutualMatches[0] : null
    });
    
    // Detect bottlenecks
    if (duration > 100) {
        metrics.recordBottleneck('slow_match', `Match took ${duration}ms (scanned ${profilesScanned} profiles)`, 
            duration > 500 ? 'high' : 'medium');
    }
    
    if (profilesScanned > 1000) {
        metrics.recordBottleneck('large_scan', `Scanned ${profilesScanned} profiles`, 'medium');
    }
    
    return {
        match: mutualMatches.length > 0 ? mutualMatches[0] : null,
        stats: {
            poolSize: potentialMatches.length,
            mutualMatches: mutualMatches.length,
            duration
        }
    };
}

/**
 * Run a simulation with specified parameters
 */
async function runSimulation(config = {}) {
    const {
        userCount = 1000,
        matchAttempts = 100,
        useGeohash = true,
        cityFocus = null,
        simulateConcurrency = false,
        verbose = false
    } = config;
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`OITH Matching Simulation - ${userCount} Users`);
    console.log(`${'='.repeat(60)}\n`);
    
    const metrics = new MetricsCollector();
    
    // Generate users
    console.log(`Generating ${userCount} users...`);
    const startGen = Date.now();
    const users = generateUsers(userCount, { cityFocus });
    console.log(`Generated in ${Date.now() - startGen}ms`);
    
    // Get pool statistics
    const poolStats = getUserPoolStats(users);
    console.log(`\nUser Pool Stats:`);
    console.log(`  - Male: ${poolStats.byGender.male} (${(poolStats.byGender.male/userCount*100).toFixed(1)}%)`);
    console.log(`  - Female: ${poolStats.byGender.female} (${(poolStats.byGender.female/userCount*100).toFixed(1)}%)`);
    console.log(`  - Average age: ${poolStats.avgAge}`);
    console.log(`  - Active users: ${poolStats.activeUsers}`);
    console.log(`  - Unique geohashes: ${Object.keys(poolStats.byGeohash).length}`);
    
    // Record initial memory
    metrics.recordMemoryUsage();
    
    // Run matching simulations
    console.log(`\nRunning ${matchAttempts} match attempts...`);
    
    const matchHistory = new Map(); // Track passed/connected users
    
    for (let i = 0; i < matchAttempts; i++) {
        // Pick a random user to find a match for
        const randomUser = users[Math.floor(Math.random() * users.length)];
        
        // Get their exclusion list
        const excluded = matchHistory.get(randomUser.email) || [];
        excluded.push(randomUser.email);
        
        // Find match
        const result = simulateGetNextMatch(
            randomUser,
            users,
            excluded,
            metrics,
            useGeohash
        );
        
        // Update history (simulate passing on this match)
        if (result.match) {
            const history = matchHistory.get(randomUser.email) || [];
            history.push(result.match.email);
            matchHistory.set(randomUser.email, history);
        }
        
        if (verbose && (i + 1) % 10 === 0) {
            console.log(`  Completed ${i + 1}/${matchAttempts} attempts`);
        }
        
        // Periodic memory recording
        if ((i + 1) % 50 === 0) {
            metrics.recordMemoryUsage();
        }
    }
    
    // Final memory snapshot
    metrics.recordMemoryUsage();
    
    // Generate report
    const report = metrics.getReport();
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('SIMULATION RESULTS');
    console.log(`${'='.repeat(60)}`);
    
    console.log('\n📊 SUMMARY');
    console.log(`  Total duration: ${report.summary.totalDuration}ms`);
    console.log(`  Match attempts: ${report.summary.matchingAttempts}`);
    console.log(`  Successful matches: ${report.summary.successfulMatches} (${report.summary.matchSuccessRate})`);
    console.log(`  No match found: ${report.summary.noMatchesFound}`);
    
    console.log('\n⏱️ TIMING PERFORMANCE');
    console.log(`  Average match time: ${report.timing.avgMatchTime}ms`);
    console.log(`  Min/Max: ${report.timing.minMatchTime}ms / ${report.timing.maxMatchTime}ms`);
    console.log(`  P50: ${report.timing.p50}ms | P95: ${report.timing.p95}ms | P99: ${report.timing.p99}ms`);
    
    console.log('\n🔍 SCANNING STATISTICS');
    console.log(`  Total profiles scanned: ${report.scanning.totalProfileScans.toLocaleString()}`);
    console.log(`  Avg scans per match: ${report.scanning.avgScansPerMatch}`);
    console.log(`  Max scans per match: ${report.scanning.maxScansPerMatch}`);
    console.log(`  Preference checks: ${report.scanning.preferenceChecks.toLocaleString()}`);
    console.log(`  Compatibility calcs: ${report.scanning.compatibilityCalculations.toLocaleString()}`);
    console.log(`  Distance calcs: ${report.scanning.distanceCalculations.toLocaleString()}`);
    
    if (report.memory) {
        console.log('\n💾 MEMORY USAGE');
        console.log(`  Peak heap: ${(report.memory.peakHeapUsed / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  Avg heap: ${(report.memory.avgHeapUsed / 1024 / 1024).toFixed(2)} MB`);
    }
    
    if (report.bottlenecks.length > 0) {
        console.log('\n⚠️ DETECTED BOTTLENECKS');
        const grouped = {};
        report.bottlenecks.forEach(b => {
            grouped[b.type] = (grouped[b.type] || 0) + 1;
        });
        Object.entries(grouped).forEach(([type, count]) => {
            console.log(`  - ${type}: ${count} occurrences`);
        });
    }
    
    // Analysis and recommendations
    console.log('\n📋 SCALABILITY ANALYSIS');
    
    const issues = [];
    
    // Check for O(n) scan issues
    if (report.scanning.avgScansPerMatch > userCount * 0.5) {
        issues.push({
            severity: 'high',
            issue: 'Full table scans detected',
            detail: `Scanning ${report.scanning.avgScansPerMatch} profiles per match (${(report.scanning.avgScansPerMatch/userCount*100).toFixed(1)}% of users)`,
            recommendation: 'Implement GSI on geohash_prefix for location-based filtering'
        });
    }
    
    // Check for slow response times
    if (parseFloat(report.timing.p95) > 200) {
        issues.push({
            severity: 'high',
            issue: 'Slow P95 response time',
            detail: `P95 is ${report.timing.p95}ms (should be < 200ms for good UX)`,
            recommendation: 'Add caching layer or pre-compute compatibility scores'
        });
    }
    
    // Check match success rate
    if (parseFloat(report.summary.matchSuccessRate) < 50) {
        issues.push({
            severity: 'medium',
            issue: 'Low match success rate',
            detail: `Only ${report.summary.matchSuccessRate} of attempts found matches`,
            recommendation: 'Consider relaxing preference matching or expanding geohash search radius'
        });
    }
    
    // Memory check for large user bases
    if (report.memory && report.memory.peakHeapUsed > 500 * 1024 * 1024) {
        issues.push({
            severity: 'high',
            issue: 'High memory usage',
            detail: `Peak heap ${(report.memory.peakHeapUsed / 1024 / 1024).toFixed(2)} MB`,
            recommendation: 'Implement pagination and streaming for large result sets'
        });
    }
    
    // Algorithm complexity
    const complexityFactor = report.scanning.preferenceChecks / matchAttempts;
    if (complexityFactor > userCount * 0.3) {
        issues.push({
            severity: 'medium',
            issue: 'High algorithmic complexity',
            detail: `${complexityFactor.toFixed(0)} preference checks per match attempt`,
            recommendation: 'Pre-filter candidates using indexed attributes before preference matching'
        });
    }
    
    if (issues.length === 0) {
        console.log('  ✅ No critical issues detected at this scale');
    } else {
        issues.forEach(issue => {
            const icon = issue.severity === 'high' ? '🔴' : issue.severity === 'medium' ? '🟡' : '🟢';
            console.log(`\n  ${icon} ${issue.issue}`);
            console.log(`     ${issue.detail}`);
            console.log(`     💡 ${issue.recommendation}`);
        });
    }
    
    return {
        config,
        poolStats,
        report,
        issues
    };
}

/**
 * Run scaling tests at multiple user counts
 */
async function runScalingTests() {
    const results = [];
    const userCounts = [100, 500, 1000, 2500, 5000, 10000];
    
    console.log('\n' + '═'.repeat(70));
    console.log('  OITH MATCHING ALGORITHM - SCALING TESTS');
    console.log('═'.repeat(70) + '\n');
    
    for (const count of userCounts) {
        const result = await runSimulation({
            userCount: count,
            matchAttempts: Math.min(count / 2, 200),
            useGeohash: true,
            verbose: false
        });
        results.push(result);
        
        console.log('\n' + '-'.repeat(60));
    }
    
    // Summary comparison
    console.log('\n' + '═'.repeat(70));
    console.log('  SCALING COMPARISON SUMMARY');
    console.log('═'.repeat(70) + '\n');
    
    console.log('Users      | Avg Time | P95 Time | Scans/Match | Success Rate');
    console.log('-'.repeat(70));
    
    results.forEach(r => {
        console.log(
            `${r.config.userCount.toString().padEnd(10)} | ` +
            `${r.report.timing.avgMatchTime.toString().padEnd(8)}ms | ` +
            `${r.report.timing.p95.toString().padEnd(8)}ms | ` +
            `${r.report.scanning.avgScansPerMatch.toString().padEnd(11)} | ` +
            `${r.report.summary.matchSuccessRate}`
        );
    });
    
    // Scaling analysis
    console.log('\n📈 SCALING ANALYSIS');
    
    const firstResult = results[0];
    const lastResult = results[results.length - 1];
    const userScaleFactor = lastResult.config.userCount / firstResult.config.userCount;
    const timeScaleFactor = parseFloat(lastResult.report.timing.avgMatchTime) / parseFloat(firstResult.report.timing.avgMatchTime);
    
    console.log(`  User increase: ${userScaleFactor}x (${firstResult.config.userCount} → ${lastResult.config.userCount})`);
    console.log(`  Time increase: ${timeScaleFactor.toFixed(2)}x`);
    
    if (timeScaleFactor > userScaleFactor * 0.5) {
        console.log(`  ⚠️ WARNING: Algorithm appears to scale poorly (O(n) or worse)`);
        console.log(`     Expected < ${(userScaleFactor * 0.5).toFixed(1)}x time increase for O(log n)`);
    } else if (timeScaleFactor > Math.log(userScaleFactor)) {
        console.log(`  🟡 CAUTION: Time increases faster than logarithmically`);
    } else {
        console.log(`  ✅ Algorithm scales well (sub-linear time complexity)`);
    }
    
    return results;
}

// Export for use elsewhere
if (typeof module !== 'undefined') {
    module.exports = {
        runSimulation,
        runScalingTests,
        MetricsCollector,
        simulateGetNextMatch,
        calculateDistance,
        checkPreferenceMatch,
        calculateCompatibility
    };
}

// If run directly
if (typeof require !== 'undefined' && require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--scale')) {
        runScalingTests().catch(console.error);
    } else {
        const userCount = parseInt(args[0]) || 1000;
        runSimulation({ 
            userCount,
            matchAttempts: Math.min(userCount / 2, 200),
            useGeohash: true,
            verbose: args.includes('--verbose')
        }).catch(console.error);
    }
}

