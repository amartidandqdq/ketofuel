# TASKS.md — Etat Actuel

**Statut global** : 🟢
**Derniere session** : 2026-04-12

## 🔄 En Cours

*(aucune tache interrompue)*

## 📋 A Faire

### Priorite Haute
- [ ] Tests automatises (pytest pour backend, pas de tests actuellement)
- [ ] Preservation musculaire (proteine/kg masse maigre, alertes)

### Priorite Normale
- [ ] app.js depasse 1800 lignes — envisager split en modules
- [ ] Race conditions storage.py (file locking ou SQLite pour multi-user)
- [ ] Pas de CORS middleware tests

## ✅ Fait (5 dernieres)

- 2026-04-12 — Code review fix: 8 issues (ExerciseLogRequest, _patch_daily_log, keto_data.py extraction, tip.format safety, offline detection)
- 2026-04-12 — Dashboard hub layout redesign (hero section, compact grid)
- 2026-04-12 — Exercise logger with ketosis impact + fasting bonus
- 2026-04-12 — 6 dashboard features (donut, weekly summary, body comp, timing, achievements, snapshots)
- 2026-04-12 — 13 improvements (CORS, pagination, export, PWA, diet-specific ketosis, toast stacking, etc.)

## ⚠️ Bloque / Attention

- OpenAI API key requise pour les features IA (non-bloquant, app fonctionne sans)
- `app.js` a 1856 lignes — approche la limite de maintenabilite

## 📝 Contexte pour Prochaine Session

Le projet est fonctionnel et hardened. Deux reviews de code completees (17 + 8 fixes). Architecture: main.py (788 lignes, routes), keto_data.py (188 lignes, constantes), ai_client.py (325 lignes, prompts IA), storage.py (250 lignes, CRUD JSON). Frontend: app.js monolithique (1856 lignes). Regime actuellement configure: Carnivore avec 23h OMAD.
