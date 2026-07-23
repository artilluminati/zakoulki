import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from PIL import Image

from app.db.session import get_db
from app.models.photo import Photo
from app.models.post import Post
from app.models.user import User
from app.schemas.photo import PhotoOut
from app.core.config import settings
from app.api.deps import get_current_user

router = APIRouter(prefix="/photos", tags=["photos"])


@router.post("", response_model=PhotoOut, status_code=201)
def upload_photo(
    post_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = db.get(Post, post_id)
    if not post:
        raise HTTPException(404, "Публикация не найдена")
    if post.author_id != current_user.id:
        raise HTTPException(403, "Недостаточно прав")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1] or ".jpg"
    file_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, file_name)
    with open(file_path, "wb") as f:
        f.write(file.file.read())

    width = height = None
    try:
        with Image.open(file_path) as img:
            width, height = img.size
    except Exception:
        pass

    photo = Photo(post_id=post_id, file_name=file_name, width=width, height=height)
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo


@router.delete("/{photo_id}", status_code=204)
def delete_photo(
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    photo = db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(404, "Фото не найдено")
    if photo.post.author_id != current_user.id:
        raise HTTPException(403, "Недостаточно прав")

    file_path = os.path.join(settings.UPLOAD_DIR, photo.file_name)
    if os.path.exists(file_path):
        os.remove(file_path)

    db.delete(photo)
    db.commit()
