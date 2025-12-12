# 🏗️ OITH Enterprise Infrastructure

Automated deployment of enterprise-scale infrastructure to address stress test issues.

## Quick Start

### Prerequisites

1. **AWS CLI** installed and configured
   ```bash
   aws configure
   ```

2. **AWS Account** with permissions for:
   - CloudFormation
   - ElastiCache
   - DAX
   - SQS
   - Step Functions
   - CloudWatch
   - IAM
   - EC2 (VPC, Security Groups)

3. **VPC** with at least 2 subnets (private recommended)

### Deploy (Windows PowerShell)

```powershell
cd prototype/server/infrastructure

# Deploy to production
.\deploy.ps1 production deploy

# Deploy to staging
.\deploy.ps1 staging deploy

# Check status
.\deploy.ps1 production status

# Cleanup (delete all resources)
.\deploy.ps1 production cleanup
```

### Deploy (Linux/Mac Bash)

```bash
cd prototype/server/infrastructure

# Make executable
chmod +x deploy.sh

# Deploy to production
./deploy.sh production deploy

# Deploy to staging
./deploy.sh staging deploy

# Cleanup
./deploy.sh production cleanup
```

## What Gets Deployed

### 1. ElastiCache Redis Cluster

| Environment | Node Type | Nodes | Multi-AZ |
|-------------|-----------|-------|----------|
| Production | cache.r6g.large | 3 | ✅ |
| Development | cache.t3.medium | 2 | ❌ |

**Features:**
- Encryption at rest and in transit
- Automatic failover
- Daily snapshots

### 2. DynamoDB DAX Cluster

| Environment | Node Type | Nodes |
|-------------|-----------|-------|
| Production | dax.r5.large | 3 |
| Development | dax.t3.medium | 2 |

**Features:**
- 5-minute TTL for items
- Server-side encryption
- IAM authentication

### 3. SQS Queues

| Queue | Type | Purpose |
|-------|------|---------|
| oith-{env}-matching-queue.fifo | FIFO | Async matching requests |
| oith-{env}-matching-dlq.fifo | FIFO | Dead letter queue |
| oith-{env}-notifications | Standard | Push notifications |

### 4. Step Functions

| State Machine | Type | Purpose |
|---------------|------|---------|
| oith-{env}-distributed-matching | EXPRESS | Real-time matching with sharding |
| oith-{env}-batch-precompute | STANDARD | Nightly compatibility pre-computation |

### 5. CloudWatch Alarms

| Alarm | Threshold | Severity |
|-------|-----------|----------|
| P95 Response Time | > 200ms | ⚠️ Warning |
| Error Rate | > 0.5% | 🔴 Critical |
| DynamoDB Throttling | > 1 | 🔴 Critical |
| DynamoDB Latency | > 30ms | ⚠️ Warning |
| SQS Queue Depth | > 1000 | ⚠️ Warning |
| ElastiCache CPU | > 80% | ⚠️ Warning |
| ElastiCache Memory | > 80% | ⚠️ Warning |

### 6. CloudWatch Dashboard

Real-time monitoring dashboard with:
- Lambda response times (P95 vs target)
- Invocations and errors
- DynamoDB latency
- Cache hit rates
- Queue metrics
- Active alarms

## Configuration

### Environment Variables

After deployment, update your Lambda functions with values from `env-infrastructure.txt`:

```env
REDIS_HOST=your-redis-endpoint.cache.amazonaws.com
REDIS_PORT=6379
DAX_ENDPOINTS=your-dax-endpoint.dax-clusters.us-east-1.amazonaws.com:8111
MATCHING_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/oith-production-matching-queue.fifo
AWS_REGION=us-east-1
```

### Lambda VPC Configuration

Your Lambda functions need to be deployed to the VPC to access ElastiCache and DAX:

1. Add the Lambda security group created by this stack
2. Add at least 2 private subnets
3. Ensure NAT Gateway for internet access (for Stripe, etc.)

```javascript
// serverless.yml example
functions:
  matching:
    handler: matchingService.handler
    vpc:
      securityGroupIds:
        - ${cf:oith-production-infrastructure.LambdaSecurityGroupId}
      subnetIds:
        - subnet-xxx
        - subnet-yyy
```

## Cost Estimates

### Monthly Costs by Environment

| Resource | Development | Staging | Production |
|----------|-------------|---------|------------|
| ElastiCache | $100 | $100 | $400 |
| DAX | $80 | $80 | $250 |
| SQS | $5 | $10 | $50 |
| Step Functions | $5 | $10 | $100 |
| CloudWatch | $10 | $20 | $50 |
| **Total** | **~$200** | **~$220** | **~$850** |

### Cost Optimization Tips

1. Use **development** environment for testing
2. Schedule DAX cluster to stop during off-hours
3. Use **Reserved Instances** for production (save 30-40%)
4. Set appropriate TTLs to reduce cache size

## Troubleshooting

### Stack Creation Failed

```bash
# Check stack events
aws cloudformation describe-stack-events --stack-name oith-production-infrastructure
```

### Cannot Connect to Redis

1. Check security group allows port 6379
2. Verify Lambda is in same VPC
3. Check subnet route tables

### DAX Connection Timeout

1. Verify DAX security group allows port 8111
2. Check IAM role has DAX permissions
3. Ensure VPC endpoints are configured

### Alarms Not Triggering

1. Verify SNS topic subscription confirmed
2. Check metric namespace matches
3. Verify Lambda function names match

## Files

| File | Purpose |
|------|---------|
| `cloudformation-infrastructure.yaml` | ElastiCache, DAX, SQS, CloudWatch |
| `cloudformation-stepfunctions.yaml` | Step Functions state machines |
| `deploy.sh` | Bash deployment script |
| `deploy.ps1` | PowerShell deployment script |
| `README.md` | This documentation |

## Related Documentation

- [ENTERPRISE_SCALE_ARCHITECTURE.md](../ENTERPRISE_SCALE_ARCHITECTURE.md) - Full architecture guide
- [SCALING_INFRASTRUCTURE_GUIDE.md](../SCALING_INFRASTRUCTURE_GUIDE.md) - DynamoDB & Lambda setup
- [PERFORMANCE_OPTIMIZATION.md](../PERFORMANCE_OPTIMIZATION.md) - Performance tuning

---

*Last Updated: December 2024*

