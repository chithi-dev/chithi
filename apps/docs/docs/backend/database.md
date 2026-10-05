---
icon: lucide/database
---

# Database backends

Chithi reads its database configuration from the `DATABASE_URL` environment
variable via [dj-database-url](https://github.com/jazzband/dj-database-url).
The default is `sqlite:///db.sqlite3`, so the app runs with zero configuration
in development.

## SQLite (default)

No extra setup required. The database file is created at the path given by
`DATABASE_URL`:

```bash
# In-memory (tests)
export DATABASE_URL="sqlite:///:memory:"

# File-based (development default)
export DATABASE_URL="sqlite:///db.sqlite3"

# Absolute path
export DATABASE_URL="sqlite:////var/lib/chithi/db.sqlite3"
```

SQLite is a single-file, zero-configuration database. It is ideal for
development, single-node deployments, and tests. For multi-instance
production deployments, use Postgres or MySQL instead.

## PostgreSQL

`psycopg` (version 3, with the binary wheel) is included in the base
dependencies, so no extra install is needed.

```bash
export DATABASE_URL="postgres://user:password@host:5432/chithi"
```

dj-database-url also accepts the `postgresql` and `psycopg` schemes:

```bash
export DATABASE_URL="postgresql://user:password@host:5432/chithi"
export DATABASE_URL="psycopg://user:password@host:5432/chithi"
```

### SSL connections

Pass SSL parameters as URL query-string options:

```bash
export DATABASE_URL="postgres://user:pass@host:5432/chithi?sslmode=require"
```

## MySQL / MariaDB

The `mysqlclient` driver (Django's recommended choice) is already included in
`pyproject.toml` -- no extra install needed.

!!! Note

    `mysqlclient` is a C extension and requires the MySQL client library at
    build time. In Docker, use an image based on `python:slim` with
    `libmariadb-dev` or `default-libmysqlclient-dev` installed, or use a
    pre-built image that bundles the client libs.

Then point `DATABASE_URL` at your server:

```bash
export DATABASE_URL="mysql://user:password@host:3306/chithi"
```

dj-database-url also accepts the `mysql` and `mysqlgis` schemes.

### Character set and collation

On some MySQL/MariaDB setups the server default is not UTF-8. To force a
specific charset and collation, set the optional `DB_CHARSET` and
`DB_COLLATION` environment variables:

```bash
export DATABASE_URL="mysql://user:password@host:3306/chithi"
export DB_CHARSET="utf8mb4"
export DB_COLLATION="utf8mb4_unicode_ci"
```

These are passed through to Django's `OPTIONS` dict. Postgres and SQLite
ignore them.

## Connection pooling

`conn_max_age=60` and `conn_health_checks=True` are set by default. Long-lived
connections are reused for up to 60 seconds and are health-checked before each
use to avoid stale-connection errors after a restart or failover.

<small>
    See the [backend environment variables](./environment.md) and the
    [backend architecture](./architecture.md).
</small>
