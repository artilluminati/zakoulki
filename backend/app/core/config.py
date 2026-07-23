from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "Закоулки"
    API_V1_STR: str = "/api"
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/milnitsa"
    SECRET_KEY: str = "change-me-in-production-please"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    UPLOAD_DIR: str = "app/uploads"

    class Config:
        env_file = ".env"


settings = Settings()
