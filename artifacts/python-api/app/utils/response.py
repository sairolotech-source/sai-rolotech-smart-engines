from typing import Any, Dict, Optional


def pass_response(engine: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {
        "engine": engine,
        "status": "pass",
        **(data or {})
    }


def fail_response(engine: str, reason: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {
        "engine": engine,
        "status": "fail",
        "reason": reason,
        **(data or {})
    }


def warn_response(engine: str, reason: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {
        "engine": engine,
        "status": "warn",
        "reason": reason,
        **(data or {})
    }
