from pydantic import BaseModel
from typing import Optional
from enum import Enum


class DietType(str, Enum):
    CARNIVORE = "carnivore"
    ULTRA_KETO = "ultra_keto"
    STRICT_KETO = "strict_keto"
    KETO_OMAD = "keto_omad"
    LAZY_KETO = "lazy_keto"
    KETO_LITE = "keto_lite"
    OMAD = "omad"
    KETO = "keto"
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
    sex: str = "male"
    age: int = 30
    activity_level: float = 1.375
    height_cm: float = 0
    current_weight_kg: float = 0
    target_weight_kg: float = 0
    keto_start_date: str = ""
    net_carb_limit: int = 20
    fasting_goal_hours: int = 23
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


class Exercise(BaseModel):
    type: str
    minutes: int = 0
    bonus_days: float = 0


class DailyLog(BaseModel):
    date: str
    water_glasses: int = 0
    sodium_mg: int = 0
    potassium_mg: int = 0
    magnesium_mg: int = 0
    symptoms: list[str] = []
    exercises: list[Exercise] = []


class SymptomsRequest(BaseModel):
    symptoms: list[str]


class ExerciseLogRequest(BaseModel):
    type: str


class GroceryItem(BaseModel):
    item: str
    quantity: str = ""
    checked: bool = False


class GroceryList(BaseModel):
    name: str = ""
    items: list[GroceryItem] = []


class SavedPlan(BaseModel):
    plan_name: str = ""
    days: list = []
    shopping_list: list = []
    tips: list[str] = []
