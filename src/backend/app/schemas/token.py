from typing import Literal

from sqlmodel import SQLModel


class Token(SQLModel):
    access_token: str
    token_type: Literal["bearer"]


class TokenPayload(SQLModel):
    sub: str | None = None


class TokenValidOut(SQLModel):
    valid: bool
