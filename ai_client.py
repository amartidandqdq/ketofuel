import json
import logging
from openai import AsyncOpenAI
from config import OPENAI_API_KEY, OPENAI_MODEL, OPENAI_BASE_URL

log = logging.getLogger(__name__)

DIET_DESCRIPTIONS = {
    "omad": "One Meal A Day (OMAD) - all daily nutrition in a single meal",
    "keto": "Ketogenic - very low carb (<20g net), high fat, moderate protein",
    "keto_omad": "Keto OMAD - ketogenic macros in a single daily meal",
    "paleo": "Paleo - whole foods, no grains/dairy/processed foods",
    "mediterranean": "Mediterranean - olive oil, fish, whole grains, vegetables",
    "standard": "Standard balanced diet",
    "custom": "Custom macro ratios",
}


def _build_profile_context(profile: dict) -> str:
    diet = profile.get("diet_type", "keto_omad")
    diet_desc = DIET_DESCRIPTIONS.get(diet, diet)
    cal = profile.get("calorie_target", 2000)
    p_ratio = profile.get("protein_ratio", 25)
    f_ratio = profile.get("fat_ratio", 70)
    c_ratio = profile.get("carb_ratio", 5)
    protein_g = round(cal * p_ratio / 100 / 4, 1)
    fat_g = round(cal * f_ratio / 100 / 9, 1)
    carbs_g = round(cal * c_ratio / 100 / 4, 1)

    lines = [
        f"Diet: {diet_desc}",
        f"Daily Calorie Target: {cal} kcal",
        f"Macros: {p_ratio}% protein ({protein_g}g), {f_ratio}% fat ({fat_g}g), {c_ratio}% carbs ({carbs_g}g)",
    ]
    if profile.get("allergies"):
        lines.append(f"Allergies: {', '.join(profile['allergies'])}")
    if profile.get("excluded_ingredients"):
        lines.append(f"Excluded ingredients: {', '.join(profile['excluded_ingredients'])}")
    if profile.get("cuisine_preferences"):
        lines.append(f"Cuisine preferences: {', '.join(profile['cuisine_preferences'])}")
    return "\n".join(lines)


def _get_client(api_key: str = "") -> AsyncOpenAI:
    key = api_key or OPENAI_API_KEY
    if not key:
        raise ValueError("No API key configured. Set it in Settings or in the .env file.")
    return AsyncOpenAI(api_key=key, base_url=OPENAI_BASE_URL)


async def _chat(api_key: str, system: str, user: str, temperature: float = 0.7) -> str:
    client = _get_client(api_key)
    resp = await client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=temperature,
        response_format={"type": "json_object"},
    )
    return resp.choices[0].message.content


async def _chat_text(api_key: str, system: str, user: str, temperature: float = 0.7) -> str:
    client = _get_client(api_key)
    resp = await client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=temperature,
    )
    return resp.choices[0].message.content


def _parse_json(raw: str) -> dict:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(raw[start:end])
        raise


class AIClient:
    async def generate_meal_plan(self, profile: dict, days: int = 1, preferences: str = "") -> dict:
        ctx = _build_profile_context(profile)
        is_omad = profile.get("diet_type", "") in ("omad", "keto_omad")
        meal_note = "Since this is an OMAD diet, generate exactly ONE substantial meal per day that meets the full daily nutritional targets." if is_omad else "Generate appropriate meals to meet daily targets."

        system = f"""You are an expert nutritionist and chef. Generate a detailed {days}-day meal plan.

User Profile:
{ctx}

{meal_note}

Return valid JSON:
{{
  "plan_name": "descriptive name",
  "days": [
    {{
      "day": 1,
      "meals": [
        {{
          "name": "meal name",
          "description": "brief description",
          "ingredients": [{{"item": "ingredient", "quantity": "amount with unit"}}],
          "steps": ["step 1", "step 2"],
          "nutrition": {{"calories": 0, "protein_g": 0, "fat_g": 0, "carbs_g": 0, "fiber_g": 0}},
          "prep_time_minutes": 0
        }}
      ],
      "daily_totals": {{"calories": 0, "protein_g": 0, "fat_g": 0, "carbs_g": 0, "fiber_g": 0}}
    }}
  ],
  "shopping_list": [{{"item": "ingredient", "quantity": "total amount"}}],
  "tips": ["helpful tip"]
}}

Be precise with nutritional values. Make meals delicious and practical."""

        user_msg = f"Generate a {days}-day meal plan."
        if preferences:
            user_msg += f" Additional preferences: {preferences}"

        raw = await _chat(profile.get("api_key", ""), system, user_msg)
        return _parse_json(raw)

    async def suggest_recipes(self, profile: dict, ingredients: list[str], max_recipes: int = 3, preferences: str = "") -> dict:
        ctx = _build_profile_context(profile)

        system = f"""You are an expert chef and nutritionist. Suggest recipes using the provided ingredients.

User Profile:
{ctx}

Return valid JSON:
{{
  "recipes": [
    {{
      "name": "recipe name",
      "description": "brief description",
      "uses_ingredients": ["which provided ingredients are used"],
      "additional_ingredients": [{{"item": "name", "quantity": "amount"}}],
      "steps": ["step 1", "step 2"],
      "nutrition": {{"calories": 0, "protein_g": 0, "fat_g": 0, "carbs_g": 0, "fiber_g": 0}},
      "prep_time_minutes": 0,
      "difficulty": "easy|medium|hard"
    }}
  ]
}}

Prioritize recipes that use the most provided ingredients. Be creative but respect dietary constraints. Max {max_recipes} recipes."""

        user_msg = f"Available ingredients: {', '.join(ingredients)}"
        if preferences:
            user_msg += f"\nPreferences: {preferences}"

        raw = await _chat(profile.get("api_key", ""), system, user_msg)
        return _parse_json(raw)

    async def analyze_nutrition(self, profile: dict, meal_description: str) -> dict:
        ctx = _build_profile_context(profile)

        system = f"""You are a nutrition analyst. Analyze the described meal and estimate its nutritional content.

User Profile:
{ctx}

Return valid JSON:
{{
  "meal_name": "identified meal name",
  "components": [
    {{"item": "food item", "estimated_quantity": "amount", "calories": 0, "protein_g": 0, "fat_g": 0, "carbs_g": 0, "fiber_g": 0}}
  ],
  "totals": {{"calories": 0, "protein_g": 0, "fat_g": 0, "carbs_g": 0, "fiber_g": 0}},
  "diet_compliance": {{
    "fits_diet": true,
    "notes": "explanation of how it fits or doesn't fit the diet"
  }},
  "suggestions": ["improvement suggestion"]
}}

Be as accurate as possible with nutritional estimates based on standard serving sizes."""

        raw = await _chat(profile.get("api_key", ""), system, f"Analyze this meal: {meal_description}")
        return _parse_json(raw)

    async def get_weight_insight(self, profile: dict, weights: list[dict]) -> dict:
        if len(weights) < 2:
            return {"insight": "Log at least 2 weight entries to get insights.", "trend": "insufficient_data"}

        ctx = _build_profile_context(profile)
        target = profile.get("target_weight_kg", 0)
        weight_data = "\n".join([f"  {w['date']}: {w['weight_kg']} kg" for w in weights[-14:]])

        system = f"""You are a health and fitness advisor. Analyze the user's weight trend.

User Profile:
{ctx}
Target weight: {target} kg

Return valid JSON:
{{
  "trend": "losing|gaining|stable|fluctuating",
  "avg_weekly_change_kg": 0,
  "estimated_target_date": "YYYY-MM-DD or null",
  "insight": "brief personalized insight",
  "recommendations": ["actionable recommendation"]
}}"""

        raw = await _chat(profile.get("api_key", ""), system, f"Weight log:\n{weight_data}")
        return _parse_json(raw)
