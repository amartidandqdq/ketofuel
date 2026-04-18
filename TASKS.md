# TASKS.md — Etat Actuel

**Statut global** : 🟢
**Derniere session** : 2026-04-18 (v4.2 codes wired + docker-ready)

## 🔄 En Cours

*(aucune tache interrompue)*

## 📋 A Faire

### Priorite Normale
- [ ] SQLite migration (multi-user, race conditions storage.py)
- [ ] Offline write support (IndexedDB queue + background sync)
- [ ] UI en français (labels, boutons, toasts)
- [ ] Body composition trend charts
- [ ] Per-meal macro targets
- [ ] Weekly meal planning calendar (drag-drop)

### Tests
- [ ] Pre-existing flaky E2E `test_exercise_count_increments` (asserts `(2/` got `(3/3)`)

## ✅ Fait (10 dernieres)

- 2026-04-18 — Docker ready: Dockerfile EXPOSE 8086, curl healthcheck, logs/ volume, optional .env
- 2026-04-18 — `.env.example` ported to Gemini (was OpenAI)
- 2026-04-18 — Tests `tests/test_diagnose.py` (5 tests on /api/diagnose)
- 2026-04-18 — `errors.py` codes wired into routes/ai.py (AIError class, code+fix in 4xx/5xx)
- 2026-04-18 — `errors.py` codes wired into storage.py (STORAGE_001/002/003 via dlog)
- 2026-04-18 — `errors.py` codes wired into ai_client.py (AI_001/002/003/005 via AIError)
- 2026-04-15 — Slim CLAUDE.md (~75% token savings) + docs/ on-demand
- 2026-04-15 — `errors.py` catalog (25 codes) + `routes/diagnose.py` + Makefile
- 2026-04-13 — Migration OpenAI → Google Gemini (gemini-2.5-flash) + 55 French keto foods
- 2026-04-13 — KetoFuel v4 overhaul: 3 exercises, 20 E2E, barcode (OFF), rate limiting

## ⚠️ Bloque / Attention

- Gemini API key requise pour features IA (non-bloquant — app fonctionne sans, /api/diagnose flag AI_001)

## 📝 Contexte pour Prochaine Session

KetoFuel v4.2 — port 8086, Gemini AI, 54 backend tests + 20 E2E. Codes d'erreur (`errors.py`, 25 codes) maintenant wired dans `routes/ai.py`, `storage.py`, `ai_client.py` — réponses 4xx/5xx incluent `code` + `fix`, logs JSON ont `code`/`action`/`fix` au top level. `/api/diagnose` reste l'entry point pour debugging. Docker ready: `make docker` lance app + backup container, healthcheck via curl, logs/ persisté.
