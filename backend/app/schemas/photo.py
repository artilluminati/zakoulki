from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PhotoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    post_id: int
    file_name: str
    width: int | None = None
    height: int | None = None
    created_at: datetime
