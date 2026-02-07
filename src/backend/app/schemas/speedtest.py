from pydantic import BaseModel


class UploadPayload(BaseModel):
    bytes_received: int
