from pydantic import BaseModel
from typing import Optional
from enum import Enum


class DietType(str, Enum):
    OMAD = "omad"
    KETO = "keto"
    KETO_OMAD = "keto_omad"
    PALEO = "paleo"
    MEDITERRANEAN = "mediterranean"
    STANDARD = "standard"
    CUSTOM = "custom"


class UserProfile(BaseModel):
    name: str = ""
    diet_type: DietType = DietType.KETO_OMAD
    calorie_target: int = 2000
    protein_ratio: float = 25.0
    fat_ratio: float = 70.0
    carb_ratio: float = 5.0
    allergies: list[str] = []
    cuisine_preferences: list[str] = []
    excluded_ingredients: list[str] = []
    height_cm: float = 0
    current_weight_kg: float = 0
    target_weight_kg: float = 0
    api_key: str = ""


class MealPlanRequest(BaseModel):
    days: int = 1
    preferences: Optional[str] = None


class RecipeRequest(BaseModel):
    ingredients: list[str]
    max_recipes: int = 3
    preferences: Optional[str] = None


class AnalyzeRequest(BaseModel):
    meal_description: str


class MealLog(BaseModel):
    id: Optional[str] = None
    date: str
    meal_name: str = ""
    meal_description: str
    calories: Optional[float] = None
    protein_g: Optional[float] = None
    fat_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fiber_g: Optional[float] = None
    notes: Optional[str] = None


class WeightEntry(BaseModel):
    date: str
    weight_kg: float
    notes: Optional[str] = None
