# ============================================================================
# Trigger AI Multi-Agent Workflow
# ============================================================================

$user_prompt = "Erzeuge eine kleine 'Hello, World' Anwendung mit Node.js und Express.js. 

Es soll eine API haben, die einen GET Request entgegennimmt und 'Hello, World' zurückgibt."
$additional_context = ""

# ----------------------------------------------------------------------------
$body = @{
    user_prompt = $user_prompt
    additional_context = $additional_context
} | ConvertTo-Json -Depth 5 -Compress

Write-Host "🚀 Sending request to AI Orchestrator..." -ForegroundColor Cyan

Invoke-RestMethod -Uri "http://localhost:3000/api/v1/projects/generate" `
                  -Method Post `
                  -Headers @{ "Content-Type" = "application/json; charset=utf-8" } `
                  -Body $body

Write-Host "✅ Request dispatched successfully to the Multi-Agent stack." -ForegroundColor Green
