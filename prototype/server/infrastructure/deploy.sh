#!/bin/bash
#
# OITH Enterprise Infrastructure Deployment Script
# 
# This script deploys all infrastructure components required for enterprise scale:
# - ElastiCache Redis cluster
# - DynamoDB DAX cluster
# - SQS queues
# - Step Functions state machines
# - CloudWatch alarms and dashboard
#
# Prerequisites:
# - AWS CLI configured with appropriate credentials
# - VPC with private subnets
# - Lambda security group
#

set -e

# ==========================================
# CONFIGURATION
# ==========================================

ENVIRONMENT=${1:-production}
REGION=${AWS_REGION:-us-east-1}
STACK_PREFIX="oith-${ENVIRONMENT}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ==========================================
# HELPER FUNCTIONS
# ==========================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS CLI is not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    log_success "AWS CLI is configured"
}

wait_for_stack() {
    local stack_name=$1
    local operation=$2
    
    log_info "Waiting for stack $stack_name to complete $operation..."
    
    if [ "$operation" == "create" ]; then
        aws cloudformation wait stack-create-complete --stack-name $stack_name --region $REGION
    elif [ "$operation" == "update" ]; then
        aws cloudformation wait stack-update-complete --stack-name $stack_name --region $REGION
    fi
    
    log_success "Stack $stack_name $operation completed"
}

deploy_stack() {
    local stack_name=$1
    local template_file=$2
    local parameters=$3
    
    log_info "Deploying stack: $stack_name"
    
    # Check if stack exists
    if aws cloudformation describe-stacks --stack-name $stack_name --region $REGION &> /dev/null; then
        log_info "Stack exists, updating..."
        
        aws cloudformation update-stack \
            --stack-name $stack_name \
            --template-body file://$template_file \
            --parameters $parameters \
            --capabilities CAPABILITY_NAMED_IAM \
            --region $REGION 2>&1 || {
            if [[ $? -eq 255 ]]; then
                log_info "No updates required for $stack_name"
                return 0
            fi
        }
        
        wait_for_stack $stack_name "update"
    else
        log_info "Creating new stack..."
        
        aws cloudformation create-stack \
            --stack-name $stack_name \
            --template-body file://$template_file \
            --parameters $parameters \
            --capabilities CAPABILITY_NAMED_IAM \
            --region $REGION
        
        wait_for_stack $stack_name "create"
    fi
    
    log_success "Stack $stack_name deployed successfully"
}

get_vpc_info() {
    log_info "Getting VPC information..."
    
    # Try to get default VPC
    VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text --region $REGION 2>/dev/null)
    
    if [ "$VPC_ID" == "None" ] || [ -z "$VPC_ID" ]; then
        log_warning "No default VPC found. Please provide VPC_ID environment variable."
        exit 1
    fi
    
    log_success "Found VPC: $VPC_ID"
    
    # Get private subnets (or any subnets if no private)
    SUBNETS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query "Subnets[*].SubnetId" --output text --region $REGION)
    SUBNET_ARRAY=($SUBNETS)
    
    if [ ${#SUBNET_ARRAY[@]} -lt 2 ]; then
        log_error "At least 2 subnets are required. Found: ${#SUBNET_ARRAY[@]}"
        exit 1
    fi
    
    SUBNET_1=${SUBNET_ARRAY[0]}
    SUBNET_2=${SUBNET_ARRAY[1]}
    SUBNET_3=${SUBNET_ARRAY[2]:-""}
    
    log_success "Found subnets: $SUBNET_1, $SUBNET_2, $SUBNET_3"
}

create_lambda_security_group() {
    log_info "Creating/Getting Lambda security group..."
    
    SG_NAME="${STACK_PREFIX}-lambda-sg"
    
    LAMBDA_SG=$(aws ec2 describe-security-groups \
        --filters "Name=group-name,Values=$SG_NAME" "Name=vpc-id,Values=$VPC_ID" \
        --query "SecurityGroups[0].GroupId" \
        --output text \
        --region $REGION 2>/dev/null)
    
    if [ "$LAMBDA_SG" == "None" ] || [ -z "$LAMBDA_SG" ]; then
        log_info "Creating Lambda security group..."
        
        LAMBDA_SG=$(aws ec2 create-security-group \
            --group-name $SG_NAME \
            --description "Security group for OITH Lambda functions" \
            --vpc-id $VPC_ID \
            --query "GroupId" \
            --output text \
            --region $REGION)
        
        # Allow outbound traffic
        aws ec2 authorize-security-group-egress \
            --group-id $LAMBDA_SG \
            --protocol -1 \
            --port -1 \
            --cidr 0.0.0.0/0 \
            --region $REGION 2>/dev/null || true
    fi
    
    log_success "Lambda security group: $LAMBDA_SG"
}

# ==========================================
# MAIN DEPLOYMENT
# ==========================================

main() {
    echo ""
    echo "=========================================="
    echo "  OITH Enterprise Infrastructure Deploy  "
    echo "=========================================="
    echo ""
    echo "Environment: $ENVIRONMENT"
    echo "Region: $REGION"
    echo ""
    
    # Pre-flight checks
    check_aws_cli
    get_vpc_info
    create_lambda_security_group
    
    # Get alert email from environment or use default
    ALERT_EMAIL=${ALERT_EMAIL:-"alerts@oith.com"}
    
    echo ""
    log_info "Starting deployment..."
    echo ""
    
    # ==========================================
    # Deploy Main Infrastructure
    # ==========================================
    
    log_info "Deploying main infrastructure (ElastiCache, DAX, SQS, CloudWatch)..."
    
    INFRA_PARAMS="ParameterKey=Environment,ParameterValue=$ENVIRONMENT"
    INFRA_PARAMS="$INFRA_PARAMS ParameterKey=VpcId,ParameterValue=$VPC_ID"
    INFRA_PARAMS="$INFRA_PARAMS ParameterKey=PrivateSubnet1,ParameterValue=$SUBNET_1"
    INFRA_PARAMS="$INFRA_PARAMS ParameterKey=PrivateSubnet2,ParameterValue=$SUBNET_2"
    INFRA_PARAMS="$INFRA_PARAMS ParameterKey=LambdaSecurityGroupId,ParameterValue=$LAMBDA_SG"
    INFRA_PARAMS="$INFRA_PARAMS ParameterKey=AlertEmail,ParameterValue=$ALERT_EMAIL"
    
    if [ -n "$SUBNET_3" ]; then
        INFRA_PARAMS="$INFRA_PARAMS ParameterKey=PrivateSubnet3,ParameterValue=$SUBNET_3"
    fi
    
    deploy_stack "${STACK_PREFIX}-infrastructure" "cloudformation-infrastructure.yaml" "$INFRA_PARAMS"
    
    # ==========================================
    # Deploy Step Functions
    # ==========================================
    
    log_info "Deploying Step Functions state machines..."
    
    SFN_PARAMS="ParameterKey=Environment,ParameterValue=$ENVIRONMENT"
    SFN_PARAMS="$SFN_PARAMS ParameterKey=UsersTableName,ParameterValue=oith-users"
    SFN_PARAMS="$SFN_PARAMS ParameterKey=MatchesTableName,ParameterValue=oith-matches"
    
    deploy_stack "${STACK_PREFIX}-stepfunctions" "cloudformation-stepfunctions.yaml" "$SFN_PARAMS"
    
    # ==========================================
    # Get Outputs
    # ==========================================
    
    echo ""
    log_info "Getting deployment outputs..."
    echo ""
    
    # Get infrastructure outputs
    REDIS_ENDPOINT=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_PREFIX}-infrastructure" \
        --query "Stacks[0].Outputs[?OutputKey=='ElastiCacheEndpoint'].OutputValue" \
        --output text \
        --region $REGION)
    
    DAX_ENDPOINT=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_PREFIX}-infrastructure" \
        --query "Stacks[0].Outputs[?OutputKey=='DAXEndpoint'].OutputValue" \
        --output text \
        --region $REGION)
    
    QUEUE_URL=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_PREFIX}-infrastructure" \
        --query "Stacks[0].Outputs[?OutputKey=='MatchingQueueUrl'].OutputValue" \
        --output text \
        --region $REGION)
    
    DASHBOARD_URL=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_PREFIX}-infrastructure" \
        --query "Stacks[0].Outputs[?OutputKey=='DashboardUrl'].OutputValue" \
        --output text \
        --region $REGION)
    
    # ==========================================
    # Generate Environment File
    # ==========================================
    
    log_info "Generating environment configuration..."
    
    cat > ../env-infrastructure.txt << EOF
# OITH Infrastructure Configuration
# Generated: $(date)
# Environment: $ENVIRONMENT

# ElastiCache Redis
REDIS_HOST=$REDIS_ENDPOINT
REDIS_PORT=6379

# DynamoDB DAX
DAX_ENDPOINTS=$DAX_ENDPOINT

# SQS Queues
MATCHING_QUEUE_URL=$QUEUE_URL

# Region
AWS_REGION=$REGION
EOF
    
    log_success "Environment file generated: server/env-infrastructure.txt"
    
    # ==========================================
    # Summary
    # ==========================================
    
    echo ""
    echo "=========================================="
    echo "        DEPLOYMENT COMPLETE              "
    echo "=========================================="
    echo ""
    echo "Resources Deployed:"
    echo "  ✅ ElastiCache Redis: $REDIS_ENDPOINT"
    echo "  ✅ DynamoDB DAX: $DAX_ENDPOINT"
    echo "  ✅ SQS Matching Queue: $QUEUE_URL"
    echo "  ✅ Step Functions State Machines"
    echo "  ✅ CloudWatch Alarms & Dashboard"
    echo ""
    echo "Dashboard URL:"
    echo "  $DASHBOARD_URL"
    echo ""
    echo "Next Steps:"
    echo "  1. Update Lambda environment variables with values from env-infrastructure.txt"
    echo "  2. Deploy Lambda functions to VPC with security group: $LAMBDA_SG"
    echo "  3. Confirm email subscription for alerts"
    echo "  4. Run stress tests to verify improvements"
    echo ""
    log_success "Deployment completed successfully!"
}

# ==========================================
# CLEANUP FUNCTION
# ==========================================

cleanup() {
    echo ""
    log_warning "Cleaning up infrastructure..."
    
    read -p "Are you sure you want to delete all OITH infrastructure? (y/N) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Deleting Step Functions stack..."
        aws cloudformation delete-stack --stack-name "${STACK_PREFIX}-stepfunctions" --region $REGION 2>/dev/null || true
        
        log_info "Deleting infrastructure stack..."
        aws cloudformation delete-stack --stack-name "${STACK_PREFIX}-infrastructure" --region $REGION 2>/dev/null || true
        
        log_info "Waiting for deletion..."
        aws cloudformation wait stack-delete-complete --stack-name "${STACK_PREFIX}-stepfunctions" --region $REGION 2>/dev/null || true
        aws cloudformation wait stack-delete-complete --stack-name "${STACK_PREFIX}-infrastructure" --region $REGION 2>/dev/null || true
        
        log_success "Cleanup completed"
    else
        log_info "Cleanup cancelled"
    fi
}

# ==========================================
# SCRIPT ENTRY POINT
# ==========================================

case "${2:-deploy}" in
    deploy)
        main
        ;;
    cleanup)
        cleanup
        ;;
    *)
        echo "Usage: $0 <environment> [deploy|cleanup]"
        echo ""
        echo "Environments: development, staging, production"
        echo ""
        echo "Examples:"
        echo "  $0 production deploy    # Deploy to production"
        echo "  $0 staging deploy       # Deploy to staging"
        echo "  $0 production cleanup   # Delete production infrastructure"
        exit 1
        ;;
esac

