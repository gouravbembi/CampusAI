from typing import Literal

from fastapi import FastAPI, Response
from pydantic import BaseModel

app = FastAPI(title="CampusAI AI Service", version="0.1.0")


class Health(BaseModel):
    status: Literal["ok"]
    service: Literal["ai"]


@app.get("/health")
def health(response: Response) -> Health:
    response.headers["Cache-Control"] = "no-store"
    return Health(status="ok", service="ai")
