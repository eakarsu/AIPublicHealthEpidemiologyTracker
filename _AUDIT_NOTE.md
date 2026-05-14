# Audit Note — AIPublicHealthEpidemiologyTracker

Source: `/Users/erolakarsu/projects/_AUDIT/reports/batch_07.md` section #5.

## Original Recommendations
TSV said `0 AI endpoints`. **Wrong on inspection** — 13 routes already use `queryAI` from `aiHelper.js`:

- `outbreaks.js`: `/:id/ai-analyze`, `/ai/predict-spread`
- `healthEquity.js`: `/:id/ai-analyze`, `/ai/disparity-analysis`
- `surveillance.js`: `/:id/ai-analyze`, `/ai/early-warning`
- Plus AI in: `hospitalCapacity.js`, `waterQuality.js`, `vectorDiseases.js`, `airQuality.js`, etc.

### Audit-listed Critical Gaps
- `/outbreak-prediction` — already exists as `/outbreaks/ai/predict-spread`
- `/equity-gap-analysis` — already exists as `/health-equity/ai/disparity-analysis`
- `/intervention-recommendation` (added)
- `/case-clustering` (added)
- `/vaccination-coverage-forecast`
- `/resource-allocation`

## Implemented (Mechanical)
- `POST /api/syndromic-surveillance/ai/case-clustering` — added in `backend/routes/surveillance.js`. Pulls window of surveillance reports (optionally filtered by region), returns ranked clusters with suspicion scores and recommended responses. Persists via `persistAI`.
- `POST /api/outbreaks/:id/ai-intervention` — added in `backend/routes/outbreaks.js`. Returns evidence-ranked interventions with feasibility, equity, cost tier, monitoring metrics. Persists via `persistAI`.

Both follow existing `queryAI`/`auth`/`aiRateLimiter`/`persistAI` style.

## Backlog (deferred)

### NEEDS-CREDS / NEW-DEPS
- CDC/state health-department API integration.
- Real-time outbreak/map UI (frontend scope).
- Pharmacy OTC sales feeds for syndromic surveillance.
- Sequencing data ingestion (variant tracking).

### NEEDS-PRODUCT-DECISION
- Case line-list dedup model.
- Multi-language outbreak messaging (LLM-generated, but governance unclear).
- Zoonotic spillover risk model — needs animal-disease feed.

### TOO-RISKY
- Real-time nowcast model (proper time-series, not LLM-prompt).
- Auto-issuance of public health communications.

## Apply pass 3 (frontend)

Action: **LEFT-AS-IS** — frontend already wired.

- `frontend/src/pages/CaseClustering.jsx` POSTs to `/api/syndromic-surveillance/ai/case-clustering` (apply2 addition).
- `frontend/src/pages/OutbreakIntervention.jsx` POSTs to `/api/outbreaks/:id/ai-intervention` (apply2 addition); selects outbreak from `/api/outbreaks` list.
- Both use JWT Bearer header from `localStorage`. No FE changes made. Log: `_AUDIT/apply3_logs/ab3_56.md`.

## Apply pass 4 (mechanical backlog)

Action: **LEFT-AS-IS** — both audit-listed MECHANICAL gaps already implemented.

Verified existing implementations:
- `POST /api/ai-center/resource-allocation` in `backend/routes/aiCenter.js` (hospitals + active outbreaks + active vaccinations -> allocation recommendations; uses `queryAI` + `persistAI`).
- `POST /api/ai-center/vaccination-coverage-forecast` in `backend/routes/aiCenter.js` (region-filtered vaccinations + outbreak/hospital context -> per-vaccine trajectories + at-risk programs; 503-on-no-key via `aiErrorStatus()`).
- FE: `frontend/src/pages/AICenter.jsx` exposes both keys (`resource-allocation`, `vaccination-coverage-forecast`); JWT bearer from localStorage.

Remaining backlog deferred per audit note (NEEDS-CREDS data feeds, NEEDS-PRODUCT-DECISION, TOO-RISKY auto-issuance). `node --check backend/routes/aiCenter.js` PASS. Log: `_AUDIT/apply4_logs/ab3_56.md`.
