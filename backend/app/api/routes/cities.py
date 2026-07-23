from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.city import City
from app.schemas.city import CityOut

router = APIRouter(prefix="/cities", tags=["cities"])


@router.get("", response_model=list[CityOut])
def list_cities(db: Session = Depends(get_db)):
    return db.query(City).all()


@router.get("/{slug}", response_model=CityOut)
def get_city(slug: str, db: Session = Depends(get_db)):
    city = db.query(City).filter(City.slug == slug).first()
    if not city:
        raise HTTPException(404, "Город не найден")
    return city
