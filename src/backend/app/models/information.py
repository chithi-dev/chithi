from sqlmodel import SQLModel


class InformationOut(SQLModel):
    python_version: str
    fastapi_version: str
    redis_version: str
    postgres_version: str
