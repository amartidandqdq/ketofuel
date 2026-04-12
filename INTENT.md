# INTENT.md — Vision du Projet

> Ce fichier appartient au propriétaire. L'IA le lit mais ne le modifie pas.

## Objectif

KetoFuel est un planificateur de repas keto/OMAD personnel avec suivi de la cetose, exercice, electrolytes, et fonctionnalites IA (OpenAI). Concu pour un seul utilisateur.

## Non-Negociables

- Zero framework frontend (vanilla JS uniquement)
- Stockage JSON fichiers (pas de base de donnees)
- Application mono-utilisateur
- Fonctionnel en local sans internet (sauf features IA)
- Dark mode par defaut
- Toutes les donnees restent locales

## Stack Autorisee

- Python 3.9+ / FastAPI / Pydantic
- Vanilla JavaScript (pas de React, Vue, etc.)
- CSS custom properties (pas de Tailwind, Bootstrap)
- OpenAI API (pour les features IA uniquement)
- Docker (deploiement optionnel)

## Fonctionnalites Prevues

- [x] Suivi cetose avec timeline specifique par regime
- [x] Timer de jeune intermittent
- [x] Log de repas avec analyse IA
- [x] Scanner d'etiquettes nutritionnelles
- [x] Suivi de poids avec graphique SVG
- [x] Electrolytes + eau tracker
- [x] Exercice logger avec impact sur la cetose
- [x] Achievements / badges
- [x] Export CSV
- [x] PWA installable
- [ ] Tests automatises
- [ ] Preservation musculaire (suivi proteine/kg masse maigre)

## Decisions Actees

| Date | Decision | Raison |
|------|----------|--------|
| 2026-04-11 | JSON fichiers, pas SQLite | Simplicite, mono-utilisateur |
| 2026-04-11 | Vanilla JS, pas React | Pas de build step, simplicite |
| 2026-04-12 | Keto timeline par regime | Carnivore vs lazy keto = timelines differentes |
| 2026-04-12 | Exercice reduit le target, pas skip les phases | Biologiquement correct |
