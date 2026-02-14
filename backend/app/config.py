from typing import List
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Application
    app_name: str = "WebAPI Moderator"
    debug: bool = True

    # Database (SQLite by default for easy local dev)
    database_url: str = "sqlite+aiosqlite:///./webapi_moderator.db"

    # Proxy
    proxy_host: str = "0.0.0.0"
    proxy_port: int = 8080
    proxy_ssl_insecure: bool = True

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: List[str] = ["http://localhost:3000"]

    # Certificates
    cert_dir: str = "./certs"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
