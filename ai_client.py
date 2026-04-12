import json
import logging
from openai import AsyncOpenAI
from config import OPENAI_API_KEY, OPENAI_MODEL, OPENAI_BASE_URL

log = logging.getLogger(__name__)

DIET_DESCRIPTIONS = {
    "carnivore": "Carnivore - zero carb, meat/fish/eggs only, no plant foods",
    "ultra_keto": "Ultra Keto - extremely low carb (<5g net), very high fat, deep ketosis",
    "strict_keto": "Strict Keto - very low carb (<10g net), high fat, moderate protein",
    "keto_omad": "Keto OMAD - strict ketogenic macros (<20g net carbs) packed into ONE single daily meal. Prioritize high-fat whole foods (avocado, fatty fish, olive oil, butter, nuts, eggs, cheese, fatty cuts of meat). Always track net carbs (total carbs minus fiber). The single meal must be nutrient-dense enough to sustain a 23-hour fast.",
    "lazy_keto": "Lazy Keto - relaxed low carb (<30g net), high fat, flexible tracking",
    "keto_lite": "Keto Lite - moderate low carb (<50g net), balanced fat, flexible lifestyle approach",
    "omad": "One Meal A Day (OMAD) - all daily nutrition in a single meal",
    "keto": "Ketogenic - very low carb (<20g net), high fat, moderate protein",
    "paleo": "Paleo - whole foods, no grains/dairy/processed foods",
    "mediterranean": "Mediterranean - olive oil, fish, whole grains, vegetables",
    "standard": "Standard balanced diet",
    "custom": "Custom macro ratios",
}

KETO_DIET_TYPES = {"keto", "keto_omad", "carnivore", "ultra_keto", "strict_keto", "lazy_keto", "keto_lite"}

KETO_OMAD_RULES = """\
KETO OMAD RULES (strictly enforce):
- NET CARBS must stay under 20g (net = total carbs - fiber)
- Always report both total carbs AND fiber so net carbs can be calculated
- Fat is the primary fuel source (70%+ of calories)
- Protein is moderate — enough for muscle preservation, not excess (gluconeogenesis)
- ONE meal per day — it must be substantial, satisfying, and nutrient-dense
- Favor: fatty fish, ribeye, eggs, avocado, olive oil, butter, MCT oil, nuts, leafy greens, cheese
- Avoid: sugar, grains, starchy vegetables, seed oils, fruit (except small berries)
- Include electrolytes context: sodium, potassium, magnesium are critical on keto
"""


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
        is_keto = profile.get("diet_type", "") in KETO_DIET_TYPES
        keto_rules = KETO_OMAD_RULES if is_keto else ""
        meal_note = "Generate exactly ONE substantial meal per day. This single meal must pack ALL daily nutrition into one satisfying plate." if is_omad else "Generate appropriate meals to meet daily targets."

        role = "expert ketogenic nutritionist and chef specializing in OMAD (One Meal A Day) protocols" if is_keto else "expert nutritionist and chef"

        system = f"""You are an {role}.

User Profile:
{ctx}

{keto_rules}

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
          "nutrition": {{"calories": 0, "protein_g": 0, "fat_g": 0, "carbs_g": 0, "fiber_g": 0, "net_carbs_g": 0}},
          "prep_time_minutes": 0
        }}
      ],
      "daily_totals": {{"calories": 0, "protein_g": 0, "fat_g": 0, "carbs_g": 0, "fiber_g": 0, "net_carbs_g": 0}}
    }}
  ],
  "shopping_list": [{{"item": "ingredient", "quantity": "total amount"}}],
  "tips": ["helpful tip about keto OMAD lifestyle"]
}}

{"CRITICAL: net_carbs_g = carbs_g - fiber_g. Net carbs MUST be under 20g per day." if is_keto else ""}
Be precise with nutritional values. Make meals{"rich, satisfying, and keto-compliant" if is_keto else " delicious and practical"}."""

        user_msg = f"Generate a {days}-day meal plan."
        if preferences:
            user_msg += f" Additional preferences: {preferences}"

        raw = await _chat(profile.get("api_key", ""), system, user_msg)
        return _parse_json(raw)

    async def suggest_recipes(self, profile: dict, ingredients: list[str], max_recipes: int = 3, preferences: str = "") -> dict:
        ctx = _build_profile_context(profile)
        is_keto = profile.get("diet_type", "") in KETO_DIET_TYPES
        keto_rules = KETO_OMAD_RULES if is_keto else ""

        system = f"""You are an expert {"keto chef" if is_keto else "chef and nutritionist"}. Suggest recipes using the provided ingredients{" that are strictly keto-compliant" if is_keto else ""}.

User Profile:
{ctx}

{keto_rules}

Return valid JSON:
{{
  "recipes": [
    {{
      "name": "recipe name",
      "description": "brief description",
      "uses_ingredients": ["which provided ingredients are used"],
      "additional_ingredients": [{{"item": "name", "quantity": "amount"}}],
      "steps": ["step 1", "step 2"],
      "nutrition": {{"calories": 0, "protein_g": 0, "fat_g": 0, "carbs_g": 0, "fiber_g": 0, "net_carbs_g": 0}},
      "prep_time_minutes": 0,
      "difficulty": "easy|medium|hard"
    }}
  ]
}}

{"All recipes MUST have net_carbs_g under 20g. Prioritize high-fat, satisfying meals." if is_keto else "Prioritize recipes that use the most provided ingredients. Be creative but respect dietary constraints."} Max {max_recipes} recipes."""

        user_msg = f"Available ingredients: {', '.join(ingredients)}"
        if preferences:
            user_msg += f"\nPreferences: {preferences}"

        raw = await _chat(profile.get("api_key", ""), system, user_msg)
        return _parse_json(raw)

    async def analyze_nutrition(self, profile: dict, meal_description: str) -> dict:
        ctx = _build_profile_context(profile)
        is_keto = profile.get("diet_type", "") in KETO_DIET_TYPES

        system = f"""You are a {"keto nutrition analyst" if is_keto else "nutrition analyst"}. Analyze the described meal{"for keto OMAD compliance" if is_keto else ""}.

User Profile:
{ctx}

{"IMPORTANT: Check net carbs (total carbs - fiber). Flag if over 20g. Assess if this meal provides enough fat and nutrients for a full day of fasting." if is_keto else ""}

Return valid JSON:
{{
  "meal_name": "identified meal name",
  "components": [
    {{"item": "food item", "estimated_quantity": "amount", "calories": 0, "protein_g": 0, "fat_g": 0, "carbs_g": 0, "fiber_g": 0, "net_carbs_g": 0}}
  ],
  "totals": {{"calories": 0, "protein_g": 0, "fat_g": 0, "carbs_g": 0, "fiber_g": 0, "net_carbs_g": 0}},
  "diet_compliance": {{
    "fits_diet": true,
    "net_carbs_ok": true,
    "notes": "{"keto compliance assessment — focus on net carbs and fat ratio" if is_keto else "diet compliance assessment"}"
  }},
  "suggestions": ["{"keto-specific improvement suggestions" if is_keto else "improvement suggestions"}"]
}}

{"Be precise. net_carbs_g = carbs_g - fiber_g for each component and totals." if is_keto else "Be as accurate as possible with nutritional estimates based on standard serving sizes."}"""

        raw = await _chat(profile.get("api_key", ""), system, f"Analyze this meal: {meal_description}")
        return _parse_json(raw)

    async def scan_nutrition_label(self, profile: dict, image_b64: str, serving_grams: float = None, mime_type: str = "image/jpeg") -> dict:
        ctx = _build_profile_context(profile)
        serving_note = f"The user ate {serving_grams}g of this product. Scale the nutritional values accordingly." if serving_grams else "Extract the values as shown on the label."

        client = _get_client(profile.get("api_key", ""))
        resp = await client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": f"""You are a nutrition label OCR expert. Extract all nutritional information from this food label photo.

User Profile:
{ctx}

{serving_note}

Return valid JSON:
{{
  "product_name": "identified product name or 'Unknown'",
  "serving_size": "as stated on label",
  "user_portion_g": {serving_grams if serving_grams is not None else 'null'},
  "nutrition": {{
    "calories": 0,
    "fat_g": 0,
    "saturated_fat_g": 0,
    "protein_g": 0,
    "carbs_g": 0,
    "fiber_g": 0,
    "sugar_g": 0,
    "net_carbs_g": 0,
    "sodium_mg": 0
  }},
  "keto_verdict": {{
    "is_keto_friendly": true,
    "net_carbs_per_serving": 0,
    "notes": "brief keto assessment"
  }},
  "raw_text": "OCR text extracted from the label"
}}

net_carbs_g = carbs_g - fiber_g. If the user specified a portion in grams, scale ALL values from the label's per-100g or per-serving to match the user's portion."""},
                {"role": "user", "content": [
                    {"type": "text", "text": "Extract nutritional info from this label:"},
                    {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{image_b64}"}}
                ]}
            ],
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        return _parse_json(resp.choices[0].message.content)

    async def check_keto_flu(self, profile: dict, symptoms: list[str]) -> dict:
        ctx = _build_profile_context(profile)
        system = f"""You are a keto health advisor. The user is experiencing symptoms during their keto transition.

User Profile:
{ctx}

Return valid JSON:
{{
  "diagnosis": "brief assessment of likely cause",
  "severity": "mild|moderate|severe",
  "likely_causes": ["cause 1", "cause 2"],
  "remedies": [
    {{"action": "what to do", "why": "brief explanation"}}
  ],
  "warning": "any red flags requiring medical attention, or null"
}}

Be practical. Most keto flu symptoms are electrolyte-related. Suggest specific amounts (mg of sodium, etc)."""

        raw = await _chat(profile.get("api_key", ""), system, f"Symptoms: {', '.join(symptoms)}")
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
