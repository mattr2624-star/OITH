#
# OITH Enterprise Infrastructure Deployment Script (PowerShell)
# 
# This script deploys all infrastructure components required for enterprise scale:
# - ElastiCache Redis cluster
# - DynamoDB DAX cluster
# - SQS queues
# - Step Functions state machines
# - CloudWatch alarms and dashboard
#

param(
    [Parameter(Position=0)]
    [ValidateSet("development", "staging", "production")]
    [string]$Environment = "production",
    
    [Parameter(Position=1)]
    [ValidateSet("deploy", "cleanup", "status")]
    [string]$Action = "deploy"
)

# ==========================================
# CONFIGURATION
# ==========================================

$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-east-1" }
$StackPrefix = "oith-$Environment"
$AlertEmail = if ($env:ALERT_EMAIL) { $env:ALERT_EMAIL } else { "alerts@oith.com" }

# ==========================================
# HELPER FUNCTIONS
# ==========================================

function Write-Info { param($Message) Write-Host "[INFO] $Message" -ForegroundColor Blue }
function Write-Success { param($Message) Write-Host "[SUCCESS] $Message" -ForegroundColor Green }
function Write-Warn { param($Message) Write-Host "[WARNING] $Message" -ForegroundColor Yellow }
function Write-Err { param($Message) Write-Host "[ERROR] $Message" -ForegroundColor Red }

function Test-AWSCli {
    try {
        $null = aws sts get-caller-identity 2>&1
        Write-Success "AWS CLI is configured"
        return $true
    } catch {
        Write-Err "AWS CLI is not configured. Please run 'aws configure' first."
        return $false
    }
}

function Get-VPCInfo {
    Write-Info "Getting VPC information..."
    
    $VpcId = aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text --region $Region 2>$null
    
    if (-not $VpcId -or $VpcId -eq "None") {
        Write-Warn "No default VPC found. Please set VPC_ID environment variable."
        return $null
    }
    
    Write-Success "Found VPC: $VpcId"
    
    $Subnets = aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VpcId" --query "Subnets[*].SubnetId" --output text --region $Region
    $SubnetArray = $Subnets -split "`t"
    
    if ($SubnetArray.Count -lt 2) {
        Write-Err "At least 2 subnets are required. Found: $($SubnetArray.Count)"
        return $null
    }
    
    Write-Success "Found subnets: $($SubnetArray[0]), $($SubnetArray[1])"
    
    return @{
        VpcId = $VpcId
        Subnet1 = $SubnetArray[0]
        Subnet2 = $SubnetArray[1]
        Subnet3 = if ($SubnetArray.Count -gt 2) { $SubnetArray[2] } else { "" }
    }
}

function Get-LambdaSecurityGroup {
    param($VpcId)
    
    Write-Info "Creating/Getting Lambda security group..."
    
    $SgName = "$StackPrefix-lambda-sg"
    
    $SgId = aws ec2 describe-security-groups `
        --filters "Name=group-name,Values=$SgName" "Name=vpc-id,Values=$VpcId" `
        --query "SecurityGroups[0].GroupId" `
        --output text `
        --region $Region 2>$null
    
    if (-not $SgId -or $SgId -eq "None") {
        Write-Info "Creating Lambda security group..."
        
        $SgId = aws ec2 create-security-group `
            --group-name $SgName `
            --description "Security group for OITH Lambda functions" `
            --vpc-id $VpcId `
            --query "GroupId" `
            --output text `
            --region $Region
    }
    
    Write-Success "Lambda security group: $SgId"
    return $SgId
}

function Deploy-Stack {
    param(
        [string]$StackName,
        [string]$TemplateFile,
        [string]$Parameters
    )
    
    Write-Info "Deploying stack: $StackName"
    
    # Check if stack exists
    $StackExists = $false
    try {
        $null = aws cloudformation describe-stacks --stack-name $StackName --region $Region 2>&1
        $StackExists = $true
    } catch {}
    
    if ($StackExists) {
        Write-Info "Stack exists, updating..."
        try {
            aws cloudformation update-stack `
                --stack-name $StackName `
                --template-body "file://$TemplateFile" `
                --parameters $Parameters `
                --capabilities CAPABILITY_NAMED_IAM `
                --region $Region 2>&1
            
            Write-Info "Waiting for update to complete..."
            aws cloudformation wait stack-update-complete --stack-name $StackName --region $Region
        } catch {
            if ($_.Exception.Message -match "No updates") {
                Write-Info "No updates required for $StackName"
                return
            }
            throw
        }
    } else {
        Write-Info "Creating new stack..."
        aws cloudformation create-stack `
            --stack-name $StackName `
            --template-body "file://$TemplateFile" `
            --parameters $Parameters `
            --capabilities CAPABILITY_NAMED_IAM `
            --region $Region
        
        Write-Info "Waiting for creation to complete..."
        aws cloudformation wait stack-create-complete --stack-name $StackName --region $Region
    }
    
    Write-Success "Stack $StackName deployed successfully"
}

function Get-StackOutput {
    param(
        [string]$StackName,
        [string]$OutputKey
    )
    
    return aws cloudformation describe-stacks `
        --stack-name $StackName `
        --query "Stacks[0].Outputs[?OutputKey=='$OutputKey'].OutputValue" `
        --output text `
        --region $Region
}

# ==========================================
# MAIN DEPLOYMENT
# ==========================================

function Deploy-Infrastructure {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "  OITH Enterprise Infrastructure Deploy  " -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Environment: $Environment"
    Write-Host "Region: $Region"
    Write-Host ""
    
    # Pre-flight checks
    if (-not (Test-AWSCli)) { return }
    
    $VpcInfo = Get-VPCInfo
    if (-not $VpcInfo) { return }
    
    $LambdaSG = Get-LambdaSecurityGroup -VpcId $VpcInfo.VpcId
    
    Write-Host ""
    Write-Info "Starting deployment..."
    Write-Host ""
    
    # Deploy Main Infrastructure
    Write-Info "Deploying main infrastructure..."
    
    $InfraParams = @(
        "ParameterKey=Environment,ParameterValue=$Environment",
        "ParameterKey=VpcId,ParameterValue=$($VpcInfo.VpcId)",
        "ParameterKey=PrivateSubnet1,ParameterValue=$($VpcInfo.Subnet1)",
        "ParameterKey=PrivateSubnet2,ParameterValue=$($VpcInfo.Subnet2)",
        "ParameterKey=LambdaSecurityGroupId,ParameterValue=$LambdaSG",
        "ParameterKey=AlertEmail,ParameterValue=$AlertEmail"
    ) -join " "
    
    Deploy-Stack -StackName "$StackPrefix-infrastructure" -TemplateFile "cloudformation-infrastructure.yaml" -Parameters $InfraParams
    
    # Deploy Step Functions
    Write-Info "Deploying Step Functions..."
    
    $SfnParams = @(
        "ParameterKey=Environment,ParameterValue=$Environment",
        "ParameterKey=UsersTableName,ParameterValue=oith-users",
        "ParameterKey=MatchesTableName,ParameterValue=oith-matches"
    ) -join " "
    
    Deploy-Stack -StackName "$StackPrefix-stepfunctions" -TemplateFile "cloudformation-stepfunctions.yaml" -Parameters $SfnParams
    
    # Get Outputs
    Write-Host ""
    Write-Info "Getting deployment outputs..."
    
    $RedisEndpoint = Get-StackOutput -StackName "$StackPrefix-infrastructure" -OutputKey "ElastiCacheEndpoint"
    $DaxEndpoint = Get-StackOutput -StackName "$StackPrefix-infrastructure" -OutputKey "DAXEndpoint"
    $QueueUrl = Get-StackOutput -StackName "$StackPrefix-infrastructure" -OutputKey "MatchingQueueUrl"
    $DashboardUrl = Get-StackOutput -StackName "$StackPrefix-infrastructure" -OutputKey "DashboardUrl"
    
    # Generate Environment File
    $EnvContent = @"
# OITH Infrastructure Configuration
# Generated: $(Get-Date)
# Environment: $Environment

# ElastiCache Redis
REDIS_HOST=$RedisEndpoint
REDIS_PORT=6379

# DynamoDB DAX
DAX_ENDPOINTS=$DaxEndpoint

# SQS Queues
MATCHING_QUEUE_URL=$QueueUrl

# Region
AWS_REGION=$Region
"@
    
    $EnvContent | Out-File -FilePath "..\env-infrastructure.txt" -Encoding UTF8
    Write-Success "Environment file generated: server/env-infrastructure.txt"
    
    # Summary
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "        DEPLOYMENT COMPLETE              " -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Resources Deployed:"
    Write-Host "  ✅ ElastiCache Redis: $RedisEndpoint" -ForegroundColor Green
    Write-Host "  ✅ DynamoDB DAX: $DaxEndpoint" -ForegroundColor Green
    Write-Host "  ✅ SQS Matching Queue: $QueueUrl" -ForegroundColor Green
    Write-Host "  ✅ Step Functions State Machines" -ForegroundColor Green
    Write-Host "  ✅ CloudWatch Alarms & Dashboard" -ForegroundColor Green
    Write-Host ""
    Write-Host "Dashboard URL:"
    Write-Host "  $DashboardUrl" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next Steps:"
    Write-Host "  1. Update Lambda environment variables with values from env-infrastructure.txt"
    Write-Host "  2. Deploy Lambda functions to VPC with security group: $LambdaSG"
    Write-Host "  3. Confirm email subscription for alerts"
    Write-Host "  4. Run stress tests to verify improvements"
    Write-Host ""
    Write-Success "Deployment completed successfully!"
}

function Remove-Infrastructure {
    Write-Warn "This will delete all OITH infrastructure for $Environment environment."
    $Confirm = Read-Host "Are you sure? (y/N)"
    
    if ($Confirm -eq 'y' -or $Confirm -eq 'Y') {
        Write-Info "Deleting Step Functions stack..."
        aws cloudformation delete-stack --stack-name "$StackPrefix-stepfunctions" --region $Region 2>$null
        
        Write-Info "Deleting infrastructure stack..."
        aws cloudformation delete-stack --stack-name "$StackPrefix-infrastructure" --region $Region 2>$null
        
        Write-Info "Waiting for deletion..."
        aws cloudformation wait stack-delete-complete --stack-name "$StackPrefix-stepfunctions" --region $Region 2>$null
        aws cloudformation wait stack-delete-complete --stack-name "$StackPrefix-infrastructure" --region $Region 2>$null
        
        Write-Success "Cleanup completed"
    } else {
        Write-Info "Cleanup cancelled"
    }
}

function Get-Status {
    Write-Host ""
    Write-Host "OITH Infrastructure Status" -ForegroundColor Cyan
    Write-Host "==========================" -ForegroundColor Cyan
    Write-Host ""
    
    $Stacks = @("$StackPrefix-infrastructure", "$StackPrefix-stepfunctions")
    
    foreach ($Stack in $Stacks) {
        try {
            $Status = aws cloudformation describe-stacks --stack-name $Stack --query "Stacks[0].StackStatus" --output text --region $Region 2>$null
            
            $Color = switch -Regex ($Status) {
                "COMPLETE" { "Green" }
                "IN_PROGRESS" { "Yellow" }
                "FAILED|ROLLBACK" { "Red" }
                default { "White" }
            }
            
            Write-Host "  $Stack : $Status" -ForegroundColor $Color
        } catch {
            Write-Host "  $Stack : NOT FOUND" -ForegroundColor Gray
        }
    }
    Write-Host ""
}

# ==========================================
# ENTRY POINT
# ==========================================

switch ($Action) {
    "deploy" { Deploy-Infrastructure }
    "cleanup" { Remove-Infrastructure }
    "status" { Get-Status }
}

