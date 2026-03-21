from sqlmodel import SQLModel

from typing import Literal


class Token(SQLModel):
    access_token: str
    token_type: Literal["bearer"]


class TokenPayload(SQLModel):
    sub: str | None = None


class TokenValidOut(SQLModel):
    valid: bool
