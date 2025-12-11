# OITH Matching Service - Optimized Deployment Script
# Run this script to deploy the performance-optimized matching service

param(
    [switch]$SetupGSI,
    [switch]$DeployLambda,
    [switch]$CreatePackage,
    [switch]$All
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " OITH Performance Optimization Deploy" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Configuration
$LAMBDA_FUNCTION_NAME = "oith-matching"
$REGION = if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-east-1" }
$PACKAGE_NAME = "matchingService-optimized.zip"

function Test-AwsCli {
    try {
        aws --version | Out-Null
        return $true
    } catch {
        Write-Host "AWS CLI not found. Please install it first." -ForegroundColor Red
        Write-Host "https://aws.amazon.com/cli/" -ForegroundColor Yellow
        return $false
    }
}

function Test-NodeJs {
    try {
        node --version | Out-Null
        return $true
    } catch {
        Write-Host "Node.js not found. Please install it first." -ForegroundColor Red
        return $false
    }
}

function Setup-GSI {
    Write-Host "`n[1/3] Setting up DynamoDB GSIs..." -ForegroundColor Yellow
    
    if (-not (Test-NodeJs)) { return $false }
    
    # Check current status
    Write-Host "  Checking current GSI status..."
    node setup-dynamodb-gsi.mjs --status
    
    # Prompt for update
    $confirm = Read-Host "`n  Do you want to update tables with GSIs? (y/n)"
    if ($confirm -eq 'y') {
        Write-Host "  Updating tables with GSIs (this may take 5-10 minutes)..."
        node setup-dynamodb-gsi.mjs --update
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ GSIs created successfully!" -ForegroundColor Green
        } else {
            Write-Host "  ❌ GSI creation failed. Check output above." -ForegroundColor Red
            return $false
        }
    }
    
    return $true
}

function Create-Package {
    Write-Host "`n[2/3] Creating deployment package..." -ForegroundColor Yellow
    
    # Create temp directory
    $TempDir = ".\temp-deploy"
    if (Test-Path $TempDir) { Remove-Item -Recurse -Force $TempDir }
    New-Item -ItemType Directory -Path $TempDir | Out-Null
    
    # Copy Lambda files
    Write-Host "  Copying Lambda function files..."
    Copy-Item "matchingService-optimized.mjs" "$TempDir\index.mjs"
    Copy-Item "monitoring.mjs" "$TempDir\monitoring.mjs"
    
    # Create package.json
    $PackageJson = @{
        name = "oith-matching-optimized"
        version = "2.0.0"
        type = "module"
        dependencies = @{
            "@aws-sdk/client-dynamodb" = "^3.0.0"
            "@aws-sdk/lib-dynamodb" = "^3.0.0"
            "@aws-sdk/client-cloudwatch" = "^3.0.0"
            "@aws-sdk/client-sns" = "^3.0.0"
        }
    } | ConvertTo-Json -Depth 3
    
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
    
    # Cleanup
    Remove-Item -Recurse -Force $TempDir
    
    $Size = (Get-Item $PACKAGE_NAME).Length / 1MB
    Write-Host "  ✅ Package created: $PACKAGE_NAME (${Size:N2} MB)" -ForegroundColor Green
    
    return $true
}

function Deploy-Lambda {
    Write-Host "`n[3/3] Deploying to AWS Lambda..." -ForegroundColor Yellow
    
    if (-not (Test-AwsCli)) { return $false }
    
    if (-not (Test-Path $PACKAGE_NAME)) {
        Write-Host "  Package not found. Running Create-Package first..."
        if (-not (Create-Package)) { return $false }
    }
    
    # Check if function exists
    Write-Host "  Checking if Lambda function exists..."
    try {
        aws lambda get-function --function-name $LAMBDA_FUNCTION_NAME --region $REGION 2>&1 | Out-Null
        $FunctionExists = $true
        Write-Host "  Function exists, will update code."
    } catch {
        $FunctionExists = $false
        Write-Host "  Function does not exist, will need to create."
    }
    
    if ($FunctionExists) {
        # Update existing function
        Write-Host "  Updating Lambda function code..."
        aws lambda update-function-code `
            --function-name $LAMBDA_FUNCTION_NAME `
            --zip-file "fileb://$PACKAGE_NAME" `
            --region $REGION
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ Lambda function updated!" -ForegroundColor Green
            
            # Update configuration
            Write-Host "  Updating function configuration..."
            aws lambda update-function-configuration `
                --function-name $LAMBDA_FUNCTION_NAME `
                --handler index.handler `
                --runtime nodejs18.x `
                --timeout 30 `
                --memory-size 512 `
                --region $REGION
        }
    } else {
        Write-Host "  ⚠️ Lambda function does not exist." -ForegroundColor Yellow
        Write-Host "  Please create it in AWS Console or use CloudFormation."
        Write-Host ""
        Write-Host "  Manual steps:"
        Write-Host "  1. Go to AWS Lambda Console"
        Write-Host "  2. Create function: $LAMBDA_FUNCTION_NAME"
        Write-Host "  3. Runtime: Node.js 18.x"
        Write-Host "  4. Upload $PACKAGE_NAME"
        Write-Host "  5. Handler: index.handler"
        Write-Host "  6. Memory: 512 MB, Timeout: 30s"
    }
    
    return $true
}

function Show-Summary {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host " Deployment Complete!" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
    
    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "  1. Test the optimized endpoint"
    Write-Host "  2. Monitor CloudWatch metrics"
    Write-Host "  3. Run load tests with simulation tool"
    Write-Host ""
    Write-Host "Useful Commands:" -ForegroundColor Yellow
    Write-Host "  # Check GSI status"
    Write-Host "  node setup-dynamodb-gsi.mjs --status"
    Write-Host ""
    Write-Host "  # View CloudWatch logs"
    Write-Host "  aws logs tail /aws/lambda/$LAMBDA_FUNCTION_NAME --follow"
    Write-Host ""
    Write-Host "  # Run simulation"
    Write-Host "  Open: prototype/simulation/index.html"
    Write-Host ""
}

# Main execution
if ($All -or (-not ($SetupGSI -or $DeployLambda -or $CreatePackage))) {
    Write-Host "Running full deployment...`n"
    
    if (Setup-GSI) {
        if (Create-Package) {
            Deploy-Lambda
        }
    }
    
    Show-Summary
}
elseif ($SetupGSI) {
    Setup-GSI
}
elseif ($CreatePackage) {
    Create-Package
}
elseif ($DeployLambda) {
    Deploy-Lambda
}

Write-Host ""

