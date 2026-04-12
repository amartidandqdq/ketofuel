# AUDIT.md — Etat Technique

> Mise a jour : 2026-04-12

**Sante** : 🟢

## Erreurs Actives

| Fichier | Erreur | Bloquant ? |
|---------|--------|------------|
| *(aucune)* | | |

## Dette Technique

| Zone | Probleme | Priorite |
|------|----------|----------|
| storage.py | Read-modify-write non-atomique (race conditions) | Medium |
| storage.py | API key en texte clair dans profile.json | Low |
| app.js | 1856 lignes — monolithique, difficile a maintenir | Medium |
| main.py | Pas de tests automatises | High |
| uploads | MIME type valide mais pas magic bytes | Low |
| fasting timer | Pas de timezone awareness | Low |

## Fichiers Volumineux (> 200 lignes)

- `static/app.js` — 1856 lignes (toute la logique frontend, vanilla JS, pas de build step)
- `static/style.css` — 1394 lignes (dark/light themes + responsive + tous les composants)
- `templates/index.html` — 584 lignes (SPA single-page, acceptable)
- `ai_client.py` — 325 lignes (tous les prompts OpenAI, acceptable)
- `storage.py` — 250 lignes (CRUD JSON, acceptable)

**Backend conforme** : main.py=54, routes max=163, keto_data=188 — tous < 200.

## Hypotheses Faites

| Hypothese | Impact si fausse |
|-----------|------------------|
| Mono-utilisateur (pas de concurrence) | Race conditions sur JSON storage |
| OpenAI API toujours disponible | Features IA cassees (non-bloquant) |
| Navigateur moderne (ES2020+) | `??`, `?.`, `Promise.all` ne marcheront pas |
| Pas de donnees sensibles sauf API key | Pas de chiffrement necessaire |
