"""
In-memory cache that replaces Redis for development.
Implements the same interface used throughout the app:
  get, set, delete, exists, setex
TTL is honoured — expired keys are treated as missing.
"""
import time
import threading
from typing import Any, Optional


class MemoryCache:
    def __init__(self):
        self._store: dict[str, tuple[str, Optional[float]]] = {}
        # (serialised_value, expires_at_epoch | None)
        self._lock = threading.Lock()

    def _is_expired(self, key: str) -> bool:
        entry = self._store.get(key)
        if entry is None:
            return True
        _, expires_at = entry
        if expires_at is not None and time.time() > expires_at:
            del self._store[key]
            return True
        return False

    def get(self, key: str) -> Optional[str]:
        with self._lock:
            if self._is_expired(key):
                return None
            return self._store[key][0]

    def set(self, key: str, value: Any, ex: Optional[int] = None):
        """Set key to value. ex = TTL in seconds."""
        with self._lock:
            expires_at = (time.time() + ex) if ex else None
            self._store[key] = (str(value), expires_at)

    def setex(self, key: str, ex: int, value: Any):
        """Redis-compatible setex(key, seconds, value)."""
        self.set(key, value, ex=ex)

    def delete(self, key: str):
        with self._lock:
            self._store.pop(key, None)

    def exists(self, key: str) -> bool:
        with self._lock:
            return not self._is_expired(key)

    def keys(self, pattern: str = "*") -> list[str]:
        """Return all non-expired keys. Simple prefix/* matching only."""
        with self._lock:
            live = [k for k in list(self._store.keys()) if not self._is_expired(k)]
            if pattern == "*":
                return live
            prefix = pattern.rstrip("*")
            return [k for k in live if k.startswith(prefix)]


# Singleton — imported by all services
cache = MemoryCache()
