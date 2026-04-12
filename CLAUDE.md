# CLAUDE.md — OS du Projet KetoFuel

> Lu par l'IA en premier a chaque session. Maintenu par l'IA.

## Mode Autonome

Le proprietaire donne des objectifs en langage naturel.
Claude prend toutes les decisions techniques seul.

**"continue"** → Lire TASKS.md, prendre la prochaine tache, executer.
**Tache libre** → Decomposer, executer, resumer a la fin.

## Protocole de Session

### Debut
1. Lire : INTENT.md → TASKS.md → AUDIT.md (3 fichiers, 3 lignes de resume)
2. Verifier `logs/diagnostic.log` si probleme signale

### Fin (obligatoire)
1. Mettre a jour TASKS.md
2. Ajouter entree CHANGELOG.md
3. `git add -A && git commit -m "[type]: [resume]"`
4. Lister les warnings pour le proprietaire

## Logs — Source de Verite

```bash
# Erreurs recentes
grep '"level":"error"' logs/diagnostic.log | tail -10

# Entrees d'une fonction
grep '\[INPUT\].*nomFonction' logs/diagnostic.log | tail -5
```

**Jamais de correction sans consulter les logs.**

## Regles d'Architecture

1. Fichiers < 200 lignes (sauf app.js, style.css — acceptes car vanilla JS sans build)
2. Zero valeur hardcodee hors `config.py` / `.env`
3. Zero import circulaire
4. Commentaire `# POURQUOI:` sur chaque decision non evidente
5. Bug corrige = test de non-regression

## Interdit

- Nouvelle techno non listee dans INTENT.md
- `git reset --hard` sans confirmation
- Modifier plusieurs fichiers sans commit intermediaire
- Terminer sans TASKS.md + CHANGELOG.md a jour

---

## Status

**App is functional + hardened.** Two code reviews completed (17 + 8 fixes). Zero console errors, zero failed requests. Needs OpenAI API key for AI features.

Run: `source .venv/bin/activate && python main.py` → http://localhost:8001
Docker: `docker compose up` → http://localhost:8001

## Stack & Points d'Entree

| Techno | Role | Fichier |
|--------|------|---------|
| Python 3.9+ / FastAPI | Backend API | `main.py` (54 lines) + `routes/` (7 modules) |
| Pydantic | Request/response validation | `models.py` (116 lines) |
| OpenAI API (async) | AI features (meal plans, recipes, analysis) | `ai_client.py` (325 lines) |
| Vanilla JS (ES modules) | Frontend logic | `static/app.js` (104 lines) + `static/modules/` (10 modules) |
| CSS custom properties | Dark/light themes, responsive | `static/style.css` (1394 lines) |
| JSON files | Storage (no database) | `storage.py` → `data/*.json` |
| Keto domain data | Timelines, tips, accelerators | `keto_data.py` (188 lines) |

## Structure

| Path | Purpose |
|------|---------|
| `main.py` | Entry point: app setup, middleware, mount routers (54 lines) |
| `routes/` | 7 APIRouter modules: profile, ai, meals, tracking, weight, ketosis, dashboard |
| `keto_data.py` | Diet-specific ketosis timelines, speed tips, accelerators, exercise types |
| `ai_client.py` | All OpenAI prompts (meal plan, recipes, analysis, label scan, keto flu) |
| `models.py` | Pydantic models (UserProfile, MealLog, DailyLog, Exercise, etc.) |
| `storage.py` | JSON file CRUD (meals, weights, daily logs, groceries, plans) |
| `config.py` | Environment variables (OPENAI_API_KEY, APP_HOST, CORS_ORIGINS) |
| `keto_foods.json` | 50-item keto food database |
| `static/app.js` | ES module entry point — imports all modules, assigns to window, init |
| `static/modules/` | 10 ES modules: core, fasting, dashboard, meals, weight, trackers, food, ketosis, settings, progress |
| `static/style.css` | Full CSS with dark/light themes, responsive, hub layout |
| `templates/index.html` | Single-page app: hero grid, 4 tabs, modals |
| `static/manifest.json` | PWA manifest |
| `static/service-worker.js` | Offline caching (cache-first static, network-only API) |
| `Dockerfile` | Python 3.12-slim, exposes 8001 |
| `docker-compose.yml` | Single service, mounts `data/`, healthcheck `/api/health` |
| `data/` | Runtime JSON storage (gitignored) |
| `logs/` | Structured diagnostic logs (gitignored) |

## Governance Files

| Fichier | Role |
|---------|------|
| `CLAUDE.md` | OS du projet — lu en premier (ce fichier) |
| `INTENT.md` | Vision, contraintes, stack autorisee (proprietaire) |
| `TASKS.md` | Etat actuel, taches, memoire inter-sessions |
| `CHANGELOG.md` | Historique des modifications |
| `AUDIT.md` | Etat technique, dette, hypotheses |
| `ARCHITECTURE.md` | Graphe, dependances, flux de donnees |

## Features

| Tab | Features |
|-----|----------|
| **Today** | Ketosis journey (diet-specific 5-phase tracker + exercise accelerators), fasting timer, exercise logger (walk/fat fast/espresso with ketosis impact), streak, water tracker (target 3L), electrolytes (Na/K/Mg with daily targets), keto flu checker (AI), macro donut chart, weekly summary, meal timing heatmap, macro progress bars with ketosis zone, meal log + AI analyze, nutrition label scanner, favorites quick re-log |
| **Meals** | Sub-tabs: Planner (AI), Recipes (AI), Food DB (50 foods), Favorites |
| **Progress** | Achievements (15 badges), body composition (BMI/BF%/lean mass), weight log + SVG chart + AI insight, deficit slider, meal history with pagination + undo delete |
| **Settings** | 6 keto presets (Carnivore→Keto Lite, auto-save), body stats, TDEE, macros, IF presets, keto start date, preferences, API key |

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| `storeData()`/`getData()` in app.js | XSS prevention — data in JS map, only string IDs in HTML onclick |
| `KETO_DIET_TYPES` set in ai_client.py | 7 keto variants get keto-specific AI prompts (was only 2) |
| `numVal()` helper in saveSettings | Prevents falsy-zero bugs (carb_ratio=0 for carnivore was becoming 5) |
| `_patch_daily_log()` helper | DRY read-modify-write for daily logs, preserves all fields |
| Exercise reduces adapted_day target | Exercise accelerates timeline but doesn't skip biological phases |
| Fasting protocol scales thresholds | 20h+ = 30% faster, 16h+ = 15% faster (applied to all diet types) |
| Diet-specific ketosis timelines | 6 timelines: carnivore 7d, ultra/strict 10d, keto OMAD 10d, standard 14d, lazy 21d, lite 28d |
| keto_data.py extraction | Domain constants separated from routes (main.py 1030→788 lines) |
| Hub dashboard layout | Hero grid replaces 10+ stacked cards, less scrolling |
| Toast stacking + undo | Toasts stack vertically, delete shows 5s undo toast |

## Patterns

- **AI prompt pattern:** f-string with `is_keto = diet_type in KETO_DIET_TYPES` for role, rules, closing.
- **XSS-safe onclick:** `storeData(obj)` → ID → `onclick="fn('${id}')"` → `getData(id)`.
- **Falsy-zero safe:** Use `?? default` in JS (not `|| default`) for values that can be 0.
- **Dashboard refresh chain:** `logMeal()` → `loadMeals()` + `loadDashboard()`. Same for `saveSettings()`.
- **Bulk stats:** `get_bulk_daily_stats(dates)` — single file read, grouped by date.
- **API key safety:** Frontend deletes key before POST. Server preserves existing if empty.
- **innerHTML escaping:** All server strings → `esc()`. No exceptions.
- **Daily log updates:** Always use `_patch_daily_log()` — never reconstruct DailyLog manually.

## Session 2026-04-12 — Status

- **Commit** `940d2d4` — 33 files, +4831 -412 lines
- **2 code reviews** completed (17 + 8 fixes applied)
- **main.py split** into 7 APIRouter modules (793→54 lines entry point)
- **Governance** installed: INTENT.md, TASKS.md, CHANGELOG.md, AUDIT.md, ARCHITECTURE.md
- **DB reset** during session (user requested). Profile set to Carnivore + 23h OMAD.

## Warnings for Future Sessions

- `app.js` split into 10 ES modules. Each module <320 lines. Entry point is 104 lines.
- `Storage` class instantiated separately in each route module — not a singleton. Fine for JSON files but would be a problem with a real DB.
- `keto_foods.json` loaded at import time in `routes/meals.py` — adding foods requires server restart.
- Exercise bonus capped at 2.0/day. Walk max 3/day, fat_fast max 1/day.

## Known Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| Tests: backend only | Medium | 47 pytest tests for all routes. No frontend tests yet. |
| Storage race conditions | Medium | Non-atomic JSON read-modify-write. OK for single user. |
| app.js modules | Low | Split into 10 ES modules. Each <320 lines. No build step needed. |
| API key in plaintext | Low | OpenAI key in `data/profile.json`. Not encrypted. |
| No magic bytes on uploads | Low | MIME validated, content not verified. |

## Next Steps

1. **Frontend tests** — Playwright or similar for end-to-end testing
2. **Muscle preservation** — protein/kg lean mass tracking, alerts if protein too low
3. **More exercises** — add HIIT, weight training, swimming to tracker

## Glossaire Metier

| Terme | Definition |
|-------|------------|
| Net carbs | Total carbs - fiber. Key keto metric. |
| OMAD | One Meal A Day — all nutrition in a single meal |
| Fat adapted | Body efficiently burns fat as primary fuel (2-4 weeks) |
| Gluconeogenesis | Excess protein converted to glucose — slows ketosis |
| TDEE | Total Daily Energy Expenditure (Mifflin-St Jeor formula) |
| Keto flu | Transition symptoms (headache, fatigue) — usually electrolyte deficiency |

<!-- autoskills:start -->

Summary generated by `autoskills`. Check the full files inside `.claude/skills`.

## Accessibility (a11y)

Audit and improve web accessibility following WCAG 2.2 guidelines. Use when asked to "improve accessibility", "a11y audit", "WCAG compliance", "screen reader support", "keyboard navigation", or "make accessible".

- `.claude/skills/accessibility/SKILL.md`
- `.claude/skills/accessibility/references/A11Y-PATTERNS.md`: Practical, copy-paste-ready patterns for common accessibility requirements. Each pattern is self-contained and linked from the main [SKILL.md](../SKILL.md).
- `.claude/skills/accessibility/references/WCAG.md`

## FastAPI Python

Expert in FastAPI Python development with best practices for APIs and async operations

- `.claude/skills/fastapi-python/SKILL.md`

## FastAPI Project Templates

Create production-ready FastAPI projects with async patterns, dependency injection, and comprehensive error handling. Use when building new FastAPI applications or setting up backend API projects.

- `.claude/skills/fastapi-templates/SKILL.md`

## Design Thinking

Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beaut...

- `.claude/skills/frontend-design/SKILL.md`

## Python Code Executor

Execute Python code in a safe sandboxed environment via [inference.sh](https://inference.sh). Pre-installed: NumPy, Pandas, Matplotlib, requests, BeautifulSoup, Selenium, Playwright, MoviePy, Pillow, OpenCV, trimesh, and 100+ more libraries. Use for: data processing, web scraping, image manipulat...

- `.claude/skills/python-executor/SKILL.md`

## Python Testing Patterns

Implement comprehensive testing strategies with pytest, fixtures, mocking, and test-driven development. Use when writing Python tests, setting up test suites, or implementing testing best practices.

- `.claude/skills/python-testing-patterns/SKILL.md`
- `.claude/skills/python-testing-patterns/references/advanced-patterns.md`: Advanced testing patterns including async code, monkeypatching, temporary files, conftest setup, property-based testing, database testing, CI/CD integration, and configuration.

## SEO optimization

Optimize for search engine visibility and ranking. Use when asked to "improve SEO", "optimize for search", "fix meta tags", "add structured data", "sitemap optimization", or "search engine optimization".

- `.claude/skills/seo/SKILL.md`

<!-- autoskills:end -->
