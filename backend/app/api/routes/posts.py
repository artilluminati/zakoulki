from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.post import Post
from app.models.user import User
from app.schemas.post import PostCreate, PostUpdate, PostOut
from app.api.deps import get_current_user

router = APIRouter(prefix="/posts", tags=["posts"])


@router.get("", response_model=list[PostOut])
def list_posts(place_id: int | None = Query(None), db: Session = Depends(get_db)):
    q = db.query(Post)
    if place_id:
        q = q.filter(Post.place_id == place_id)
    return q.order_by(Post.created_at.desc()).all()


@router.get("/{post_id}", response_model=PostOut)
def get_post(post_id: int, db: Session = Depends(get_db)):
    post = db.get(Post, post_id)
    if not post:
        raise HTTPException(404, "Публикация не найдена")
    return post


@router.post("", response_model=PostOut, status_code=201)
def create_post(
    data: PostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = Post(place_id=data.place_id, author_id=current_user.id, title=data.title, text=data.text)
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


@router.patch("/{post_id}", response_model=PostOut)
def update_post(
    post_id: int,
    data: PostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = db.get(Post, post_id)
    if not post:
        raise HTTPException(404, "Публикация не найдена")
    if post.author_id != current_user.id:
        raise HTTPException(403, "Недостаточно прав")
    if data.title is not None:
        post.title = data.title
    if data.text is not None:
        post.text = data.text
    db.commit()
    db.refresh(post)
    return post


@router.delete("/{post_id}", status_code=204)
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = db.get(Post, post_id)
    if not post:
        raise HTTPException(404, "Публикация не найдена")
    if post.author_id != current_user.id:
        raise HTTPException(403, "Недостаточно прав")
    db.delete(post)
    db.commit()
