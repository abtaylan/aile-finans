"""Uygulama genelinde kullanilan ortam degiskeni tabanli ayarlar."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg2://user:pass@localhost:5432/aile_finans"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret_key: str = "change-me-in-env"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # TCMB / TEFAS worker ayarlari
    tcmb_evds_api_key: str | None = None
    tefas_fetch_enabled: bool = True

    model_config = SettingsConfigDict(env_file=".env", env_prefix="APP_", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
