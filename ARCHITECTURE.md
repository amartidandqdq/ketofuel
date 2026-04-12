# ARCHITECTURE.md — Graphe du Projet

> Mise a jour : 2026-04-12

## Vue d'ensemble

```
Browser (vanilla JS)
    │
    ├── static/app.js      ← Toute la logique frontend
    ├── static/style.css    ← Themes + responsive
    └── templates/index.html ← SPA structure
         │
         │ fetch('/api/*')
         ▼
    FastAPI (main.py)
    ├── SecurityHeadersMiddleware
    ├── CORSMiddleware
    │
    ├── Routes CRUD ──────► storage.py ──► data/*.json
    ├── Routes IA ────────► ai_client.py ──► OpenAI API
    ├── Routes ketosis ───► keto_data.py (constantes)
    └── config.py (.env)
```

## Fichiers et Responsabilites

| Fichier | Lignes | Role | Depend de |
|---------|--------|------|-----------|
| `main.py` | 788 | Routes FastAPI, TDEE, ketosis logic | config, models, ai_client, storage, keto_data |
| `keto_data.py` | 188 | Constantes: timelines, tips, accelerators, exercise types | *(aucun)* |
| `ai_client.py` | 325 | Prompts OpenAI (meal plan, recipes, analysis, scan, flu) | config |
| `storage.py` | 250 | CRUD JSON (profile, meals, weights, daily logs, plans) | config, models |
| `models.py` | 116 | Pydantic models (UserProfile, MealLog, DailyLog, etc.) | *(aucun)* |
| `config.py` | 13 | Variables d'environnement | .env |
| `static/app.js` | 1856 | Frontend: navigation, API calls, rendering, charts | *(aucun)* |
| `static/style.css` | 1394 | CSS: dark/light themes, responsive, all components | *(aucun)* |
| `templates/index.html` | 584 | HTML structure: 4 tabs, forms, modals | *(aucun)* |

## Flux de Donnees

```
Profil utilisateur:
  Settings form → POST /api/profile → storage.py → data/profile.json

Meal logging:
  Log form → POST /api/meals → storage.py → data/meals.json
       ↘ AI Analyze → POST /api/analyze → ai_client.py → OpenAI

Ketosis tracking:
  loadDashboard() → GET /api/ketosis → main.py reads:
    ├── profile (diet_type, keto_start_date, fasting_hours)
    ├── meals (bulk stats for carb compliance)
    ├── daily_logs (exercise bonus)
    └── keto_data.py (diet-specific thresholds)

Exercise impact:
  Exercise button → POST /api/log-exercise → daily_logs.json
    → reduces adapted_day target (doesn't skip phases)
```

## Points d'Entree

| Contexte | Commande |
|----------|----------|
| Dev local | `source .venv/bin/activate && python main.py` → http://localhost:8001 |
| Docker | `docker compose up` → http://localhost:8001 |
| Health check | `GET /api/health` |

## Effets de Bord

| Action | Effet |
|--------|-------|
| `selectKetoPreset()` | Auto-save settings + reload dashboard |
| `logMeal()` | Refresh meals list + dashboard stats |
| `logExercise()` | Refresh ketosis tracker (timeline recalculated) |
| `saveSettings()` | Reload settings + dashboard (may change diet timeline) |
| `_patch_daily_log()` | Read-modify-write on daily_logs.json (preserves all fields) |
