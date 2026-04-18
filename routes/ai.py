# POURQUOI: AI-powered routes (Gemini) grouped together.

import base64
import logging

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

from ai_client import AIClient, AIError
from errors import E
from logger import dlog
from models import MealPlanRequest, RecipeRequest, AnalyzeRequest, SymptomsRequest, DailyLog, Exercise
from storage import Storage

router = APIRouter(prefix="/api")
log = logging.getLogger(__name__)
ai = AIClient()
db = Storage()

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def _ai_error(action: str, exc: AIError) -> JSONResponse:
    """Map AIError code -> structured 4xx/5xx with code+fix."""
    dlog.error("ai", str(exc), {"code": exc.code, "action": action, "fix": exc.fix,
                                 "error": str(exc.original) if exc.original else None})
    status = 503 if exc.code in ("AI_001", "AI_002", "AI_004") else 500
    return JSONResponse(status_code=status, content={
        "error": str(exc), "code": exc.code, "fix": exc.fix,
    })




@router.post("/generate-plan")
@limiter.limit("5/minute")
async def generate_plan(request: Request, req: MealPlanRequest):
    try:
        profile = db.get_profile()
        result = await ai.generate_meal_plan(profile, req.days, req.preferences or "")
        return result
    except AIError as e:
        return _ai_error("generate_plan", e)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e), "code": "VALID_002", "fix": E["VALID_002"]["fix"]})
    except Exception as e:
        log.exception("Plan generation failed")
        dlog.error("ai", "[ERROR] generate_plan", {"code": "AI_005", "action": "generate_plan", "fix": E["AI_005"]["fix"], "error": str(e)})
        return JSONResponse(status_code=500, content={"error": "AI service error. Please try again.", "code": "AI_005", "fix": E["AI_005"]["fix"]})


@router.post("/suggest-recipes")
@limiter.limit("5/minute")
async def suggest_recipes(request: Request, req: RecipeRequest):
    try:
        profile = db.get_profile()
        result = await ai.suggest_recipes(profile, req.ingredients, req.max_recipes, req.preferences or "")
        return result
    except AIError as e:
        return _ai_error("suggest_recipes", e)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e), "code": "VALID_002", "fix": E["VALID_002"]["fix"]})
    except Exception as e:
        log.exception("Recipe suggestion failed")
        dlog.error("ai", "[ERROR] suggest_recipes", {"code": "AI_005", "action": "suggest_recipes", "fix": E["AI_005"]["fix"], "error": str(e)})
        return JSONResponse(status_code=500, content={"error": "AI service error. Please try again.", "code": "AI_005", "fix": E["AI_005"]["fix"]})


@router.post("/analyze")
@limiter.limit("10/minute")
async def analyze_meal(request: Request, req: AnalyzeRequest):
    try:
        profile = db.get_profile()
        result = await ai.analyze_nutrition(profile, req.meal_description)
        return result
    except AIError as e:
        return _ai_error("analyze_meal", e)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e), "code": "VALID_002", "fix": E["VALID_002"]["fix"]})
    except Exception as e:
        log.exception("Analysis failed")
        dlog.error("ai", "[ERROR] analyze_meal", {"code": "AI_005", "action": "analyze_meal", "fix": E["AI_005"]["fix"], "error": str(e)})
        return JSONResponse(status_code=500, content={"error": "AI service error. Please try again.", "code": "AI_005", "fix": E["AI_005"]["fix"]})


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
    except AIError as e:
        return _ai_error("scan_label", e)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e), "code": "VALID_002", "fix": E["VALID_002"]["fix"]})
    except Exception as e:
        log.exception("Label scan failed")
        dlog.error("ai", "[ERROR] scan_label", {"code": "AI_005", "action": "scan_label", "fix": E["AI_005"]["fix"], "error": str(e)})
        return JSONResponse(status_code=500, content={"error": "AI service error. Please try again.", "code": "AI_005", "fix": E["AI_005"]["fix"]})


@router.post("/symptoms")
async def check_symptoms(data: SymptomsRequest):
    try:
        profile = db.get_profile()
        from datetime import date
        today = date.today().isoformat()
        daily_log = db.get_daily_log(today)
        daily_log["symptoms"] = data.symptoms
        daily_log["date"] = today
        exercises = daily_log.get("exercises", [])
        if exercises and isinstance(exercises[0], dict):
            daily_log["exercises"] = [Exercise(**e) for e in exercises]
        db.update_daily_log(DailyLog(**daily_log))
        result = await ai.check_keto_flu(profile, data.symptoms)
        return result
    except AIError as e:
        return _ai_error("check_symptoms", e)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e), "code": "VALID_002", "fix": E["VALID_002"]["fix"]})
    except Exception as e:
        log.exception("Symptom check failed")
        dlog.error("ai", "[ERROR] check_symptoms", {"code": "AI_005", "action": "check_symptoms", "fix": E["AI_005"]["fix"], "error": str(e)})
        return JSONResponse(status_code=500, content={"error": "AI service error. Please try again.", "code": "AI_005", "fix": E["AI_005"]["fix"]})
