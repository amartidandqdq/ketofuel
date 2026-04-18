# KetoFuel — Commandes simplifiees
# Usage: make <commande>

.PHONY: start stop test diagnose logs backup restore update clean

## Lancer l'app (cree le venv si besoin)
start:
	@./start.sh

## Lancer avec Docker
docker:
	docker compose up -d

## Arreter Docker
stop:
	docker compose down

## Lancer tous les tests
test:
	@source .venv/bin/activate 2>/dev/null || true && python -m pytest tests/ -v --tb=short

## Lancer les tests E2E (necessite navigateur)
test-e2e:
	@source .venv/bin/activate 2>/dev/null || true && python -m pytest tests/e2e/ -v --tb=short

## Diagnostic systeme (appelle /api/diagnose)
diagnose:
	@curl -s http://localhost:8086/api/diagnose 2>/dev/null | python3 -m json.tool || echo "App non demarree — lancer 'make start' d'abord"

## Voir les 20 dernieres erreurs
logs:
	@grep '"level":"error"' logs/diagnostic.log 2>/dev/null | tail -20 | python3 -m json.tool || echo "Aucune erreur dans les logs"

## Voir tous les logs recents
logs-all:
	@tail -50 logs/diagnostic.log 2>/dev/null | python3 -m json.tool || echo "Pas de logs"

## Sauvegarder les donnees
backup:
	@./backup.sh

## Restaurer une sauvegarde (usage: make restore FILE=backups/xxx.tar.gz)
restore:
	@test -n "$(FILE)" || (echo "Usage: make restore FILE=backups/xxx.tar.gz" && exit 1)
	@tar -xzf $(FILE) -C data/
	@echo "Restauration terminee depuis $(FILE)"

## Mettre a jour les dependances
update:
	@source .venv/bin/activate 2>/dev/null || true && pip install -r requirements.txt --upgrade

## Nettoyer les fichiers temporaires
clean:
	@find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@echo "Nettoyage termine"

## Aide
help:
	@echo ""
	@echo "  KetoFuel — Commandes disponibles"
	@echo "  ================================"
	@echo "  make start      Lancer l'app"
	@echo "  make docker     Lancer avec Docker"
	@echo "  make stop       Arreter Docker"
	@echo "  make test       Lancer les tests"
	@echo "  make test-e2e   Tests E2E (navigateur)"
	@echo "  make diagnose   Diagnostic systeme"
	@echo "  make logs       Voir les erreurs recentes"
	@echo "  make backup     Sauvegarder les donnees"
	@echo "  make restore    Restaurer (FILE=...)"
	@echo "  make update     MAJ dependances"
	@echo "  make clean      Nettoyer cache Python"
	@echo ""
