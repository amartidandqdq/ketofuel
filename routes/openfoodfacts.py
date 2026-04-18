# POURQUOI: Open Food Facts integration — barcode lookup and food search from public database.

import re
import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api")

OFF_API = "https://world.openfoodfacts.org"
OFF_SEARCH = f"{OFF_API}/cgi/search.pl"
TIMEOUT = 8.0


def _extract_nutrition(product: dict) -> dict:
    """Extract standardized nutrition from OFF product data."""
    n = product.get("nutriments", {})
    name = product.get("product_name", "Unknown")
    brands = product.get("brands", "")
    serving = product.get("serving_size", "100g")
    image = product.get("image_front_small_url", "")

    return {
        "name": f"{name} ({brands})" if brands else name,
        "barcode": product.get("code", ""),
        "serving_size": serving,
        "image_url": image,
        "nutrition": {
            "calories": round(n.get("energy-kcal_100g", 0)),
            "fat_g": round(n.get("fat_100g", 0), 1),
            "protein_g": round(n.get("proteins_100g", 0), 1),
            "carbs_g": round(n.get("carbohydrates_100g", 0), 1),
            "fiber_g": round(n.get("fiber_100g", 0), 1),
            "sugar_g": round(n.get("sugars_100g", 0), 1),
            "sodium_mg": round(n.get("sodium_100g", 0) * 1000, 0),
            "net_carbs_g": round(max(0, n.get("carbohydrates_100g", 0) - n.get("fiber_100g", 0)), 1),
        },
        "nutriscore": product.get("nutriscore_grade", ""),
        "categories": product.get("categories", ""),
    }


@router.get("/barcode/{code}")
async def barcode_lookup(code: str):
    """Look up a product by barcode via Open Food Facts."""
    # POURQUOI: Validate barcode format to prevent path traversal / SSRF
    if not re.match(r"^\d{8,14}$", code):
        return JSONResponse(status_code=400, content={"error": "Invalid barcode format. Must be 8-14 digits."})
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.get(f"{OFF_API}/api/v2/product/{code}.json",
                                 headers={"User-Agent": "KetoFuel/1.0"})
        if r.status_code != 200:
            return JSONResponse(status_code=404, content={"error": "Product not found"})
        data = r.json()
        if data.get("status") != 1:
            return JSONResponse(status_code=404, content={"error": "Product not found in database"})
        return _extract_nutrition(data["product"])
    except httpx.TimeoutException:
        return JSONResponse(status_code=504, content={"error": "Open Food Facts timeout"})


@router.get("/food-search")
async def food_search(q: str = "", page: int = 1, page_size: int = 12):
    """Search Open Food Facts for foods by name."""
    if not q or len(q) < 2:
        return {"products": [], "total": 0}
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.get(OFF_SEARCH, params={
                "search_terms": q, "json": 1, "page": page, "page_size": page_size, "cc": "fr",
                "fields": "code,product_name,brands,nutriments,serving_size,image_front_small_url,nutriscore_grade,categories",
            }, headers={"User-Agent": "KetoFuel/1.0"})
        if r.status_code != 200:
            return {"products": [], "total": 0}
        data = r.json()
        products = [_extract_nutrition(p) for p in data.get("products", []) if p.get("product_name")]
        return {"products": products, "total": data.get("count", 0), "page": page}
    except httpx.TimeoutException:
        return JSONResponse(status_code=504, content={"error": "Search timeout"})
