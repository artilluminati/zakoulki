from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "Zakoulki"
    API_V1_STR: str = "/api"
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/soap"
    SECRET_KEY: str = "change-me-in-production-please"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    UPLOAD_DIR: str = "app/uploads"
    YANDEX_GEOCODER_KEY: str = ""
    # CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000", "http://192.168.1.13:3000"]
    CORS_ORIGINS: list[str] = ["*"]

    class Config:
        env_file = ".env"


settings = Settings()
