/**
 * OITH Performance Monitoring & Alerting
 * 
 * Tracks matching algorithm performance metrics and sends alerts
 * when thresholds are exceeded.
 * 
 * Integrates with:
 * - CloudWatch Metrics (custom metrics)
 * - CloudWatch Alarms (threshold alerts)
 * - SNS (notifications)
 */

import { 
    CloudWatchClient, 
    PutMetricDataCommand,
    PutMetricAlarmCommand
} from '@aws-sdk/client-cloudwatch';

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const cloudwatch = new CloudWatchClient({ region: process.env.AWS_REGION || 'us-east-1' });
const sns = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

const NAMESPACE = 'OITH/Matching';
const ALERT_TOPIC_ARN = process.env.ALERT_TOPIC_ARN;

// ==========================================
// THRESHOLDS (based on simulation results)
// ==========================================
const THRESHOLDS = {
    // Response time thresholds (milliseconds)
    MATCH_TIME_WARNING: 200,        // P95 should stay below this
    MATCH_TIME_CRITICAL: 500,       // Immediate alert if exceeded
    
    // Scan count thresholds
    SCAN_COUNT_WARNING: 500,        // Average scans per match
    SCAN_COUNT_CRITICAL: 1000,      // Indicates missing GSI
    
    // Success rate thresholds (percentage)
    SUCCESS_RATE_WARNING: 50,       // Below 50% needs investigation
    SUCCESS_RATE_CRITICAL: 25,      // Below 25% is critical
    
    // Cache hit rate thresholds (percentage)
    CACHE_HIT_RATE_WARNING: 60,     // Cache should hit 60%+
    CACHE_HIT_RATE_CRITICAL: 30,    // Below 30% wastes resources
    
    // Error rate thresholds (percentage)
    ERROR_RATE_WARNING: 1,          // 1% errors
    ERROR_RATE_CRITICAL: 5,         // 5% errors
    
    // Concurrent user thresholds
    USERS_WARNING: 10000,           // GSI optimization critical
    USERS_CRITICAL: 25000           // Architecture review needed
};

// ==========================================
// METRICS COLLECTOR
// ==========================================
class MatchingMetricsCollector {
    constructor() {
        this.reset();
    }
    
    reset() {
        this.window = {
            startTime: Date.now(),
            matchAttempts: 0,
            successfulMatches: 0,
            failedMatches: 0,
            errors: 0,
            totalDuration: 0,
            durations: [],
            scans: [],
            cacheHits: 0,
            cacheMisses: 0,
            gsiQueries: 0,
            scanQueries: 0
        };
    }
    
    recordMatchAttempt(metrics) {
        this.window.matchAttempts++;
        this.window.totalDuration += metrics.duration || 0;
        
        if (metrics.duration) {
            this.window.durations.push(metrics.duration);
        }
        if (metrics.profilesScanned) {
            this.window.scans.push(metrics.profilesScanned);
        }
        if (metrics.success) {
            this.window.successfulMatches++;
        } else if (metrics.noMatch) {
            this.window.failedMatches++;
        }
        if (metrics.error) {
            this.window.errors++;
        }
        if (metrics.cacheHit) {
            this.window.cacheHits++;
        }
        if (metrics.cacheMiss) {
            this.window.cacheMisses++;
        }
        if (metrics.gsiQuery) {
            this.window.gsiQueries++;
        }
        if (metrics.scanQuery) {
            this.window.scanQueries++;
        }
    }
    
    getStats() {
        const { durations, scans, window } = this;
        const w = window;
        
        // Calculate percentiles
        const sortedDurations = [...w.durations].sort((a, b) => a - b);
        const sortedScans = [...w.scans].sort((a, b) => a - b);
        
        const percentile = (arr, p) => {
            if (arr.length === 0) return 0;
            const idx = Math.ceil((p / 100) * arr.length) - 1;
            return arr[Math.max(0, idx)];
        };
        
        const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
        
        const cacheTotal = w.cacheHits + w.cacheMisses;
        const successTotal = w.successfulMatches + w.failedMatches;
        
        return {
            windowDuration: Date.now() - w.startTime,
            matchAttempts: w.matchAttempts,
            successRate: successTotal > 0 ? (w.successfulMatches / successTotal) * 100 : 0,
            errorRate: w.matchAttempts > 0 ? (w.errors / w.matchAttempts) * 100 : 0,
            timing: {
                avg: avg(w.durations),
                p50: percentile(sortedDurations, 50),
                p95: percentile(sortedDurations, 95),
                p99: percentile(sortedDurations, 99),
                max: Math.max(...w.durations, 0)
            },
            scanning: {
                avg: avg(w.scans),
                max: Math.max(...w.scans, 0),
                gsiQueries: w.gsiQueries,
                scanQueries: w.scanQueries,
                gsiRatio: w.gsiQueries + w.scanQueries > 0 
                    ? (w.gsiQueries / (w.gsiQueries + w.scanQueries)) * 100 
                    : 0
            },
            caching: {
                hits: w.cacheHits,
                misses: w.cacheMisses,
                hitRate: cacheTotal > 0 ? (w.cacheHits / cacheTotal) * 100 : 0
            }
        };
    }
}

// Singleton collector instance
const metricsCollector = new MatchingMetricsCollector();

// ==========================================
// CLOUDWATCH INTEGRATION
// ==========================================

/**
 * Publish metrics to CloudWatch
 */
async function publishMetricsToCloudWatch(stats) {
    const timestamp = new Date();
    
    const metrics = [
        // Response time metrics
        {
            MetricName: 'MatchTimeAvg',
            Value: stats.timing.avg,
            Unit: 'Milliseconds',
            Timestamp: timestamp
        },
        {
            MetricName: 'MatchTimeP95',
            Value: stats.timing.p95,
            Unit: 'Milliseconds',
            Timestamp: timestamp
        },
        {
            MetricName: 'MatchTimeP99',
            Value: stats.timing.p99,
            Unit: 'Milliseconds',
            Timestamp: timestamp
        },
        // Success metrics
        {
            MetricName: 'MatchAttempts',
            Value: stats.matchAttempts,
            Unit: 'Count',
            Timestamp: timestamp
        },
        {
            MetricName: 'MatchSuccessRate',
            Value: stats.successRate,
            Unit: 'Percent',
            Timestamp: timestamp
        },
        {
            MetricName: 'ErrorRate',
            Value: stats.errorRate,
            Unit: 'Percent',
            Timestamp: timestamp
        },
        // Scanning metrics
        {
            MetricName: 'ProfileScansAvg',
            Value: stats.scanning.avg,
            Unit: 'Count',
            Timestamp: timestamp
        },
        {
            MetricName: 'GSIUsageRate',
            Value: stats.scanning.gsiRatio,
            Unit: 'Percent',
            Timestamp: timestamp
        },
        // Cache metrics
        {
            MetricName: 'CacheHitRate',
            Value: stats.caching.hitRate,
            Unit: 'Percent',
            Timestamp: timestamp
        }
    ];
    
    try {
        await cloudwatch.send(new PutMetricDataCommand({
            Namespace: NAMESPACE,
            MetricData: metrics
        }));
        console.log('📊 Published metrics to CloudWatch');
    } catch (err) {
        console.error('Failed to publish CloudWatch metrics:', err.message);
    }
}

/**
 * Create CloudWatch alarms for critical thresholds
 */
async function setupCloudWatchAlarms() {
    const alarms = [
        {
            AlarmName: 'OITH-MatchTime-P95-High',
            MetricName: 'MatchTimeP95',
            Threshold: THRESHOLDS.MATCH_TIME_WARNING,
            ComparisonOperator: 'GreaterThanThreshold',
            EvaluationPeriods: 3,
            Period: 300, // 5 minutes
            Statistic: 'Average',
            AlarmDescription: 'P95 match time exceeds 200ms - investigate GSI usage'
        },
        {
            AlarmName: 'OITH-MatchTime-Critical',
            MetricName: 'MatchTimeP99',
            Threshold: THRESHOLDS.MATCH_TIME_CRITICAL,
            ComparisonOperator: 'GreaterThanThreshold',
            EvaluationPeriods: 2,
            Period: 300,
            Statistic: 'Maximum',
            AlarmDescription: 'P99 match time exceeds 500ms - CRITICAL'
        },
        {
            AlarmName: 'OITH-ErrorRate-High',
            MetricName: 'ErrorRate',
            Threshold: THRESHOLDS.ERROR_RATE_CRITICAL,
            ComparisonOperator: 'GreaterThanThreshold',
            EvaluationPeriods: 2,
            Period: 300,
            Statistic: 'Average',
            AlarmDescription: 'Error rate exceeds 5% - check Lambda logs'
        },
        {
            AlarmName: 'OITH-SuccessRate-Low',
            MetricName: 'MatchSuccessRate',
            Threshold: THRESHOLDS.SUCCESS_RATE_WARNING,
            ComparisonOperator: 'LessThanThreshold',
            EvaluationPeriods: 3,
            Period: 600, // 10 minutes
            Statistic: 'Average',
            AlarmDescription: 'Match success rate below 50% - check user pool distribution'
        },
        {
            AlarmName: 'OITH-CacheHitRate-Low',
            MetricName: 'CacheHitRate',
            Threshold: THRESHOLDS.CACHE_HIT_RATE_WARNING,
            ComparisonOperator: 'LessThanThreshold',
            EvaluationPeriods: 5,
            Period: 300,
            Statistic: 'Average',
            AlarmDescription: 'Cache hit rate below 60% - check cache configuration'
        }
    ];
    
    for (const alarm of alarms) {
        try {
            await cloudwatch.send(new PutMetricAlarmCommand({
                AlarmName: alarm.AlarmName,
                MetricName: alarm.MetricName,
                Namespace: NAMESPACE,
                Threshold: alarm.Threshold,
                ComparisonOperator: alarm.ComparisonOperator,
                EvaluationPeriods: alarm.EvaluationPeriods,
                Period: alarm.Period,
                Statistic: alarm.Statistic,
                AlarmDescription: alarm.AlarmDescription,
                ActionsEnabled: true,
                AlarmActions: ALERT_TOPIC_ARN ? [ALERT_TOPIC_ARN] : [],
                TreatMissingData: 'notBreaching'
            }));
            console.log(`✅ Created alarm: ${alarm.AlarmName}`);
        } catch (err) {
            console.error(`Failed to create alarm ${alarm.AlarmName}:`, err.message);
        }
    }
}

// ==========================================
// ALERTING
// ==========================================

/**
 * Check thresholds and send immediate alerts if critical
 */
async function checkThresholdsAndAlert(stats) {
    const alerts = [];
    
    // Check P95 response time
    if (stats.timing.p95 > THRESHOLDS.MATCH_TIME_CRITICAL) {
        alerts.push({
            severity: 'CRITICAL',
            metric: 'P95 Response Time',
            value: `${stats.timing.p95.toFixed(0)}ms`,
            threshold: `${THRESHOLDS.MATCH_TIME_CRITICAL}ms`,
            recommendation: 'Immediate investigation required. Check GSI status and DynamoDB throughput.'
        });
    } else if (stats.timing.p95 > THRESHOLDS.MATCH_TIME_WARNING) {
        alerts.push({
            severity: 'WARNING',
            metric: 'P95 Response Time',
            value: `${stats.timing.p95.toFixed(0)}ms`,
            threshold: `${THRESHOLDS.MATCH_TIME_WARNING}ms`,
            recommendation: 'Performance degrading. Review recent code changes and user growth.'
        });
    }
    
    // Check scan count
    if (stats.scanning.avg > THRESHOLDS.SCAN_COUNT_CRITICAL) {
        alerts.push({
            severity: 'CRITICAL',
            metric: 'Average Scans Per Match',
            value: stats.scanning.avg.toFixed(0),
            threshold: THRESHOLDS.SCAN_COUNT_CRITICAL,
            recommendation: 'GSI is likely not being used. Run: node setup-dynamodb-gsi.mjs --status'
        });
    }
    
    // Check error rate
    if (stats.errorRate > THRESHOLDS.ERROR_RATE_CRITICAL) {
        alerts.push({
            severity: 'CRITICAL',
            metric: 'Error Rate',
            value: `${stats.errorRate.toFixed(1)}%`,
            threshold: `${THRESHOLDS.ERROR_RATE_CRITICAL}%`,
            recommendation: 'Check Lambda logs in CloudWatch for error details.'
        });
    }
    
    // Check success rate
    if (stats.successRate < THRESHOLDS.SUCCESS_RATE_CRITICAL) {
        alerts.push({
            severity: 'CRITICAL',
            metric: 'Match Success Rate',
            value: `${stats.successRate.toFixed(1)}%`,
            threshold: `${THRESHOLDS.SUCCESS_RATE_CRITICAL}%`,
            recommendation: 'User pool may be exhausted or preferences too restrictive.'
        });
    }
    
    // Check cache hit rate
    if (stats.caching.hitRate < THRESHOLDS.CACHE_HIT_RATE_CRITICAL && stats.matchAttempts > 50) {
        alerts.push({
            severity: 'WARNING',
            metric: 'Cache Hit Rate',
            value: `${stats.caching.hitRate.toFixed(1)}%`,
            threshold: `${THRESHOLDS.CACHE_HIT_RATE_CRITICAL}%`,
            recommendation: 'Cache may need larger size or longer TTL.'
        });
    }
    
    // Send alerts
    if (alerts.length > 0 && ALERT_TOPIC_ARN) {
        const message = formatAlertMessage(alerts);
        
        try {
            await sns.send(new PublishCommand({
                TopicArn: ALERT_TOPIC_ARN,
                Subject: `🚨 OITH Matching Alert - ${alerts[0].severity}`,
                Message: message
            }));
            console.log(`🚨 Sent ${alerts.length} alert(s) to SNS`);
        } catch (err) {
            console.error('Failed to send SNS alert:', err.message);
        }
    }
    
    return alerts;
}

/**
 * Format alert message for SNS
 */
function formatAlertMessage(alerts) {
    let message = '🚨 OITH MATCHING SERVICE ALERT\n';
    message += '=' .repeat(50) + '\n\n';
    message += `Timestamp: ${new Date().toISOString()}\n`;
    message += `Environment: ${process.env.STAGE || 'production'}\n\n`;
    
    for (const alert of alerts) {
        message += `[${alert.severity}] ${alert.metric}\n`;
        message += `  Current: ${alert.value}\n`;
        message += `  Threshold: ${alert.threshold}\n`;
        message += `  Action: ${alert.recommendation}\n\n`;
    }
    
    message += '=' .repeat(50) + '\n';
    message += 'View CloudWatch: https://console.aws.amazon.com/cloudwatch\n';
    
    return message;
}

// ==========================================
// LAMBDA HANDLER FOR SCHEDULED MONITORING
// ==========================================

/**
 * Lambda handler for scheduled metric collection
 * Trigger: CloudWatch Events rule (every 5 minutes)
 */
export const monitoringHandler = async (event) => {
    console.log('📊 Running scheduled monitoring check');
    
    // Get current stats
    const stats = metricsCollector.getStats();
    
    // Skip if no data collected
    if (stats.matchAttempts === 0) {
        console.log('No match attempts in current window');
        return { statusCode: 200, body: 'No data to report' };
    }
    
    // Publish to CloudWatch
    await publishMetricsToCloudWatch(stats);
    
    // Check thresholds and alert
    const alerts = await checkThresholdsAndAlert(stats);
    
    // Reset window for next period
    metricsCollector.reset();
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            stats,
            alerts,
            message: `Processed ${stats.matchAttempts} match attempts`
        })
    };
};

/**
 * Lambda handler to setup CloudWatch alarms
 * Run once during deployment
 */
export const setupAlarmsHandler = async (event) => {
    console.log('⚙️ Setting up CloudWatch alarms');
    
    await setupCloudWatchAlarms();
    
    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Alarms configured' })
    };
};

// ==========================================
// EXPORTS FOR USE IN MATCHING SERVICE
// ==========================================

export {
    metricsCollector,
    MatchingMetricsCollector,
    publishMetricsToCloudWatch,
    checkThresholdsAndAlert,
    THRESHOLDS
};

// ==========================================
// MIDDLEWARE FOR LAMBDA
// ==========================================

/**
 * Wrapper to add automatic metrics collection to any Lambda
 */
export function withMetrics(handler) {
    return async (event, context) => {
        const startTime = Date.now();
        let result;
        let error = null;
        
        try {
            result = await handler(event, context);
        } catch (err) {
            error = err;
            throw err;
        } finally {
            const duration = Date.now() - startTime;
            const body = result ? JSON.parse(result.body || '{}') : {};
            
            metricsCollector.recordMatchAttempt({
                duration,
                success: body.match != null,
                noMatch: body.match === null && !error,
                error: error != null,
                profilesScanned: body.stats?.poolSize || body.performance?.profilesScanned,
                cacheHit: body.performance?.cacheHits > 0,
                cacheMiss: body.performance?.cacheMisses > 0,
                gsiQuery: body.stats?.queryMethod?.includes('gsi'),
                scanQuery: body.stats?.queryMethod?.includes('scan')
            });
        }
        
        return result;
    };
}

