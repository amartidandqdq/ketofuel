# Structured diagnostic logger — writes JSON lines to logs/diagnostic.log
# POURQUOI: Governance protocol requires structured logs as source of truth for debugging.

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
        **({"data": payload} if payload else {}),
    }

    try:
        with open(LOG_FILE, "a") as f:
            f.write(json.dumps(entry, default=str) + "\n")
    except Exception as e:
        print(f"[LOGGER FAILURE] {e}")


class dlog:
    """Diagnostic logger. Usage: dlog.info('module', '[INPUT] func', {data})"""
    info = staticmethod(lambda m, msg, p=None: _write("info", m, msg, p))
    warn = staticmethod(lambda m, msg, p=None: _write("warn", m, msg, p))
    error = staticmethod(lambda m, msg, p=None: _write("error", m, msg, p))
    debug = staticmethod(lambda m, msg, p=None: _write("debug", m, msg, p))


_write("info", "system", "[STARTUP] Logger ready", {"pid": os.getpid()})
