from uuid import UUID
from sqlmodel import Field, SQLModel
from sqlalchemy import text


class User(SQLModel, table=True):
    id: UUID = Field(
        default=None,
        primary_key=True,
        sa_column_kwargs={
            "server_default": text(
                "uuidv7()",
            )
        },
    )

    username: str = Field(index=True, unique=True)
    email: str | None = Field(default=None, index=True, unique=True)
    password_hash: str = Field()
