---
icon: lucide/package
---

# Vanila (Bring your own reverse proxy)

To host chithi, you need 3 parts.

1. A S3 compatible storage instance
2. A Postgres Database instance
3. A Redis Instance

# Docker Compose

Here is a ready to use docker file that can be used to deploy your site:

```yaml
services:
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
        container_name: rustfs-volume-fix
        volumes:
            - ./rustfs-data:/data
        command: >
            sh -c "
              chown -R 10001:10001 /data &&
              echo 'Volume Permissions fixed' &&
              exit 0
            "
        restart: 'no'

    rustfs:
        image: rustfs/rustfs:1.0.0-alpha.81
        container_name: rustfs
        restart: unless-stopped
        user: '10001:10001'
        security_opt:
            - no-new-privileges:true
        volumes:
            - ./rustfs-data:/data
        environment:
            RUSTFS_ADDRESS: '0.0.0.0:9000'
            RUSTFS_CONSOLE_ADDRESS: '0.0.0.0:9001'
            RUSTFS_VOLUMES: '/data/rustfs'
            RUSTFS_ACCESS_KEY: rustfsadmin
            RUSTFS_SECRET_KEY: rustfsadmin
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
        image: redis:8.4.0-alpine
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
        ports:
            - 8000:8000

        environment: &backend-env
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

        environment: *backend-env
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
        ports:
            - 3000:3000

        environment:
            PUBLIC_BACKEND_API: https://<your_domain>/api
        depends_on:
            backend:
                condition: service_started

volumes:
    postgres_data:
    redis_data:
```

Now you can use a caddyfile like:

```caddyfile
<your_domain> {
    handle_path /api/* {
        reverse_proxy localhost:8000
    }

    handle {
        reverse_proxy localhost:3000
    }
}
```

!!! warning

    This method exposes port `3000` and `8000` of your machine to docker containers

!!! danger

    Please replace `<your_domain>` with the actual domain you are going to use to point to chithi instance.

<small>
    If you still have any issues around hosting your instances, please open a [discussion](https://github.com/chithi-dev/chithi/discussions/categories/q-a)
</small>
