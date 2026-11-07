# syntax=docker/dockerfile:1.7
ARG PYTHON_VERSION=3.12

# ---------------------------------------------------------------- base: dependencies only
FROM python:${PYTHON_VERSION}-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

# Outside /app on purpose: the dev compose file bind-mounts ./backend over /app.
COPY --chmod=755 entrypoint.sh /usr/local/bin/entrypoint.sh

# ---------------------------------------------------------------- dev: runserver + test tools
# Runs as root so bind mounts and the media volume are writable on every host OS.
FROM base AS dev
COPY requirements-dev.txt .
RUN pip install -r requirements-dev.txt
COPY . .
ENTRYPOINT ["entrypoint.sh"]
EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

# ---------------------------------------------------------------- prod: gunicorn, non-root
FROM base AS prod
RUN addgroup --system --gid 1001 app \
    && adduser --system --uid 1001 --ingroup app --no-create-home app
COPY --chown=app:app . .
# collectstatic only needs the settings to import; the key below is a throwaway, not the real one.
RUN DJANGO_SECRET_KEY=build-only python manage.py collectstatic --noinput \
    && mkdir -p media \
    && chown -R app:app staticfiles media
USER app
ENTRYPOINT ["entrypoint.sh"]
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/healthz/', timeout=3)"
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--access-logfile", "-"]
