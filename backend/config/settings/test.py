import os

# Tests must run without a .env file (CI, a fresh checkout). Never used outside tests.
os.environ.setdefault("DJANGO_SECRET_KEY", "test-only-secret-key-not-for-production")

from .base import *  # noqa: E402,F401,F403

# Fast and deterministic: no throttling, cheap password hashing, emails kept in memory.
DEBUG = False
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
SECURE_PROXY_SSL_HEADER = None
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False

REST_FRAMEWORK = {**REST_FRAMEWORK, "DEFAULT_THROTTLE_CLASSES": []}  # noqa: F405
MEDIA_ROOT = BASE_DIR / ".test-media"  # noqa: F405
