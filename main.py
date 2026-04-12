# POURQUOI: Entry point only — all routes in routes/ package for <200 line rule.

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.base import BaseHTTPMiddleware

from config import APP_HOST, APP_PORT, CORS_ORIGINS
from logger import dlog
from routes import profile, ai, meals, tracking, weight, ketosis, dashboard


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


app = FastAPI(title="KetoFuel", version="1.0.0")
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Mount all route modules
app.include_router(profile.router)
app.include_router(ai.router)
app.include_router(meals.router)
app.include_router(tracking.router)
app.include_router(weight.router)
app.include_router(ketosis.router)
app.include_router(dashboard.router)

dlog.info("main", "[STARTUP] KetoFuel app initialized", {"host": APP_HOST, "port": APP_PORT})


@app.get("/")
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


if __name__ == "__main__":
    uvicorn.run("main:app", host=APP_HOST, port=APP_PORT, reload=True)
