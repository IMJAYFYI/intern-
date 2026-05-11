from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str
    debug_mode: bool
    weather_api_key: str

    class Config:
        env_file = ".env"

# Create a single instance to use across your app
settings = Settings()