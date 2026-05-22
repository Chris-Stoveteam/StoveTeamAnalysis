# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KPT (Kitchen Performance Test) analysis tool for stove team field data. Accepts CSV uploads and performs statistical analysis to evaluate stove efficiency — sample size adequacy, confidence intervals, and before/after significance testing.

## Architecture

Two separate runtimes that work together:

**Frontend** (`my-react-app/src/`) — React 19 + Vite SPA. All UI logic lives in `App.jsx` (single large component file). `API_BASE` is set to `http://localhost:8000` in dev and empty string in production (Vercel serves both from the same origin).

**Backend** (`my-react-app/api/index.py`) — FastAPI. Two endpoints:
- `POST /api/single-analysis` — sample size and confidence interval analysis for one CSV
- `POST /api/comparison-analysis` — baseline vs. new-stove comparison with t-test significance

**Standalone CLI** (`DataVerification.py`) — Python script (also compiled to `.exe`) that runs the same statistical logic locally without the web UI.

**Deployment** — Vercel, configured via `.github/workflows/vercel-deploy.yml`. The `api/` directory is served as serverless Python functions alongside the static React build.

## Development Commands

All frontend commands run from `my-react-app/`:

```bash
npm run dev        # Start Vite dev server (http://localhost:5173)
npm run build      # Production build
npm run lint       # ESLint
npm run preview    # Preview production build locally
```

Backend (also from `my-react-app/`):

```bash
pip install -r api/requirements.txt
uvicorn api.index:app --reload --port 8000
```

For local full-stack development, run both the Vite dev server and uvicorn simultaneously. The frontend proxies API calls to `localhost:8000` in dev mode.

## Key Conventions

- CSV column `Dry_Wood_Per_Cap` is the default target column; the UI auto-detects available columns from uploaded file headers.
- Statistical functions (`calculate_kpt_sample_size`, `calculate_kpt_confidence`, `calculate_change`, `test_significance`) are standalone pure functions in `api/index.py` — keep them free of FastAPI dependencies.
- The frontend has no router — mode switching (single vs. comparison analysis) is handled with a `mode` state variable in `App.jsx`.
