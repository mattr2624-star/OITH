# 🚀 OITH Scaling Infrastructure Guide

> Complete guide for deploying scalable infrastructure for production

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [DynamoDB Tables Setup](#dynamodb-tables-setup)
3. [S3 Bucket Setup](#s3-bucket-setup)
4. [Lambda Functions Deployment](#lambda-functions-deployment)
5. [API Gateway Configuration](#api-gateway-configuration)
6. [CloudFront CDN Setup](#cloudfront-cdn-setup)
7. [CloudWatch Monitoring](#cloudwatch-monitoring)
8. [Cost Estimates](#cost-estimates)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        OITH Architecture                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────┐     ┌──────────────┐     ┌──────────────────┐   │
│   │  Mobile  │────▶│ CloudFront   │────▶│  S3 (Photos)     │   │
│   │  App     │     │ CDN          │     │                  │   │
│   └────┬─────┘     └──────────────┘     └──────────────────┘   │
│        │                                                         │
│        ▼                                                         │
│   ┌──────────────┐                                              │
│   │ API Gateway  │                                              │
│   │ (HTTP API)   │                                              │
│   └──────┬───────┘                                              │
│          │                                                       │
│    ┌─────┴─────┬─────────────┬─────────────┐                   │
│    ▼           ▼             ▼             ▼                    │
│ ┌──────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│ │User  │  │Matching  │  │Image     │  │Payment   │            │
│ │Sync  │  │Service   │  │Service   │  │Handler   │            │
│ │Lambda│  │Lambda    │  │Lambda    │  │Lambda    │            │
│ └──┬───┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │
│    │           │             │             │                    │
│    └─────┬─────┴─────────────┴─────────────┘                   │
│          ▼                                                       │
│   ┌──────────────────────────────────────────────┐             │
│   │              DynamoDB Tables                  │             │
│   ├──────────────────────────────────────────────┤             │
│   │ • oith-users (profiles, preferences)         │             │
│   │ • oith-matches (current matches)             │             │
│   │ • oith-match-history (pass/accept history)   │             │
│   │ • oith-conversations (chat messages)         │             │
│   └──────────────────────────────────────────────┘             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## DynamoDB Tables Setup

### 1. oith-users (Main Users Table)

```bash
aws dynamodb create-table \
    --table-name oith-users \
    --attribute-definitions \
        AttributeName=email,AttributeType=S \
        AttributeName=geohash,AttributeType=S \
        AttributeName=gender,AttributeType=S \
    --key-schema \
        AttributeName=email,KeyType=HASH \
    --global-secondary-indexes \
        '[
            {
                "IndexName": "geohash-index",
                "KeySchema": [
                    {"AttributeName": "geohash", "KeyType": "HASH"},
                    {"AttributeName": "gender", "KeyType": "RANGE"}
                ],
                "Projection": {"ProjectionType": "ALL"},
                "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
            }
        ]' \
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --region us-east-1
```

**Schema:**
| Attribute | Type | Description |
|-----------|------|-------------|
| email (PK) | String | User's email (partition key) |
| geohash | String | Location geohash for proximity queries |
| gender | String | male/female/other |
| firstName | String | Display name |
| age | Number | User's age |
| coordinates | Map | { lat, lng } |
| photos | List | Array of S3 URLs |
| matchPreferences | Map | User's matching preferences |
| isVisible | Boolean | Whether user is in matching pool |
| activeMatchEmail | String | Current active match (if any) |
| createdAt | String | ISO timestamp |
| updatedAt | String | ISO timestamp |

### 2. oith-matches (Active Matches)

```bash
aws dynamodb create-table \
    --table-name oith-matches \
    --attribute-definitions \
        AttributeName=matchId,AttributeType=S \
    --key-schema \
        AttributeName=matchId,KeyType=HASH \
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --region us-east-1
```

**Schema:**
| Attribute | Type | Description |
|-----------|------|-------------|
| matchId (PK) | String | Format: `{userEmail}_{matchEmail}` |
| userEmail | String | User who was shown the match |
| matchEmail | String | The potential match |
| status | String | presented/accepted/passed |
| compatibility | Number | Calculated compatibility % |
| distance | Number | Distance in miles |
| presentedAt | String | When match was shown |
| acceptedAt | String | When user accepted (if applicable) |

### 3. oith-match-history (Historical Actions)

```bash
aws dynamodb create-table \
    --table-name oith-match-history \
    --attribute-definitions \
        AttributeName=userEmail,AttributeType=S \
        AttributeName=matchEmail,AttributeType=S \
    --key-schema \
        AttributeName=userEmail,KeyType=HASH \
        AttributeName=matchEmail,KeyType=RANGE \
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --region us-east-1
```

**Schema:**
| Attribute | Type | Description |
|-----------|------|-------------|
| userEmail (PK) | String | User who took action |
| matchEmail (SK) | String | Target of action |
| action | String | accept/pass |
| timestamp | String | When action occurred |

---

## S3 Bucket Setup

### Create Photo Storage Bucket

```bash
# Create bucket
aws s3 mb s3://oith-user-photos --region us-east-1

# Enable versioning (for safety)
aws s3api put-bucket-versioning \
    --bucket oith-user-photos \
    --versioning-configuration Status=Enabled

# Set CORS policy
aws s3api put-bucket-cors --bucket oith-user-photos --cors-configuration '{
    "CORSRules": [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
            "AllowedOrigins": ["*"],
            "ExposeHeaders": ["ETag"],
            "MaxAgeSeconds": 3000
        }
    ]
}'

# Set lifecycle policy (delete old versions after 30 days)
aws s3api put-bucket-lifecycle-configuration --bucket oith-user-photos --lifecycle-configuration '{
    "Rules": [
        {
            "ID": "DeleteOldVersions",
            "Status": "Enabled",
            "NoncurrentVersionExpiration": {
                "NoncurrentDays": 30
            },
            "Filter": {
                "Prefix": ""
            }
        }
    ]
}'
```

### Bucket Policy (Public Read for Photos)

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::oith-user-photos/users/*"
        }
    ]
}
```

---

## Lambda Functions Deployment

### 1. Matching Service Lambda

```bash
# Create deployment package
cd prototype/server/lambda
zip -r matchingService.zip matchingService.mjs

# Create Lambda function
aws lambda create-function \
    --function-name oith-matching-service \
    --runtime nodejs18.x \
    --handler matchingService.handler \
    --zip-file fileb://matchingService.zip \
    --role arn:aws:iam::YOUR_ACCOUNT:role/oith-lambda-role \
    --timeout 30 \
    --memory-size 512 \
    --environment Variables="{USERS_TABLE=oith-users}" \
    --region us-east-1
```

### 2. Image Service Lambda

```bash
# Create deployment package
zip -r imageService.zip imageService.mjs

# Create Lambda function
aws lambda create-function \
    --function-name oith-image-service \
    --runtime nodejs18.x \
    --handler imageService.handler \
    --zip-file fileb://imageService.zip \
    --role arn:aws:iam::YOUR_ACCOUNT:role/oith-lambda-role \
    --timeout 30 \
    --memory-size 256 \
    --environment Variables="{S3_BUCKET=oith-user-photos}" \
    --region us-east-1
```

### Required IAM Role Policy

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:Query",
                "dynamodb:Scan"
            ],
            "Resource": [
                "arn:aws:dynamodb:us-east-1:*:table/oith-*",
                "arn:aws:dynamodb:us-east-1:*:table/oith-*/index/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::oith-user-photos/*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:*:*:*"
        }
    ]
}
```

---

## API Gateway Configuration

### Add Routes to Existing API

```bash
API_ID="YOUR_API_GATEWAY_ID"

# Matching Service Routes
aws apigatewayv2 create-route \
    --api-id $API_ID \
    --route-key "POST /api/match/next"

aws apigatewayv2 create-route \
    --api-id $API_ID \
    --route-key "POST /api/match/accept"

aws apigatewayv2 create-route \
    --api-id $API_ID \
    --route-key "POST /api/match/pass"

aws apigatewayv2 create-route \
    --api-id $API_ID \
    --route-key "GET /api/match/status"

# Image Service Routes
aws apigatewayv2 create-route \
    --api-id $API_ID \
    --route-key "POST /api/images/upload"

aws apigatewayv2 create-route \
    --api-id $API_ID \
    --route-key "POST /api/images/confirm"

aws apigatewayv2 create-route \
    --api-id $API_ID \
    --route-key "DELETE /api/images/{photoId}"

aws apigatewayv2 create-route \
    --api-id $API_ID \
    --route-key "GET /api/images/user/{email}"
```

---

## CloudFront CDN Setup

### Create Distribution for Photos

```bash
aws cloudfront create-distribution \
    --origin-domain-name oith-user-photos.s3.amazonaws.com \
    --default-root-object index.html \
    --query 'Distribution.DomainName'
```

### CloudFront Configuration (Console)

1. Go to CloudFront Console
2. Create Distribution
3. Origin Settings:
   - Origin Domain: `oith-user-photos.s3.amazonaws.com`
   - Origin Access: Public
4. Default Cache Behavior:
   - Viewer Protocol Policy: Redirect HTTP to HTTPS
   - Cache Policy: CachingOptimized
5. Price Class: Use Only North America and Europe (cost savings)

---

## CloudWatch Monitoring

### Create Alarms

```bash
# Lambda Error Rate Alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "OITH-Lambda-Errors" \
    --metric-name Errors \
    --namespace AWS/Lambda \
    --statistic Sum \
    --period 300 \
    --threshold 5 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 1 \
    --alarm-actions arn:aws:sns:us-east-1:YOUR_ACCOUNT:oith-alerts

# API Gateway 5xx Errors
aws cloudwatch put-metric-alarm \
    --alarm-name "OITH-API-5xx-Errors" \
    --metric-name 5XXError \
    --namespace AWS/ApiGateway \
    --statistic Sum \
    --period 300 \
    --threshold 10 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 1

# DynamoDB Throttling
aws cloudwatch put-metric-alarm \
    --alarm-name "OITH-DynamoDB-Throttle" \
    --metric-name ThrottledRequests \
    --namespace AWS/DynamoDB \
    --statistic Sum \
    --period 60 \
    --threshold 1 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 1
```

### Create Dashboard

```bash
aws cloudwatch put-dashboard --dashboard-name OITH-Production --dashboard-body '{
    "widgets": [
        {
            "type": "metric",
            "properties": {
                "title": "Lambda Invocations",
                "metrics": [
                    ["AWS/Lambda", "Invocations", "FunctionName", "oith-matching-service"],
                    ["...", "oith-image-service"],
                    ["...", "oith-user-sync"]
                ],
                "period": 60,
                "stat": "Sum"
            }
        },
        {
            "type": "metric",
            "properties": {
                "title": "Lambda Errors",
                "metrics": [
                    ["AWS/Lambda", "Errors", "FunctionName", "oith-matching-service"],
                    ["...", "oith-image-service"]
                ],
                "period": 60,
                "stat": "Sum"
            }
        },
        {
            "type": "metric",
            "properties": {
                "title": "DynamoDB Capacity",
                "metrics": [
                    ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", "oith-users"],
                    [".", "ConsumedWriteCapacityUnits", ".", "."]
                ],
                "period": 60,
                "stat": "Sum"
            }
        }
    ]
}'
```

---

## Cost Estimates

### Monthly Costs by Scale

| Users | DynamoDB | Lambda | S3 | CloudFront | API GW | **Total** |
|-------|----------|--------|-----|------------|--------|-----------|
| 100 | $5 | $1 | $1 | $1 | $3 | **$11** |
| 1,000 | $15 | $5 | $10 | $5 | $15 | **$50** |
| 10,000 | $50 | $25 | $50 | $25 | $50 | **$200** |
| 100,000 | $200 | $100 | $200 | $100 | $200 | **$800** |

### Cost Optimization Tips

1. **DynamoDB**: Use on-demand for unpredictable traffic, provisioned for steady state
2. **Lambda**: Optimize memory size (right-sizing)
3. **S3**: Use Intelligent-Tiering for photos
4. **CloudFront**: Use Price Class 100 (NA/EU only) if users are primarily US-based
5. **Images**: Compress before upload, use WebP format

---

## Deployment Checklist

### Before Deployment
- [ ] Create IAM role with required permissions
- [ ] Set up DynamoDB tables
- [ ] Create S3 bucket with CORS
- [ ] Create Lambda layer with AWS SDK (if needed)

### Deployment Steps
- [ ] Deploy matchingService Lambda
- [ ] Deploy imageService Lambda
- [ ] Configure API Gateway routes
- [ ] Set up CloudFront distribution
- [ ] Configure CloudWatch alarms
- [ ] Update app.js to use new API endpoints

### Post-Deployment
- [ ] Test all endpoints
- [ ] Verify monitoring is working
- [ ] Run load test
- [ ] Document any issues

---

## Rollback Plan

If issues occur after deployment:

1. **API Gateway**: Point routes back to old Lambda versions
2. **Lambda**: Use Lambda versioning/aliases to rollback
3. **DynamoDB**: Tables are independent, no rollback needed
4. **App**: Revert app.js changes via git

```bash
# Rollback Lambda to previous version
aws lambda update-alias \
    --function-name oith-matching-service \
    --name PROD \
    --function-version PREVIOUS_VERSION
```

---

*Last Updated: December 2024*
*Document Location: `prototype/server/SCALING_INFRASTRUCTURE_GUIDE.md`*

