# CHANGELOG.md

## 2026-04-12 — Gouvernance autonome

- Cree: INTENT.md, TASKS.md, CHANGELOG.md, AUDIT.md, ARCHITECTURE.md
- Mis a jour: CLAUDE.md avec protocole de session
- Ajoute: Logger structure Python (logs/diagnostic.log)

## 2026-04-12 — Code review #2 (8 fixes)

- Fix: ExerciseLogRequest Pydantic model (etait dict non-valide)
- Fix: N+1 lecture daily_logs.json dans ketosis endpoint (14 reads → 1)
- Fix: _patch_daily_log() helper DRY (3 copy-paste → 1 helper)
- Fix: check_symptoms perdait les exercices loggues
- Fix: Import ordering (CORSMiddleware)
- Fix: tip.format() crash risk → str.replace() safe
- Fix: Offline detection browser-agnostic
- Fix: adapted_day response retourne maintenant la valeur ajustee
- Extrait: keto_data.py (main.py 1030 → 788 lignes)

## 2026-04-12 — Dashboard hub layout

- Refactored: Today page de 10+ cartes empilees → hero grid compact
- Hero: Ketosis + Fasting + Exercise en 2 colonnes
- Row 2: Weekly summary + Streak/Water/Electrolytes
- Row 3: Macro donut + progress bars + Eating Window

## 2026-04-12 — Exercise logger + fasting bonus

- Ajoute: Log exercise (walk, fat fast, espresso) avec impact cetose
- Ajoute: Fasting protocol bonus (16h = -15%, 20h+ = -30% sur timeline)
- Ajoute: Exercise reduit le target d'adaptation, ne skip pas les phases
- Ajoute: Remove/clear exercises, max daily limits (espresso 4/jour)

## 2026-04-12 — 6 dashboard features

- Ajoute: Macro donut SVG (fat/protein/carbs ring)
- Ajoute: Weekly summary (avg kcal, net carbs, compliance, weight change)
- Ajoute: Body composition (BMI, body fat %, lean/fat mass bar)
- Ajoute: Meal timing heatmap (24h eating window)
- Ajoute: 15 achievement badges
- Ajoute: Daily snapshot popup (click compliance chart days)

## 2026-04-12 — 13 improvements

- Ajoute: Auto-save on preset click, dynamic sidebar subtitle
- Ajoute: Confirm + undo delete (5s toast), toast stacking
- Ajoute: CORS middleware, offline resilience banner
- Ajoute: SVG line weight chart, meal pagination
- Ajoute: CSV export, multi-day dashboard (date picker)
- Ajoute: PWA (manifest + service worker + icons)
- Ajoute: Diet-specific ketosis (6 timelines: carnivore 7d → keto lite 28d)
- Ajoute: Speed tips + accelerators par regime
- Ajoute: MCT C8 dans food database

## 2026-04-12 — Code review #1 (17 fixes)

- Fix: Falsy-zero bugs (carb_ratio, net_carb_limit dans save/load/dashboard)
- Fix: SavedPlan Pydantic model, consecutive compliance meal_count check
- Fix: is_keto check includes all 7 keto diet types
- Fix: Variable shadowing (log param), duplicate API key preservation
- Fix: Import consolidation, keto_foods.json error handling
- Fix: storeData pattern for food DB, user_portion_g zero check
