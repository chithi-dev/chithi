---
icon: simple/traefikproxy
---

# Traefik Basic Deployment


This is the most straight forward way to host chithi instances.

To host chithi, you need 3 parts.

1. A S3 compatible storage instance
2. A Postgres Database instance
3. A Redis Instance

# Docker Compose

Here is a ready to use docker file that can be used to deploy your site:

```yaml
services:
    traefik:
        image: traefik:v3.7.0
        container_name: traefik
        restart: unless-stopped
        ports:
            - '80:80'
            - '443:443/tcp'
            - '443:443/udp'
        command:
            - '--providers.docker=true'
            - '--providers.docker.exposedbydefault=false'
            - '--entrypoints.web.address=:80'
            - '--entrypoints.websecure.address=:443'

            # Enable dashboard
            - '--api.dashboard=true'
            - '--api.insecure=true'

            # Enable http/3
            - '--entrypoints.websecure.http3=true'

            # Experimental FastProxy
            - '--experimental.fastProxy'

            # Info logs
            - '--log.level=INFO'

            #  Global redirect
            - '--entrypoints.web.http.redirections.entrypoint.to=websecure'
            - '--entrypoints.web.http.redirections.entrypoint.scheme=https'

            # --- Add these lines for Let's Encrypt ---
            - '--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json'
            - '--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web'

            # Disable timeout
            - '--entrypoints.websecure.transport.respondingTimeouts.readTimeout=0'
            - '--entrypoints.websecure.transport.respondingTimeouts.idleTimeout=0'

        volumes:
            - /var/run/docker.sock:/var/run/docker.sock:ro
            - letsencrypt:/letsencrypt

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
            test:
                [
                    'CMD',
                    'sh',
                    '-c',
                    'curl -f http://localhost:9000/health && curl -f http://localhost:9001/rustfs/console/health',
                ]
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
            - 'traefik.enable=true'
            - 'traefik.http.routers.backend.rule=Host(`<your_domain>`) && PathPrefix(`/api`)'

            # This middleware strips /api from the URL before it hits the container
            - 'traefik.http.middlewares.api-strip.stripprefix.prefixes=/api'
            - 'traefik.http.routers.backend.middlewares=api-strip'
            - 'traefik.http.routers.backend.entrypoints=websecure'
            - 'traefik.http.services.backend.loadbalancer.server.port=8000'

            # Enable letsencrypt
            - 'traefik.http.routers.backend.tls=true'
            - 'traefik.http.routers.backend.tls.certresolver=letsencrypt'

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

            # Redis
            REDIS_ENDPOINT: redis://redis:6379/1

            # Running behind reverse proxy
            ROOT_PATH: /api

        depends_on:
            postgres:
                condition: service_healthy
            redis:
                condition: service_healthy
            rustfs:
                condition: service_healthy
        networks:
            - default

    celery:
        image: ghcr.io/chithi-dev/chithi-backend:latest
        container_name: celery
        restart: unless-stopped
        command: /bin/sh /app/scripts/start_celery.sh
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
            - 'traefik.enable=true'
            - 'traefik.http.routers.frontend.rule=Host(`<your_domain>`)'
            - 'traefik.http.routers.frontend.priority=1'
            - 'traefik.http.routers.frontend.entrypoints=websecure'
            - 'traefik.http.routers.frontend.tls=true'
            - 'traefik.http.routers.frontend.tls.certresolver=letsencrypt'
            - 'traefik.http.services.frontend.loadbalancer.server.port=3000'

        environment:
            PUBLIC_BACKEND_API: https://<your_domain>/api
        depends_on:
            backend:
                condition: service_started

volumes:
    postgres_data:
    redis_data:
    rustfs:
    letsencrypt:
```

!!! danger

    Please replace `<your_domain>` with the actual domain you are going to use to point to chithi instance.

!!! info

    This is how [`chithi.dev`](https://chithi.dev) is configured

<small>
    If you still have any issues around hosting your instances, please open a [discussion](https://github.com/chithi-dev/chithi/discussions/categories/q-a)
</small>
