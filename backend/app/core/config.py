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

    # --- адреса сайта (нужны в письмах и ссылках оплаты) ---
    SITE_URL: str = "http://localhost:3001"          # публичный адрес фронта
    API_URL: str = "http://127.0.0.1:8000"            # публичный адрес бэка (для вебхуков)

    # --- почта (SMTP; для Яндекса: smtp.yandex.ru:587, пароль приложения) ---
    MAIL_ENABLED: bool = False
    MAIL_HOST: str = "smtp.yandex.ru"
    MAIL_PORT: int = 587
    MAIL_USER: str = ""          # полный адрес, напр. zakoulki@yandex.ru
    MAIL_PASSWORD: str = ""      # пароль приложения
    MAIL_USE_TLS: bool = True
    MAIL_FROM: str = ""          # если пусто — берётся MAIL_USER
    MAIL_FROM_NAME: str = "Закоулки"
    MAIL_TIMEOUT: int = 20

    # --- ЮKassa (только донаты на старте) ---
    YOOKASSA_ENABLED: bool = False
    YOOKASSA_SHOP_ID: str = ""
    YOOKASSA_SECRET_KEY: str = ""
    YOOKASSA_RETURN_URL: str = ""   # куда вернуть пользователя после оплаты
    DONATION_BADGE_MIN: int = 100        # от какой суммы выдаётся бейдж «Спонсор проекта»
    DONATION_MIN: int = 50
    DONATION_MAX: int = 100000

    class Config:
        env_file = ".env"


settings = Settings()
