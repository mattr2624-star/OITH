# OITH Auth Service - AWS Lambda Deployment Guide

This guide explains how to deploy the authentication Lambda function to AWS.

## Overview

The `authService.mjs` handles all authentication for the OITH admin dashboard:
- Login / Logout
- User registration
- Password reset
- Session validation
- User management (super_admin only)

## Prerequisites

1. AWS Account with Lambda and API Gateway access
2. Existing `oith-users` DynamoDB table
3. AWS CLI configured (or use AWS Console)

## Step 1: Create the Lambda Function

### Via AWS Console

1. Go to **AWS Lambda** → **Create function**
2. Choose **"Author from scratch"**
3. Configure:
   - **Function name:** `oith-auth-service`
   - **Runtime:** Node.js 20.x
   - **Architecture:** x86_64 or arm64
4. Click **Create function**

### Via AWS CLI

```bash
# Create the function (after zipping)
aws lambda create-function \
  --function-name oith-auth-service \
  --runtime nodejs20.x \
  --handler authService.handler \
  --role arn:aws:iam::YOUR_ACCOUNT:role/YOUR_LAMBDA_ROLE \
  --zip-file fileb://authService.zip
```

## Step 2: Upload the Code

### Option A: Console Upload
1. Open `authService.mjs` in a text editor
2. In AWS Console, go to your Lambda function
3. Paste the code in the inline editor
4. Click **Deploy**

### Option B: ZIP Upload
```powershell
# In PowerShell, create a zip file
Compress-Archive -Path authService.mjs -DestinationPath authService.zip -Force

# Upload via CLI
aws lambda update-function-code \
  --function-name oith-auth-service \
  --zip-file fileb://authService.zip
```

## Step 3: Configure Environment Variables

In the Lambda console → **Configuration** → **Environment variables**:

| Variable | Value | Description |
|----------|-------|-------------|
| `DYNAMODB_TABLE` | `oith-users` | DynamoDB table name |

## Step 4: Set IAM Permissions

The Lambda execution role needs DynamoDB access. Add this policy:

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
        "dynamodb:Scan",
        "dynamodb:Query"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:YOUR_ACCOUNT:table/oith-users"
      ]
    }
  ]
}
```

## Step 5: Configure API Gateway

### Add Routes to Existing API Gateway

If you already have an API Gateway (e.g., `emeapbgbui`), add these routes:

| Method | Path | Integration |
|--------|------|-------------|
| POST | `/auth/login` | oith-auth-service |
| POST | `/auth/register` | oith-auth-service |
| GET | `/auth/validate` | oith-auth-service |
| POST | `/auth/forgot-password` | oith-auth-service |
| POST | `/auth/reset-password` | oith-auth-service |
| GET | `/auth/users` | oith-auth-service |
| PUT | `/auth/users/{email}` | oith-auth-service |
| DELETE | `/auth/users/{email}` | oith-auth-service |
| OPTIONS | `/auth/{proxy+}` | oith-auth-service |

### Via Console

1. Go to **API Gateway** → Select your API
2. Click **Create route**
3. For each endpoint above:
   - Select method and enter path
   - Click **Create and attach integration**
   - Choose **Lambda function**
   - Select `oith-auth-service`
4. **Deploy** the API

### Via CLI

```bash
# Get your API ID
aws apigatewayv2 get-apis

# Create routes (example for POST /auth/login)
aws apigatewayv2 create-route \
  --api-id YOUR_API_ID \
  --route-key "POST /auth/login" \
  --target integrations/YOUR_INTEGRATION_ID
```

## Step 6: Enable CORS

In API Gateway → **CORS**:
- **Access-Control-Allow-Origin:** `*`
- **Access-Control-Allow-Headers:** `Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token`
- **Access-Control-Allow-Methods:** `GET, POST, PUT, DELETE, OPTIONS`

## Step 7: Create Initial Super Admin

After deployment, you need to create the first super admin user. Run this in AWS CloudShell or via a script:

```javascript
// Run in Lambda test event or locally
const newAdmin = {
    pk: 'ADMIN#admin@oith.com',
    sk: 'PROFILE',
    dataType: 'admin_user',
    email: 'admin@oith.com',
    name: 'Admin User',
    // SHA-256 hash of 'admin123' + 'oith_salt_2024'
    password: 'YOUR_HASHED_PASSWORD_HERE',
    role: 'super_admin',
    createdAt: new Date().toISOString(),
    lastLogin: null,
    isActive: true
};
```

Or use the DynamoDB console to create the item manually.

### Generate Password Hash

To generate the password hash, you can use this Node.js snippet:

```javascript
const crypto = require('crypto');
const password = 'your_password_here';
const hash = crypto.createHash('sha256')
  .update(password + 'oith_salt_2024')
  .digest('hex');
console.log(hash);
```

## Step 8: Test the Deployment

### Test Login
```bash
curl -X POST https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@oith.com","password":"admin123"}'
```

### Expected Response
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "email": "admin@oith.com",
    "name": "Admin User",
    "role": "super_admin"
  },
  "token": "eyJlbWFpbCI6ImFkbWluQG9pdGguY29tIiwidGltZXN0YW1wIjoxNzAyMzk..."
}
```

## Troubleshooting

### "Invalid email or password"
- Check that the admin user exists in DynamoDB
- Verify the password hash matches

### "Internal server error"
- Check Lambda CloudWatch logs
- Verify DynamoDB permissions

### CORS Errors
- Ensure OPTIONS routes are configured
- Check CORS headers in API Gateway

### Token Validation Fails
- Tokens expire after 24 hours
- Check that the Authorization header includes "Bearer "

## Security Notes

1. **Production Deployment:**
   - Remove `_devToken` from forgot-password response
   - Implement actual email sending for password resets
   - Consider using AWS Cognito for production auth

2. **Password Security:**
   - Current implementation uses SHA-256 (adequate for prototype)
   - For production, consider bcrypt or Argon2

3. **Token Security:**
   - Current tokens are base64-encoded JSON
   - For production, consider JWT with proper signing

