"""Initial migration: Create Config and File tables

Revision ID: cb303129bc56
Revises:
Create Date: 2025-12-22 11:44:57.079785

"""

from typing import Sequence
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from sqlalchemy.dialects import postgresql
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

    # 3. Trigger Function: Sync defaults into arrays
    op.execute("""
        CREATE OR REPLACE FUNCTION sync_config_defaults()
        RETURNS trigger AS $$
        BEGIN
            IF NEW.download_configs IS NULL THEN
                NEW.download_configs := ARRAY[NEW.default_number_of_downloads];
            ELSIF NOT (NEW.default_number_of_downloads = ANY(NEW.download_configs)) THEN
                NEW.download_configs := array_append(NEW.download_configs, NEW.default_number_of_downloads);
            END IF;

            IF NEW.time_configs IS NULL THEN
                NEW.time_configs := ARRAY[NEW.default_expiry];
            ELSIF NOT (NEW.default_expiry = ANY(NEW.time_configs)) THEN
                NEW.time_configs := array_append(NEW.time_configs, NEW.default_expiry);
            END IF;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # 4. Trigger Function: Singleton
    op.execute("""
        CREATE OR REPLACE FUNCTION enforce_singleton()
        RETURNS trigger AS $$
        BEGIN
            IF (SELECT COUNT(*) FROM config) >= 1 THEN
                RAISE EXCEPTION 'Only one row is allowed in config';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # 5. Trigger Function: Delete Prevention
    op.execute("""
        CREATE OR REPLACE FUNCTION prevent_config_deletion()
        RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'The configuration record cannot be deleted';
        END;
        $$ LANGUAGE plpgsql;
    """)

    # 6. Trigger Function: Validate File Type Exclusivity
    # Uses the Postgres overlap operator (&&) to check for common elements
    op.execute("""
        CREATE OR REPLACE FUNCTION validate_file_types()
        RETURNS trigger AS $$
        BEGIN
            IF NEW.allowed_file_types && NEW.banned_file_types THEN
                RAISE EXCEPTION 'Conflict: allowed_file_types and banned_file_types cannot share common extensions';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # 7. Apply Triggers
    op.execute(
        "CREATE TRIGGER sync_defaults_trigger BEFORE INSERT OR UPDATE ON config FOR EACH ROW EXECUTE FUNCTION sync_config_defaults();"
    )
    op.execute(
        "CREATE TRIGGER singleton_trigger BEFORE INSERT ON config FOR EACH ROW EXECUTE FUNCTION enforce_singleton();"
    )
    op.execute(
        "CREATE TRIGGER prevent_deletion_trigger BEFORE DELETE ON config FOR EACH ROW EXECUTE FUNCTION prevent_config_deletion();"
    )
    op.execute(
        "CREATE TRIGGER validate_file_types_trigger BEFORE INSERT OR UPDATE ON config FOR EACH ROW EXECUTE FUNCTION validate_file_types();"
    )

    # 8. Seed Initial Data
    config_instance = Config()
    data = config_instance.model_dump(exclude={"id"})
    op.bulk_insert(sa.table("config", *[sa.column(k) for k in data.keys()]), [data])


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS validate_file_types_trigger ON config;")
    op.execute("DROP TRIGGER IF EXISTS prevent_deletion_trigger ON config;")
    op.execute("DROP TRIGGER IF EXISTS singleton_trigger ON config;")
    op.execute("DROP TRIGGER IF EXISTS sync_defaults_trigger ON config;")
    op.execute("DROP FUNCTION IF EXISTS validate_file_types();")
    op.execute("DROP FUNCTION IF EXISTS prevent_config_deletion();")
    op.execute("DROP FUNCTION IF EXISTS enforce_singleton();")
    op.execute("DROP FUNCTION IF EXISTS sync_config_defaults();")
    op.drop_table("file")
    op.drop_table("config")
