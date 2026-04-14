---
icon: simple/caddy
---

# Caddy with Watchtower

This setup runs Caddy as the reverse proxy and Watchtower to automatically update containers when new images are available.

To host chithi, you need 4 parts.

1. A S3 compatible storage instance
2. A Postgres Database instance
3. A Redis Instance
4. A Watchtower instance to auto-update containers

# Docker Compose

```yaml
services:
  caddy:
    image: caddy:latest
    container_name: caddy
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - frontend
      - backend

  watchtower:
    image: containrrr/watchtower
    container_name: watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --interval 600
    environment:
      - WATCHTOWER_CLEANUP=true

  postgres:
    image: postgres:18
    container_name: postgres-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: supersecretpassword
      POSTGRES_DB: chithi
    volumes:
      - postgres_data:/var/lib/postgresql
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready']
      interval: 10s
      timeout: 5s
      retries: 5

  volume-permission-helper:
    image: alpine
    volumes:
      - rustfs:/data
    command: >
      sh -c "
        chown -R 10001:10001 /data &&
        echo 'Volume Permissions fixed' &&
        exit 0
      "
    restart: 'no'

  rustfs:
    image: rustfs/rustfs:1.0.0-alpha.85
    security_opt:
      - 'no-new-privileges:true'
    container_name: rustfs
    restart: unless-stopped
    user: '10001:10001'
    volumes:
      - rustfs:/data
    environment:
      RUSTFS_ADDRESS: '0.0.0.0:9000'
      RUSTFS_CONSOLE_ADDRESS: '0.0.0.0:9001'
      RUSTFS_VOLUMES: '/data/rustfs'
      RUSTFS_ACCESS_KEY: 'rustfsadmin'
      RUSTFS_SECRET_KEY: 'rustfsadmin'
      RUSTFS_CONSOLE_ENABLE: 'true'
    healthcheck:
      test: ['CMD', 'sh', '-c', 'curl -f http://localhost:9000/health && curl -f http://localhost:9001/rustfs/console/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    depends_on:
      volume-permission-helper:
        condition: service_completed_successfully

  redis:
    image: redis:8.6-alpine
    container_name: redis
    restart: unless-stopped
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 30s
      timeout: 10s
      retries: 3

  backend:
    image: ghcr.io/chithi-dev/chithi-backend:latest
    container_name: backend
    restart: unless-stopped
    command: /bin/sh /app/scripts/start_backend.sh
    labels:
      - 'com.centurylinklabs.watchtower.enable=true'
    environment: &backend-variable
      POSTGRES_SERVER: postgres
      POSTGRES_PORT: 5432
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: supersecretpassword
      POSTGRES_DB: chithi
      RUSTFS_ENDPOINT_URL: http://rustfs:9000
      RUSTFS_ACCESS_KEY: rustfsadmin
      RUSTFS_SECRET_ACCESS_KEY: rustfsadmin
      CELERY_BROKER_URL: redis://redis:6379/0
      CELERY_RESULT_BACKEND: redis://redis:6379/0
      REDIS_ENDPOINT: redis://redis:6379/1
      ROOT_PATH: /api
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      rustfs:
        condition: service_healthy

  celery:
    image: ghcr.io/chithi-dev/chithi-backend:latest
    container_name: celery
    restart: unless-stopped
    command: /bin/sh /app/scripts/start_celery.sh
    labels:
      - 'com.centurylinklabs.watchtower.enable=true'
    environment: *backend-variable
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      backend:
        condition: service_started

  frontend:
    image: ghcr.io/chithi-dev/chithi-frontend-node:latest
    container_name: frontend
    restart: unless-stopped
    labels:
      - 'com.centurylinklabs.watchtower.enable=true'
    environment:
      PUBLIC_BACKEND_API: https://<your_domain>/api
    depends_on:
      backend:
        condition: service_started

volumes:
  postgres_data:
  redis_data:
  rustfs:
  caddy_data:
  caddy_config:
```

# Caddyfile example

```caddyfile
<your_domain> {
  handle_path /api/* {
    reverse_proxy backend:8000
  }

  handle {
    reverse_proxy frontend:3000
  }

  tls you@example.com
}
```

!!! danger

    Replace `<your_domain>` with your actual domain. Caddy will provision TLS automatically.

<small>
    If you need hosting help, open a discussion at https://github.com/chithi-dev/chithi/discussions/categories/q-a
</small>
