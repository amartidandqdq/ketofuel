# POURQUOI: AI-powered routes (OpenAI) grouped together.

import base64
import logging

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

from ai_client import AIClient
from logger import dlog
from models import MealPlanRequest, RecipeRequest, AnalyzeRequest, SymptomsRequest
from storage import Storage
from routes.tracking import _patch_daily_log

router = APIRouter(prefix="/api")
log = logging.getLogger(__name__)
ai = AIClient()
db = Storage()

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


@router.post("/generate-plan")
@limiter.limit("5/minute")
async def generate_plan(request: Request, req: MealPlanRequest):
    try:
        profile = db.get_profile()
        result = await ai.generate_meal_plan(profile, req.days, req.preferences or "")
        return result
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        log.exception("Plan generation failed")
        dlog.error("ai", "[ERROR] generate_plan", {"error": str(e)})
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.post("/suggest-recipes")
@limiter.limit("5/minute")
async def suggest_recipes(request: Request, req: RecipeRequest):
    try:
        profile = db.get_profile()
        result = await ai.suggest_recipes(profile, req.ingredients, req.max_recipes, req.preferences or "")
        return result
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        log.exception("Recipe suggestion failed")
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.post("/analyze")
@limiter.limit("10/minute")
async def analyze_meal(request: Request, req: AnalyzeRequest):
    try:
        profile = db.get_profile()
        result = await ai.analyze_nutrition(profile, req.meal_description)
        return result
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        log.exception("Analysis failed")
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.post("/scan-label")
@limiter.limit("5/minute")
async def scan_label(request: Request, image: UploadFile = File(...), grams: float = Form(default=None)):
    try:
        if image.content_type not in ALLOWED_IMAGE_TYPES:
            return JSONResponse(status_code=400, content={"error": f"Unsupported image type: {image.content_type}. Use JPEG, PNG, WebP, or GIF."})
        if image.size and image.size > MAX_UPLOAD_BYTES:
            return JSONResponse(status_code=400, content={"error": "Image too large. Maximum 10 MB."})
        contents = await image.read()
        if len(contents) > MAX_UPLOAD_BYTES:
            return JSONResponse(status_code=400, content={"error": "Image too large. Maximum 10 MB."})
        profile = db.get_profile()
        image_b64 = base64.b64encode(contents).decode("utf-8")
        result = await ai.scan_nutrition_label(profile, image_b64, grams, image.content_type or "image/jpeg")
        return result
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        log.exception("Label scan failed")
        dlog.error("ai", "[ERROR] scan_label", {"error": str(e)})
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.post("/symptoms")
async def check_symptoms(data: SymptomsRequest):
    try:
        profile = db.get_profile()
        from datetime import date
        _patch_daily_log(date.today().isoformat(), symptoms=data.symptoms)
        result = await ai.check_keto_flu(profile, data.symptoms)
        return result
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        log.exception("Symptom check failed")
        dlog.error("ai", "[ERROR] check_symptoms", {"error": str(e)})
        return JSONResponse(status_code=500, content={"error": str(e)})
