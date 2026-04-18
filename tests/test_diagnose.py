# POURQUOI: /api/diagnose is the single-call health endpoint — must stay reliable.

import json
import os


def test_diagnose_returns_ok_when_no_data(client):
    r = client.get("/api/diagnose")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] in {"ok", "degraded"}
    assert body["version"] == "4.2"
    assert "issues" in body
    assert "files" in body
    assert "stats" in body
    assert "recent_errors" in body


def test_diagnose_flags_missing_api_key_when_no_profile(client, monkeypatch):
    monkeypatch.setattr("routes.diagnose.GEMINI_API_KEY", "")
    r = client.get("/api/diagnose")
    body = r.json()
    codes = [i["code"] for i in body["issues"]]
    assert "AI_001" in codes


def test_diagnose_reports_corrupt_file(client, isolated_data_dir):
    # Write garbage into meals.json -> diagnose flags STORAGE_002
    with open(os.path.join(isolated_data_dir, "meals.json"), "w") as f:
        f.write("{not valid json")
    r = client.get("/api/diagnose")
    body = r.json()
    codes = [i["code"] for i in body["issues"]]
    assert "STORAGE_002" in codes
    assert body["status"] == "error"


def test_diagnose_reports_profile_incomplete(client, isolated_data_dir):
    with open(os.path.join(isolated_data_dir, "profile.json"), "w") as f:
        json.dump({"name": "x", "diet_type": "keto_omad"}, f)
    r = client.get("/api/diagnose")
    body = r.json()
    codes = [i["code"] for i in body["issues"]]
    assert "STORAGE_004" in codes


def test_diagnose_includes_stats_block(client):
    r = client.get("/api/diagnose")
    body = r.json()
    assert "meals" in body["stats"]
    assert "weights" in body["stats"]
    assert "profile_set" in body["stats"]
