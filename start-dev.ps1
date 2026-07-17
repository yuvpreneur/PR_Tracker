$backend  = "C:\PR-Tracker\prove_it_tracker\prove_it_tracker\prove_it_backend\prove_it_backend"
$frontend = "C:\PR-Tracker\prove_it_tracker\prove_it_tracker\prove_it_frontend\prove_it_frontend"

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backend'; .\.venv\Scripts\Activate.ps1; uvicorn main:app --reload --host 127.0.0.1 --port 8000"

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontend'; npm run dev"

Write-Host "Backend starting on http://127.0.0.1:8000"
Write-Host "Frontend starting on http://localhost:5173"
