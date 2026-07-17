# Prove IT Catalysts — Project & Financial Tracker

Full-stack project & financial tracking app: FastAPI + MongoDB backend, React + Vite frontend.

## Layout

```
prove_it_backend/prove_it_backend/    FastAPI backend (see its README for setup/env vars)
prove_it_frontend/prove_it_frontend/  React + Vite frontend
start-dev.ps1                         Launches both dev servers in separate windows (Windows/PowerShell)
```

## Running locally

Either use `start-dev.ps1` (opens two PowerShell windows, one per server — **note it hardcodes
absolute paths under `C:\PR-Tracker\...`; update them first if you've cloned this elsewhere**),
or run each side manually:

```bash
# Backend — from prove_it_backend/prove_it_backend/
pip install -r requirements.txt
cp .env.example .env   # then fill in real values
uvicorn main:app --reload --port 8000

# Frontend — from prove_it_frontend/prove_it_frontend/
npm install
npm run dev
```

See `prove_it_backend/prove_it_backend/README.md` for backend env vars, default (dev-only)
credentials, and API endpoint reference.
