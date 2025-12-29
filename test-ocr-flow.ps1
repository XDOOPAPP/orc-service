#!/usr/bin/env pwsh
# OCR Service Test Script

Write-Host "🧪 Testing OCR Service Flow" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

$BASE_URL = "http://localhost:3000/api/v1"

# Step 1: Login
Write-Host "Step 1: Login to get JWT token..." -ForegroundColor Yellow
$loginResponse = Invoke-RestMethod -Uri "$BASE_URL/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body '{"email":"admin@fepa.com","password":"admin123"}' `
    -ErrorAction Stop

$token = $loginResponse.access_token
Write-Host "✅ Login successful! Token: $($token.Substring(0,20))..." -ForegroundColor Green
Write-Host ""

# Step 2: Create OCR Job
Write-Host "Step 2: Creating OCR job..." -ForegroundColor Yellow
$scanBody = @{
    fileUrl = "https://via.placeholder.com/600x800/FFFFFF/000000?text=RECEIPT%0ATotal:%2050000%20VND%0ADate:%2029/12/2024"
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

try {
    $ocrJob = Invoke-RestMethod -Uri "$BASE_URL/ocr/scan" `
        -Method POST `
        -Headers $headers `
        -Body $scanBody `
        -ErrorAction Stop

    $jobId = $ocrJob.id
    Write-Host "✅ OCR Job created!" -ForegroundColor Green
    Write-Host "   Job ID: $jobId" -ForegroundColor Gray
    Write-Host "   Status: $($ocrJob.status)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "❌ Failed to create OCR job: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 3: Wait and check job status
Write-Host "Step 3: Waiting for OCR processing..." -ForegroundColor Yellow
$maxAttempts = 10
$attempt = 0
$completed = $false

while ($attempt -lt $maxAttempts -and -not $completed) {
    Start-Sleep -Seconds 3
    $attempt++
    
    try {
        $jobStatus = Invoke-RestMethod -Uri "$BASE_URL/ocr/jobs/$jobId" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        Write-Host "   Attempt $attempt/$maxAttempts - Status: $($jobStatus.status)" -ForegroundColor Gray
        
        if ($jobStatus.status -eq "completed") {
            $completed = $true
            Write-Host "✅ OCR processing completed!" -ForegroundColor Green
            Write-Host "   Confidence: $($jobStatus.resultJson.confidence)%" -ForegroundColor Gray
            Write-Host "   Raw Text: $($jobStatus.resultJson.rawText)" -ForegroundColor Gray
            Write-Host ""
        } elseif ($jobStatus.status -eq "failed") {
            Write-Host "❌ OCR processing failed!" -ForegroundColor Red
            Write-Host "   Error: $($jobStatus.errorMessage)" -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host "   ⚠️  Error checking status: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

if (-not $completed) {
    Write-Host "⏱️  Timeout waiting for OCR completion" -ForegroundColor Yellow
    Write-Host ""
}

# Step 4: Check OCR history
Write-Host "Step 4: Fetching OCR job history..." -ForegroundColor Yellow
try {
    $history = Invoke-RestMethod -Uri "$BASE_URL/ocr/jobs?limit=5" `
        -Method GET `
        -Headers $headers `
        -ErrorAction Stop
    
    Write-Host "✅ Found $($history.meta.total) total OCR jobs" -ForegroundColor Green
    Write-Host "   Showing latest $($history.data.Count) jobs:" -ForegroundColor Gray
    
    foreach ($job in $history.data) {
        Write-Host "   - $($job.id) | Status: $($job.status) | Created: $($job.createdAt)" -ForegroundColor Gray
    }
    Write-Host ""
} catch {
    Write-Host "❌ Failed to fetch history: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 5: Check if expense was created
Write-Host "Step 5: Checking if expense was auto-created..." -ForegroundColor Yellow
try {
    $expenses = Invoke-RestMethod -Uri "$BASE_URL/expenses?limit=10" `
        -Method GET `
        -Headers $headers `
        -ErrorAction Stop
    
    $ocrExpenses = $expenses.data | Where-Object { $_.isFromOcr -eq $true }
    
    if ($ocrExpenses.Count -gt 0) {
        Write-Host "✅ Found $($ocrExpenses.Count) expenses created from OCR!" -ForegroundColor Green
        
        foreach ($expense in $ocrExpenses | Select-Object -First 3) {
            Write-Host "   - Amount: $($expense.amount) | Description: $($expense.description)" -ForegroundColor Gray
            Write-Host "     OCR Job ID: $($expense.ocrJobId) | Confidence: $($expense.ocrConfidence)%" -ForegroundColor Gray
        }
    } else {
        Write-Host "⚠️  No expenses created from OCR yet" -ForegroundColor Yellow
    }
    Write-Host ""
} catch {
    Write-Host "❌ Failed to fetch expenses: $($_.Exception.Message)" -ForegroundColor Red
}

# Summary
Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "🎉 Test completed!" -ForegroundColor Cyan
Write-Host "`nNext steps:" -ForegroundColor White
Write-Host "1. Check logs: docker-compose logs -f ocr-service" -ForegroundColor Gray
Write-Host "2. View Swagger docs: http://localhost:3000/docs" -ForegroundColor Gray
Write-Host "3. RabbitMQ UI: http://localhost:15672 (fepa/fepa123)" -ForegroundColor Gray
Write-Host ""
