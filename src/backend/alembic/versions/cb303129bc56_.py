"""Initial migration: Create Config and File tables

Revision ID: cb303129bc56
Revises:
Create Date: 2025-12-22 11:44:57.079785

"""

from typing import Sequence

import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from sqlalchemy.dialects import postgresql

from alembic import op
from app.models import Config

# revision identifiers, used by Alembic.
revision: str = "cb303129bc56"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Create Config Table
    op.create_table(
        "config",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("total_storage_limit", sa.BigInteger(), nullable=True),
        sa.Column("max_file_size_limit", sa.BigInteger(), nullable=True),
        sa.Column("default_expiry", sa.Integer(), nullable=False),
        sa.Column("default_number_of_downloads", sa.Integer(), nullable=False),
        sa.Column(
            "site_description", sqlmodel.sql.sqltypes.AutoString(), nullable=False
        ),
        sa.Column("download_configs", postgresql.ARRAY(sa.Integer()), nullable=True),
        sa.Column("time_configs", postgresql.ARRAY(sa.Integer()), nullable=True),
        sa.Column("allowed_file_types", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("banned_file_types", postgresql.ARRAY(sa.String()), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # 2. Create File Table
    op.create_table(
        "file",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("filename", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("expire_after_n_download", sa.Integer(), nullable=False),
        sa.Column("download_count", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # 3. Seed Initial Data
    config_instance = Config()
    data = config_instance.model_dump(exclude={"id"})
    op.bulk_insert(sa.table("config", *[sa.column(k) for k in data.keys()]), [data])


def downgrade() -> None:
    op.drop_table("file")
    op.drop_table("config")
