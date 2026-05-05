#!/bin/sh
set -e

echo "==> Waiting for PostgreSQL..."
while ! nc -z "$DB_HOST" "${DB_PORT:-5432}"; do
  sleep 0.5
done
echo "==> PostgreSQL is up."

echo "==> Waiting for Redis..."
while ! nc -z "${REDIS_HOST:-redis}" 6379; do
  sleep 0.5
done
echo "==> Redis is up."

echo "==> Running migrations..."
python manage.py migrate --noinput

echo "==> Collecting static files..."
python manage.py collectstatic --noinput

echo "==> Starting Daphne ASGI server..."
exec daphne -b 0.0.0.0 -p 8000 config.asgi:application
