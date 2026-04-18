# Patterns de Code — KetoFuel

> Lu par Claude uniquement quand il ecrit du nouveau code.

## Backend

- **AI prompt pattern:** f-string avec `is_keto = diet_type in KETO_DIET_TYPES` pour role, regles, closing.
- **Daily log updates:** Toujours utiliser `_patch_daily_log()` — jamais reconstruire DailyLog manuellement.
- **Bulk stats:** `get_bulk_daily_stats(dates)` — lecture fichier unique, groupe par date.
- **API key safety:** Frontend supprime la cle avant POST. Serveur preserve l'existante si vide.

## Frontend

- **XSS-safe onclick:** `storeData(obj)` → ID → `onclick="fn('${id}')"` → `getData(id)`.
- **Falsy-zero safe:** Utiliser `?? default` en JS (pas `|| default`) pour valeurs pouvant etre 0.
- **Dashboard refresh chain:** `logMeal()` → `loadMeals()` + `loadDashboard()`. Idem `saveSettings()`.
- **innerHTML escaping:** Toutes les strings serveur → `esc()`. Aucune exception.

## Logging

- Toujours utiliser les codes d'erreur de `errors.py` (ex: `AI_001`, `STORAGE_002`).
- Format: `dlog.error("module", "CODE", {"action": "...", "error": "...", "fix": "..."})`.
- Champ `fix` obligatoire dans les erreurs — indique quoi faire sans lire le code.
