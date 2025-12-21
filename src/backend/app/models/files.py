from sqlmodel import SQLModel, Field


class File(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    filename: str
