"""
REST framework, JWT and OpenAPI settings. Pulled into base.py with `from .api import *`.

Env vars (all optional): JWT_ACCESS_MINUTES, JWT_REFRESH_DAYS, JWT_SIGNING_KEY,
THROTTLE_ANON, THROTTLE_USER, THROTTLE_AUTH, CORS_ALLOWED_ORIGINS.
base.py must list in INSTALLED_APPS: rest_framework, rest_framework_simplejwt.token_blacklist,
django_filters, drf_spectacular, corsheaders; and corsheaders.middleware.CorsMiddleware
before CommonMiddleware.
"""

import os
from datetime import timedelta

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        # Checks the signature, the expiry, the blacklist and user.is_active on every request.
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    # Secure by default: a view must opt out explicitly (AllowAny / IsLibrarianOrReadOnly).
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.StandardPagination",
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "EXCEPTION_HANDLER": "apps.core.exceptions.api_exception_handler",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": os.environ.get("THROTTLE_ANON", "60/min"),
        "user": os.environ.get("THROTTLE_USER", "300/min"),
        # Used by login / register / refresh through ScopedRateThrottle (per IP).
        "auth": os.environ.get("THROTTLE_AUTH", "10/min"),
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.environ.get("JWT_ACCESS_MINUTES", "15"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.environ.get("JWT_REFRESH_DAYS", "7"))),
    # Every refresh returns a NEW refresh token and the old one is blacklisted, so a
    # stolen refresh token stops working as soon as the real client refreshes once.
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    # Keep a stale last_login out of the hot path; login still updates it.
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    # SIGNING_KEY defaults to Django's SECRET_KEY; JWT_SIGNING_KEY (below) overrides it.
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "AUTH_TOKEN_CLASSES": ("rest_framework_simplejwt.tokens.AccessToken",),
}

# A separate key lets you rotate JWT signing independently of SECRET_KEY (sessions, CSRF).
if os.environ.get("JWT_SIGNING_KEY"):
    SIMPLE_JWT["SIGNING_KEY"] = os.environ["JWT_SIGNING_KEY"]

SPECTACULAR_SETTINGS = {
    "TITLE": "Library Management System API",
    "DESCRIPTION": "REST API for books, members, loans, reservations and fines.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SECURITY": [{"jwtAuth": []}],
    "APPEND_COMPONENTS": {
        "securitySchemes": {
            "jwtAuth": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
        }
    },
}

# Browser clients (the Vite dev server / production frontend). Credentials are not
# needed: tokens travel in the Authorization header, never in cookies.
CORS_ALLOWED_ORIGINS = [
    o for o in os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o
]
CORS_ALLOW_CREDENTIALS = False
