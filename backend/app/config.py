from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "多智星 API"
    debug: bool = True
    database_url: str = "sqlite+aiosqlite:///./quant_trader.db"
    secret_key: str = "change-me-to-a-secure-random-key-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24h

    # Data sources
    default_data_source: str = "yahoo"
    binance_api_key: str = ""
    binance_secret_key: str = ""

    # Default risk params
    default_slippage: float = 0.0004
    default_commission: float = 0.0006
    default_currency: str = "USD"
    max_drawdown_limit: float = 10.0
    max_daily_loss_limit: float = 3.0

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
