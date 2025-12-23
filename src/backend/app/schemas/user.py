from pydantic import BaseModel


class UserOut(BaseModel):
    username: str
    email: str | None
