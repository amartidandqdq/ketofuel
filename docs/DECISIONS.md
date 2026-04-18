# Decisions Techniques — KetoFuel

> Lu par Claude uniquement quand une question "pourquoi" se pose.

| Decision | Raison |
|----------|--------|
| `storeData()`/`getData()` in app.js | Prevention XSS — data en JS map, seuls les IDs string dans les onclick HTML |
| `KETO_DIET_TYPES` dans ai_client.py | 7 variantes keto recoivent des prompts AI specifiques |
| `numVal()` dans saveSettings | Empeche les bugs falsy-zero (carb_ratio=0 pour carnivore devenait 5) |
| `_patch_daily_log()` helper | DRY read-modify-write pour daily logs, preserve tous les champs |
| Exercise reduit adapted_day target | Accelere la timeline mais ne saute pas les phases biologiques |
| Fasting protocol scale les seuils | 20h+ = 30% plus rapide, 16h+ = 15% plus rapide |
| Timelines cetose specifiques par regime | 6 timelines: carnivore 7j, ultra/strict 10j, keto OMAD 10j, standard 14j, lazy 21j, lite 28j |
| keto_data.py extraction | Constantes domaine separees des routes |
| Hub dashboard layout | Hero grid remplace 10+ cartes empilees |
| Toast stacking + undo | Toasts empiles verticalement, delete affiche undo 5s |
| Exercise cap 3.0/jour | 6 types — HIIT(1.2)+weights(0.8)+swim(0.7)=2.7 ok; cap empeche le gaming |
| cap_reason par exercice | Espresso dit "caffeine limit", HIIT dit "recovery needed" |
| CSP unsafe-inline | onclick handlers dans HTML necessitent unsafe-inline pour scripts |
| Open Food Facts API | Gratuit, pas de cle API, 100k+ produits — `cc=fr` pour France |
| Gemini over OpenAI | google-genai SDK, gemini-2.5-flash, JSON mode natif + vision |
| Food database francaise | 55 items CIQUAL, macros verifiees, aucun item >8g net carbs |
| Fasting retroactif | Input time — user peut entrer heure fin repas passee |
| SlowAPI rate limiting | 5-10 req/min sur endpoints AI |
| Port 8086 | Change de 8001 pour eviter conflits |
| Docker backup container | Alpine cron, tar.gz quotidien, rotation 7 jours |
| Playwright over Cypress | pytest-playwright garde tout en Python |
