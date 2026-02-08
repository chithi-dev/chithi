---
icon: lucide/variable
---

## Backend environment variables

The backend supports following environmental variables:

| Variable                   | Purpose                                                  | Notes                                        |
| :------------------------- | -------------------------------------------------------- | -------------------------------------------- |
| `POSTGRES_SERVER`          | Hostname or service name where PostgreSQL runs           | Docker service name or host reachable by app |
| `POSTGRES_PORT`            | TCP port for Postgres                                    | Default Postgres port                        |
| `POSTGRES_USER`            | Database username                                        | Used to authenticate to the DB               |
| `POSTGRES_PASSWORD`        | Database password / secret                               | **Sensitive** — use secrets manager          |
| `POSTGRES_DB`              | Name of the database the app should use                  | Create DB or grant access                    |
| `RUSTFS_ENDPOINT_URL`      | Endpoint for object storage service (S3-compatible)      | Include scheme and port if needed            |
| `RUSTFS_ACCESS_KEY`        | Object storage access key                                | Acts like S3 access key (sensitive)          |
| `RUSTFS_SECRET_ACCESS_KEY` | Object storage secret key                                | Acts like S3 secret key (sensitive)          |
| `CELERY_BROKER_URL`        | Celery broker connection string (where tasks are queued) | Could be `amqp://` for RabbitMQ              |
| `CELERY_RESULT_BACKEND`    | Backend for Celery task results                          | Stores task results/status                   |
| `REDIS_ENDPOINT`           | General Redis connection for app (not Celery)            | Uses a separate DB to avoid conflicts        |
| `ROOT_PATH`                | URL path prefix when app is behind a reverse proxy       | Ensure proxy and app agree on prefix         |

!!! Tip

    Keep secrets out of the repo (use Docker secrets, Vault, or CI secrets), rotate credentials, and restrict network access.
