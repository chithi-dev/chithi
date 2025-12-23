from uuid import UUID
from sqlmodel import Field, SQLModel
from sqlalchemy import text


class UserOut(SQLModel):
    username: str = Field(index=True, unique=True)
    email: str | None = Field(default=None, index=True, unique=True)


class User(UserOut, table=True):
    id: UUID = Field(
        default=None,
        primary_key=True,
        sa_column_kwargs={
            "server_default": text(
                "uuidv7()",
            )
        },
    )

    password_hash: str = Field()
