from fastapi import FastAPI
from app.router import register_routes
import logging


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)


app = FastAPI()

app.include_router(register_routes("routes"))
