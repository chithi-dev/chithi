from sqlmodel import SQLModel


class UploadPayload(SQLModel):
    bytes_received: int
