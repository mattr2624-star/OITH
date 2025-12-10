# ============================================
# OITH Scaling Infrastructure Deployment Script
# ============================================
# Run this script in PowerShell to create deployment packages

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  OITH Scaling Infrastructure Deployment" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Create deployment folder
$deployFolder = ".\deploy-packages"
if (Test-Path $deployFolder) {
    Remove-Item $deployFolder -Recurse -Force
}
New-Item -ItemType Directory -Path $deployFolder | Out-Null

Write-Host "📦 Creating deployment packages..." -ForegroundColor Yellow
Write-Host ""

# Package 1: Matching Service
Write-Host "1. Packaging matchingService.mjs..." -ForegroundColor Green
Compress-Archive -Path "matchingService.mjs" -DestinationPath "$deployFolder\matchingService.zip" -Force
Write-Host "   ✅ Created: deploy-packages\matchingService.zip" -ForegroundColor Gray

# Package 2: Image Service  
Write-Host "2. Packaging imageService.mjs..." -ForegroundColor Green
Compress-Archive -Path "imageService.mjs" -DestinationPath "$deployFolder\imageService.zip" -Force
Write-Host "   ✅ Created: deploy-packages\imageService.zip" -ForegroundColor Gray

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Deployment packages ready!" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Go to AWS Lambda Console" -ForegroundColor White
Write-Host "   https://console.aws.amazon.com/lambda" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Create 'oith-matching-service' Lambda:" -ForegroundColor White
Write-Host "   - Runtime: Node.js 18.x" -ForegroundColor Gray
Write-Host "   - Upload: deploy-packages\matchingService.zip" -ForegroundColor Gray
Write-Host "   - Handler: matchingService.handler" -ForegroundColor Gray
Write-Host "   - Timeout: 30 seconds" -ForegroundColor Gray
Write-Host "   - Memory: 512 MB" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Create 'oith-image-service' Lambda:" -ForegroundColor White
Write-Host "   - Runtime: Node.js 18.x" -ForegroundColor Gray
Write-Host "   - Upload: deploy-packages\imageService.zip" -ForegroundColor Gray
Write-Host "   - Handler: imageService.handler" -ForegroundColor Gray
Write-Host "   - Timeout: 30 seconds" -ForegroundColor Gray
Write-Host "   - Memory: 256 MB" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Add Lambda permissions for DynamoDB and S3" -ForegroundColor White
Write-Host ""
Write-Host "5. Create API Gateway routes" -ForegroundColor White
Write-Host ""

# Show folder location
$fullPath = (Get-Item $deployFolder).FullName
Write-Host "📁 Packages saved to: $fullPath" -ForegroundColor Cyan

