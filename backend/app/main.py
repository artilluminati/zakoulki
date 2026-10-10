from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.api.routes import auth, users, cities, categories, threads, geo_places, admin, tags, citydata

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

api_prefix = settings.API_V1_STR
app.include_router(auth.router, prefix=api_prefix)
app.include_router(users.router, prefix=api_prefix)
app.include_router(cities.router, prefix=api_prefix)
app.include_router(categories.router, prefix=api_prefix)
app.include_router(threads.router, prefix=api_prefix)
app.include_router(geo_places.router, prefix=api_prefix)
app.include_router(admin.router, prefix=api_prefix)
app.include_router(tags.router, prefix=api_prefix)
app.include_router(citydata.router, prefix=api_prefix)


@app.get("/")
def root():
    return {"project": settings.PROJECT_NAME, "status": "ok"}
