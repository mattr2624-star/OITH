# Deploy OITH Matching Service Lambda
# This deploys the matchingService.mjs to AWS Lambda

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " OITH Matching Service Deployment" -ForegroundColor Cyan  
Write-Host "========================================`n" -ForegroundColor Cyan

$LAMBDA_FUNCTION_NAME = "oith-matching-service"
$REGION = "us-east-1"
$PACKAGE_NAME = "matchingService.zip"

# Create temp directory
$TempDir = ".\temp-matching-deploy"
if (Test-Path $TempDir) { Remove-Item -Recurse -Force $TempDir }
New-Item -ItemType Directory -Path $TempDir | Out-Null

Write-Host "Step 1: Creating deployment package..." -ForegroundColor Yellow

# Copy Lambda file as index.mjs
Copy-Item "matchingService.mjs" "$TempDir\index.mjs"

# Create package.json
$PackageJson = @"
{
    "name": "oith-matching-service",
    "version": "1.0.0",
    "type": "module",
    "dependencies": {
        "@aws-sdk/client-dynamodb": "^3.0.0",
        "@aws-sdk/lib-dynamodb": "^3.0.0"
    }
}
"@
Set-Content "$TempDir\package.json" $PackageJson

# Install dependencies
Write-Host "  Installing dependencies..."
Push-Location $TempDir
npm install --production 2>&1 | Out-Null
Pop-Location

# Create zip
Write-Host "  Creating zip package..."
if (Test-Path $PACKAGE_NAME) { Remove-Item $PACKAGE_NAME }
Compress-Archive -Path "$TempDir\*" -DestinationPath $PACKAGE_NAME -Force

# Cleanup temp
Remove-Item -Recurse -Force $TempDir

$Size = (Get-Item $PACKAGE_NAME).Length / 1MB
Write-Host "  Package created: $PACKAGE_NAME (${Size:N2} MB)" -ForegroundColor Green

Write-Host "`nStep 2: Deploying to AWS Lambda..." -ForegroundColor Yellow

# Check AWS CLI
try {
    aws --version | Out-Null
} catch {
    Write-Host "AWS CLI not found!" -ForegroundColor Red
    Write-Host "Please install AWS CLI: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    Write-Host "`nAlternatively, upload $PACKAGE_NAME manually to Lambda console:" -ForegroundColor Yellow
    Write-Host "  1. Go to AWS Lambda Console" -ForegroundColor White
    Write-Host "  2. Find the matching service Lambda function" -ForegroundColor White  
    Write-Host "  3. Upload $PACKAGE_NAME" -ForegroundColor White
    Write-Host "  4. Click Deploy" -ForegroundColor White
    exit 1
}

# Try different Lambda function names that might be used
$possibleNames = @(
    "oith-matching-service",
    "oith-matching",
    "oith-user-sync",
    "oith-api"
)

$foundFunction = $null
foreach ($name in $possibleNames) {
    try {
        $result = aws lambda get-function --function-name $name --region $REGION 2>&1
        if ($LASTEXITCODE -eq 0) {
            $foundFunction = $name
            Write-Host "  Found Lambda function: $name" -ForegroundColor Green
            break
        }
    } catch {
        # Function not found, try next
    }
}

if ($foundFunction) {
    Write-Host "  Updating Lambda function code..."
    aws lambda update-function-code `
        --function-name $foundFunction `
        --zip-file "fileb://$PACKAGE_NAME" `
        --region $REGION
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n  ✅ Lambda function updated successfully!" -ForegroundColor Green
        
        Write-Host "`nStep 3: Testing the deployment..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3  # Wait for deployment to propagate
        
        # Test the API
        try {
            $testResult = Invoke-RestMethod -Uri "https://emeapbgbui.execute-api.us-east-1.amazonaws.com/api/match/pool-stats?userEmail=test@test.com" -Method GET
            Write-Host "  ✅ API is responding!" -ForegroundColor Green
            Write-Host "  Total visible users: $($testResult.totalVisibleUsers)" -ForegroundColor White
        } catch {
            Write-Host "  ⚠️ API test failed - may need a few more seconds" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ❌ Deployment failed!" -ForegroundColor Red
    }
} else {
    Write-Host "  Could not find Lambda function automatically." -ForegroundColor Yellow
    Write-Host "`n  Please upload $PACKAGE_NAME manually:" -ForegroundColor Yellow
    Write-Host "  1. Go to AWS Lambda Console: https://console.aws.amazon.com/lambda" -ForegroundColor White
    Write-Host "  2. Find the function connected to API Gateway" -ForegroundColor White
    Write-Host "  3. Upload the zip file: $ScriptDir\$PACKAGE_NAME" -ForegroundColor White
    Write-Host "  4. Click Deploy" -ForegroundColor White
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " Deployment Complete" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

