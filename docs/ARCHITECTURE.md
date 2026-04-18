# Architecture — KetoFuel

> Lu par Claude uniquement lors de refactoring ou ajout de module.

## Stack

| Techno | Role | Fichier principal |
|--------|------|-------------------|
| Python 3.9+ / FastAPI | Backend API | `main.py` → `routes/` |
| Pydantic + Field | Validation requetes/reponses | `models.py` |
| SlowAPI | Rate limiting endpoints AI | `routes/ai.py` |
| Google Gemini (google-genai) | AI (plans, recettes, analyse, vision) | `ai_client.py` |
| Vanilla JS (ES modules) | Frontend | `static/app.js` → `static/modules/` |
| CSS custom properties | Themes dark/light, responsive | `static/style.css` |
| JSON files | Storage (pas de DB) | `storage.py` → `data/*.json` |

## Structure fichiers

```
main.py              → Entry point, middleware, mount routers
routes/              → 9 APIRouter modules
  profile.py, ai.py, meals.py, tracking.py, weight.py,
  ketosis.py, dashboard.py, openfoodfacts.py, data.py
models.py            → Pydantic models (UserProfile, MealLog, DailyLog, Exercise...)
storage.py           → JSON file CRUD (atomic write, corrupt recovery)
config.py            → Variables d'environnement
errors.py            → Codes d'erreur standardises
ai_client.py         → Prompts Gemini (meal plan, recipes, analysis, label scan, keto flu)
keto_data.py         → Timelines cetose, tips, accelerateurs, 6 types exercice
keto_foods.json      → 55 aliments keto francais (CIQUAL)
logger.py            → Logger JSON structure avec rotation 5MB
static/app.js        → Entry point ES modules
static/modules/      → 10 modules: core, fasting, dashboard, meals, weight,
                       trackers, food, ketosis, settings, progress
static/style.css     → CSS complet avec themes
templates/index.html → SPA: hero grid, 4 onglets, modals
tests/               → pytest (unit) + playwright (E2E)
```

## Flux de donnees

```
Browser → FastAPI routes → Storage (JSON files)
                        → AIClient (Gemini API)
                        → keto_data.py (constantes domaine)
```

## Known Issues

| Issue | Severite | Notes |
|-------|----------|-------|
| Race conditions storage | Medium | Read-modify-write non-atomique. OK single user. |
| dashboard.py >200 lignes | Low | 256 lignes — endpoints agreges, difficile a splitter. |
| API key en clair | Low | Cle Gemini dans `data/profile.json`. Pas chiffree. |
| SW cache agressif | Low | Bumper `CACHE_NAME` dans service-worker.js apres changements JS. |

## Warnings

- `Storage` instancie separement dans chaque module route — pas un singleton.
- `keto_foods.json` charge au import — ajout de foods necessite restart.
- Exercise bonus cap 3.0/jour. HIIT/weights max 1/jour, swim max 2/jour, walk max 3/jour.
- CSP requiert `unsafe-inline` pour scripts (onclick handlers).
- Python 3.9 genere `FutureWarning` de google-auth/google-genai.
