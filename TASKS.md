# TASKS.md — Etat Actuel

**Statut global** : 🟢
**Derniere session** : 2026-04-12

## 🔄 En Cours

*(aucune tache interrompue)*

## 📋 A Faire

### Priorite Normale
- [ ] Race conditions storage.py (file locking ou SQLite pour multi-user)
- [ ] Ajouter plus d'exercices au tracker (HIIT, weight training, swimming)
- [ ] Tests frontend (end-to-end avec Playwright ou similar)

## ✅ Fait (5 dernieres)

- 2026-04-12 — app.js split en 10 modules ES (1887→104 lignes entry point, chaque module <320 lignes)
- 2026-04-12 — 47 tests pytest couvrant tous les modules backend (profile, meals, tracking, weight, ketosis, dashboard)
- 2026-04-12 — Muscle preservation: endpoint /api/protein-status + alerte frontend (protein/kg lean mass)
- 2026-04-12 — Exercise daily cap: 2.0 bonus max/jour, walk max 3/jour, fat_fast max 1/jour
- 2026-04-12 — Code review fix: 8 issues (ExerciseLogRequest, _patch_daily_log, keto_data.py extraction)

## ⚠️ Bloque / Attention

- OpenAI API key requise pour les features IA (non-bloquant, app fonctionne sans)

## 📝 Contexte pour Prochaine Session

Le projet est fonctionnel, teste, et modulaire. 47 tests pytest passent. Frontend split en 10 modules ES natifs. Backend: 7 APIRouter modules. Nouvelles features: exercise daily cap (2.0/jour), muscle preservation (protein/kg lean mass avec alertes). Regime configure: Carnivore + 23h OMAD.
