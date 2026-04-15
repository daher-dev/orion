ARG PYTHON_VERSION=3.14-slim-bookworm
FROM python:$PYTHON_VERSION

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ARG APP_HOME=/app
WORKDIR $APP_HOME
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=$APP_HOME

COPY pyproject.toml uv.lock $APP_HOME/
RUN uv export --locked --no-dev --no-install-project -o $APP_HOME/requirements.txt \
    && uv pip install --system -r $APP_HOME/requirements.txt

COPY src/ $APP_HOME/

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
