# OITH Match Diagnostic Script
# This script activates all profiles and diagnoses why two users aren't matching

$API_URL = "https://emeapbgbui.execute-api.us-east-1.amazonaws.com"

# The two users to diagnose
$User1 = "skywave2359@proton.me"
$User2 = "pizza@pizza.com"

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  OITH MATCH DIAGNOSTIC" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Activate all profiles
Write-Host "Step 1: Activating all profiles..." -ForegroundColor Yellow
Write-Host ""

try {
    $activateResponse = Invoke-RestMethod -Uri "$API_URL/api/match/activate-all" `
        -Method POST `
        -ContentType "application/json" `
        -Body "{}"
    
    Write-Host "  SUCCESS: $($activateResponse.message)" -ForegroundColor Green
    Write-Host "  Activated: $($activateResponse.activated) / $($activateResponse.total) profiles" -ForegroundColor Green
    if ($activateResponse.errors) {
        Write-Host "  Errors: $($activateResponse.errors.Count)" -ForegroundColor Red
    }
} catch {
    Write-Host "  ERROR activating profiles: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Note: You may need to deploy the updated Lambda first" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "----------------------------------------------------------------------" -ForegroundColor Gray
Write-Host ""

# Step 2: Diagnose the match
Write-Host "Step 2: Diagnosing match between:" -ForegroundColor Yellow
Write-Host "        User 1: $User1" -ForegroundColor White
Write-Host "        User 2: $User2" -ForegroundColor White
Write-Host ""

try {
    $diagnoseBody = @{
        userEmail1 = $User1
        userEmail2 = $User2
    } | ConvertTo-Json

    $diagnoseResponse = Invoke-RestMethod -Uri "$API_URL/api/match/diagnose" `
        -Method POST `
        -ContentType "application/json" `
        -Body $diagnoseBody
    
    # Display results
    Write-Host ""
    Write-Host "USER 1: $($diagnoseResponse.user1.profile.firstName) ($User1)" -ForegroundColor Cyan
    Write-Host "  Gender: $($diagnoseResponse.user1.profile.gender)"
    Write-Host "  Age: $($diagnoseResponse.user1.profile.age)"
    Write-Host "  Location: $($diagnoseResponse.user1.profile.location)"
    Write-Host "  isVisible: $($diagnoseResponse.user1.profile.isVisible)"
    Write-Host "  lastSeen: $($diagnoseResponse.user1.profile.lastSeen)"
    Write-Host "  Preferences: interestedIn=$($diagnoseResponse.user1.profile.matchPreferences.interestedIn), age=$($diagnoseResponse.user1.profile.matchPreferences.ageMin)-$($diagnoseResponse.user1.profile.matchPreferences.ageMax)"
    
    Write-Host ""
    Write-Host "USER 2: $($diagnoseResponse.user2.profile.firstName) ($User2)" -ForegroundColor Cyan
    Write-Host "  Gender: $($diagnoseResponse.user2.profile.gender)"
    Write-Host "  Age: $($diagnoseResponse.user2.profile.age)"
    Write-Host "  Location: $($diagnoseResponse.user2.profile.location)"
    Write-Host "  isVisible: $($diagnoseResponse.user2.profile.isVisible)"
    Write-Host "  lastSeen: $($diagnoseResponse.user2.profile.lastSeen)"
    Write-Host "  Preferences: interestedIn=$($diagnoseResponse.user2.profile.matchPreferences.interestedIn), age=$($diagnoseResponse.user2.profile.matchPreferences.ageMin)-$($diagnoseResponse.user2.profile.matchPreferences.ageMax)"
    
    Write-Host ""
    Write-Host "ISSUES FOUND:" -ForegroundColor Yellow
    foreach ($issue in $diagnoseResponse.issues) {
        if ($issue.type -eq "PREFERENCE_MATCH") {
            Write-Host "  [OK] $($issue.message)" -ForegroundColor Green
        } elseif ($issue.type -eq "PREFERENCE_MISMATCH") {
            Write-Host "  [FAIL] $($issue.message)" -ForegroundColor Red
            Write-Host "         Reason: $($issue.reason)" -ForegroundColor Red
        } else {
            $color = if ($issue.type -like "*MISMATCH*" -or $issue.type -eq "BLOCKED" -or $issue.type -eq "VISIBILITY") { "Red" } else { "Yellow" }
            Write-Host "  [$($issue.type)] $($issue.message)" -ForegroundColor $color
        }
    }
    
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Cyan
    if ($diagnoseResponse.canMatch) {
        Write-Host "  RESULT: These users CAN match!" -ForegroundColor Green
    } else {
        Write-Host "  RESULT: These users CANNOT match" -ForegroundColor Red
        Write-Host "  Fix the issues above to enable matching" -ForegroundColor Yellow
    }
    Write-Host "======================================================================" -ForegroundColor Cyan
    
} catch {
    Write-Host "  ERROR diagnosing match: $($_.Exception.Message)" -ForegroundColor Red
    
    # Try to get more details
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "  Response: $responseBody" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "  Note: You may need to deploy the updated Lambda with the diagnose endpoint" -ForegroundColor Yellow
    Write-Host "  Run: cd lambda && ./deploy.ps1" -ForegroundColor Yellow
}

Write-Host ""

