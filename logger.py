# Structured diagnostic logger — writes JSON lines to logs/diagnostic.log
# POURQUOI: Governance protocol requires structured logs as source of truth for debugging.
# v4.2: Added error codes support and fix field for AI-readable diagnostics.

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

LOG_DIR = Path("logs")
LOG_FILE = LOG_DIR / "diagnostic.log"
MAX_SIZE = 5 * 1024 * 1024  # 5MB rotation

LOG_DIR.mkdir(exist_ok=True)
_trace_id = str(uuid.uuid4())


def new_trace():
    global _trace_id
    _trace_id = str(uuid.uuid4())
    return _trace_id


def _write(level: str, module: str, message: str, payload=None):
    # Rotation
    if LOG_FILE.exists() and LOG_FILE.stat().st_size > MAX_SIZE:
        LOG_FILE.rename(LOG_DIR / f"diagnostic.{int(datetime.now().timestamp())}.log")

    entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "level": level,
        "module": module,
        "message": message,
        "traceId": _trace_id,
    }

    # POURQUOI: Structured payload with action/error/fix for AI-readable diagnostics
    if payload:
        if isinstance(payload, dict):
            # Extract known structured fields to top level for easy grep
            for key in ("code", "action", "fix"):
                if key in payload:
                    entry[key] = payload[key]
            # Keep remaining data under "data" key
            remaining = {k: v for k, v in payload.items() if k not in ("code", "action", "fix")}
            if remaining:
                entry["data"] = remaining
        else:
            entry["data"] = payload

    try:
        with open(LOG_FILE, "a") as f:
            f.write(json.dumps(entry, default=str) + "\n")
    except Exception as e:
        print(f"[LOGGER FAILURE] {e}")


class dlog:
    """Diagnostic logger.

    Basic:    dlog.info('module', 'message')
    Payload:  dlog.info('module', 'message', {"key": "val"})
    Error:    dlog.error('module', 'AI_001', {"action": "generate_plan", "error": "timeout", "fix": "Retry"})
    """
    info = staticmethod(lambda m, msg, p=None: _write("info", m, msg, p))
    warn = staticmethod(lambda m, msg, p=None: _write("warn", m, msg, p))
    error = staticmethod(lambda m, msg, p=None: _write("error", m, msg, p))
    debug = staticmethod(lambda m, msg, p=None: _write("debug", m, msg, p))


_write("info", "system", "[STARTUP] Logger ready", {"pid": os.getpid()})
