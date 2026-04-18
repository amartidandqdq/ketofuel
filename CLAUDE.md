# CLAUDE.md — KetoFuel

> v4.2 — Gemini + France + Diagnostics. 54 tests pass, 20 E2E.

## Demarrage rapide

```bash
make start           # ou ./start.sh → http://localhost:8086
make test            # pytest
make diagnose        # GET /api/diagnose — etat complet du systeme
make logs            # 20 dernieres erreurs
make help            # toutes les commandes
```

Docker: `make docker` / `make stop`

## Mode Autonome

**"continue"** → TASKS.md → prochaine tache → executer.
**Tache libre** → Decomposer, executer, resumer.

### Debut de session
1. `GET /api/diagnose` — etat systeme (remplace grep dans les logs)
2. Lire TASKS.md si "continue"

### Fin de session (obligatoire)
1. TASKS.md + CHANGELOG.md a jour
2. `git add -A && git commit -m "[type]: [resume]"`

## Regles

1. Fichiers < 200 lignes (sauf app.js, style.css)
2. Zero valeur hardcodee hors `config.py` / `.env`
3. Zero import circulaire
4. `# POURQUOI:` sur decisions non evidentes
5. Bug corrige = test de non-regression
6. Codes d'erreur de `errors.py` dans tous les logs
7. Nouveau code → lire `docs/PATTERNS.md` d'abord

## Interdit

- Nouvelle techno non listee dans INTENT.md
- `git reset --hard` sans confirmation
- Terminer sans TASKS.md + CHANGELOG.md a jour

## Structure (detail: docs/ARCHITECTURE.md)

```
main.py → routes/ (9 modules + diagnose) → storage.py → data/*.json
                                         → ai_client.py → Gemini API
config.py    — env vars          errors.py    — codes d'erreur (25 codes)
models.py    — Pydantic          logger.py    — JSON logs (code/action/fix)
keto_data.py — constantes domaine
static/app.js → static/modules/ (10 ES modules)
tests/       — pytest + playwright E2E
docs/        — ARCHITECTURE.md, DECISIONS.md, PATTERNS.md
```

## Diagnostic & Erreurs

- **`/api/diagnose`** — retourne status, issues avec code+fix, stats, fichiers, erreurs recentes
- **`errors.py`** — catalogue centralise (AI_001..AI_005, STORAGE_001..004, VALID_001..003, EXERCISE_001..003, EXT_001..003, DATA_001..002, SYS_001..002)
- **Logger** — `dlog.error("module", "msg", {"code": "AI_002", "action": "...", "fix": "..."})` — champs code/action/fix extraits au top level pour grep

## Reference (lire si besoin)

| Fichier | Quand le lire |
|---------|---------------|
| `docs/ARCHITECTURE.md` | Refactoring, ajout module |
| `docs/DECISIONS.md` | Question "pourquoi ce choix" (21 decisions) |
| `docs/PATTERNS.md` | Ecriture de nouveau code |
| `errors.py` | Ajout/consultation codes d'erreur |
| `INTENT.md` | Vision, contraintes, stack autorisee |
| `TASKS.md` | Taches en cours, memoire inter-sessions |
| `AUDIT.md` | Dette technique, hypotheses |

## Key Decisions (v4.2)

| Decision | Raison |
|----------|--------|
| CLAUDE.md slim (65→80 lignes) | ~75% reduction tokens par session — details dans docs/ |
| `/api/diagnose` endpoint | 1 appel remplace grep logs + lecture fichiers manuels |
| `errors.py` catalogue | Codes grep-friendly avec fix integre — AI et non-dev lisent le meme format |
| Logger extrait code/action/fix | Champs au top level JSON pour grep direct |
| Makefile | Non-dev tape `make diagnose` sans connaitre Python |
| Tests noms explicites | Claude comprend ce que chaque test protege sans le lire |
| docs/ on-demand | ARCHITECTURE, DECISIONS, PATTERNS lus uniquement quand pertinent |

## Glossaire

| Terme | Definition |
|-------|------------|
| Net carbs | Total carbs - fiber |
| OMAD | One Meal A Day |
| Fat adapted | Corps brule les graisses efficacement (2-4 sem) |
| TDEE | Total Daily Energy Expenditure (Mifflin-St Jeor) |
| Keto flu | Symptomes de transition — souvent deficience electrolytes |
