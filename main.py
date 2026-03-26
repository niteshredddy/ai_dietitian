import os
import io
import csv
import logging
from datetime import datetime, timedelta, timezone

import numpy as np
import cv2
import jwt
import mysql.connector.pooling
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from passlib.context import CryptContext
from pymongo import MongoClient
from bson import ObjectId
from ultralytics import YOLO
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from pydantic import BaseModel, EmailStr
from typing import Optional
from fpdf import FPDF
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# ──────────────────────────────────────────────
# 1. CONFIG & LOGGING
# ──────────────────────────────────────────────
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="NutriVision Pro")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CORS_ORIGIN", "http://localhost:5173"), "*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
JWT_SECRET = os.getenv("JWT_SECRET", "fallback_secret_key")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 72
security = HTTPBearer()

# ──────────────────────────────────────────────
# 2. LOAD AI MODELS (once at startup)
# ──────────────────────────────────────────────
try:
    logger.info("🚀 Loading YOLOv11 and SentenceTransformer...")
    yolo_model = YOLO("best.pt")
    vector_model = SentenceTransformer('all-MiniLM-L6-v2')
    db_vectors = np.load("food_vectors.npy")
    db_codes = np.load("food_codes.npy")
    logger.info(f"✅ Loaded {len(db_vectors)} semantic food vectors.")
except Exception as e:
    logger.error(f"❌ AI Init Error: {e}")

# ──────────────────────────────────────────────
# 3. DATABASE CONNECTIONS
# ──────────────────────────────────────────────
# MySQL — FNDDS reference data
db_config = {
    "host": os.getenv("DB_HOST", "localhost"),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "ai_dietician_db"),
}
db_pool = mysql.connector.pooling.MySQLConnectionPool(
    pool_name="diet_pool", pool_size=5, **db_config
)

# MongoDB Atlas — users, meal logs, analytics
mongo_client = MongoClient(os.getenv("MONGO_URI"))
mongo_db = mongo_client[os.getenv("MONGO_DB_NAME", "nutrivision")]
users_col = mongo_db["users"]
profiles_col = mongo_db["profiles"]
meals_col = mongo_db["meals"]

# Create indexes
users_col.create_index("email", unique=True)
meals_col.create_index([("user_id", 1), ("logged_at", -1)])

logger.info("✅ MySQL + MongoDB Atlas connected.")


# ──────────────────────────────────────────────
# 4. PYDANTIC MODELS
# ──────────────────────────────────────────────
class RegisterBody(BaseModel):
    username: str
    email: str
    password: str

class LoginBody(BaseModel):
    email: str
    password: str

class ProfileBody(BaseModel):
    weight_kg: float
    height_cm: float
    age: int
    gender: str          # "male" | "female"
    activity_level: str  # "sedentary" | "light" | "moderate" | "active" | "very_active"

class MealLogBody(BaseModel):
    food_code: int
    food_name: str
    calories: float
    protein: float
    carbs: float
    fat: float
    portion_size: float = 1.0
    nutrients: dict = {}
    recommendations: list = []


# ──────────────────────────────────────────────
# 5. AUTH HELPERS
# ──────────────────────────────────────────────
def create_token(user_id: str, username: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {"user_id": payload["sub"], "username": payload["username"]}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_mysql_connection():
    return db_pool.get_connection()


# ──────────────────────────────────────────────
# 6. AUTH ENDPOINTS
# ──────────────────────────────────────────────
@app.post("/register")
async def register(body: RegisterBody):
    if users_col.find_one({"email": body.email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    user_doc = {
        "username": body.username,
        "email": body.email,
        "password_hash": pwd_ctx.hash(body.password),
        "created_at": datetime.now(timezone.utc),
    }
    result = users_col.insert_one(user_doc)
    token = create_token(str(result.inserted_id), body.username)
    return {"status": "success", "token": token, "username": body.username}


@app.post("/login")
async def login(body: LoginBody):
    user = users_col.find_one({"email": body.email})
    if not user or not pwd_ctx.verify(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token(str(user["_id"]), user["username"])
    return {"status": "success", "token": token, "username": user["username"]}


# ──────────────────────────────────────────────
# 7. PROFILE ENDPOINTS
# ──────────────────────────────────────────────
@app.get("/profile")
async def get_profile(user=Depends(get_current_user)):
    profile = profiles_col.find_one({"user_id": user["user_id"]})
    if not profile:
        return {"status": "empty"}
    profile["_id"] = str(profile["_id"])
    return {"status": "success", "profile": profile}


@app.put("/profile")
async def update_profile(body: ProfileBody, user=Depends(get_current_user)):
    profile_data = body.model_dump()
    profile_data["user_id"] = user["user_id"]
    profile_data["updated_at"] = datetime.now(timezone.utc)

    profiles_col.update_one(
        {"user_id": user["user_id"]},
        {"$set": profile_data},
        upsert=True,
    )
    return {"status": "success", "message": "Profile updated"}


@app.get("/daily-goal")
async def get_daily_goal(user=Depends(get_current_user)):
    profile = profiles_col.find_one({"user_id": user["user_id"]})
    if not profile:
        return {"status": "success", "daily_goal": 2500, "source": "default"}

    # Mifflin-St Jeor Equation
    w = profile["weight_kg"]
    h = profile["height_cm"]
    a = profile["age"]
    if profile["gender"] == "male":
        bmr = 10 * w + 6.25 * h - 5 * a + 5
    else:
        bmr = 10 * w + 6.25 * h - 5 * a - 161

    multipliers = {
        "sedentary": 1.2, "light": 1.375, "moderate": 1.55,
        "active": 1.725, "very_active": 1.9,
    }
    tdee = bmr * multipliers.get(profile["activity_level"], 1.55)
    return {"status": "success", "daily_goal": round(tdee), "bmr": round(bmr), "source": "calculated"}


# ──────────────────────────────────────────────
# 8. FOOD ANALYSIS (core endpoint — enhanced)
# ──────────────────────────────────────────────
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/jpg"}


def generate_recommendations(protein, carbs, fat, calories, daily_goal):
    """Rule-based AI diet recommendations."""
    tips = []
    total_macros = protein + carbs + fat
    if total_macros == 0:
        return tips

    prot_pct = (protein * 4 / calories * 100) if calories > 0 else 0
    carb_pct = (carbs * 4 / calories * 100) if calories > 0 else 0
    fat_pct = (fat * 9 / calories * 100) if calories > 0 else 0

    # Macro balance
    if prot_pct < 15:
        tips.append({"type": "warning", "icon": "🥩", "text": "This meal is low in protein. Consider adding eggs, chicken, lentils, or Greek yogurt."})
    elif prot_pct > 40:
        tips.append({"type": "info", "icon": "💪", "text": "High protein meal! Great for muscle recovery and satiety."})

    if carb_pct > 65:
        tips.append({"type": "warning", "icon": "🍞", "text": "High in carbs. Balance with protein or healthy fats to avoid energy spikes."})

    if fat_pct > 50:
        tips.append({"type": "warning", "icon": "🧈", "text": "High fat content. Opt for unsaturated fats from nuts, avocado, or olive oil."})

    # Calorie check
    if calories > 800:
        tips.append({"type": "caution", "icon": "🔥", "text": f"This is a calorie-dense meal ({calories:.0f} kcal). Consider smaller portions."})
    elif calories < 200:
        tips.append({"type": "info", "icon": "🥗", "text": "Light meal — great as a snack. You may still need a fuller meal later."})

    # Daily goal context
    if daily_goal and calories > daily_goal * 0.5:
        tips.append({"type": "caution", "icon": "⚠️", "text": f"This meal covers over 50% of your daily target ({daily_goal} kcal)."})

    # General tips
    if protein > 0 and fat > 0 and carbs > 0:
        if 20 <= prot_pct <= 35 and 25 <= fat_pct <= 35 and 40 <= carb_pct <= 55:
            tips.append({"type": "success", "icon": "✅", "text": "Well-balanced meal! Good distribution of macronutrients."})

    if not tips:
        tips.append({"type": "success", "icon": "👍", "text": "Looks like a reasonable meal. Keep it up!"})

    return tips


@app.post("/analyze")
async def analyze_food(
    file: UploadFile = File(...),
    portion_size: float = Query(1.0, ge=0.25, le=5.0),
    user=Depends(get_current_user),
):
    # A. VALIDATE INPUT
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WebP images are allowed.")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Image must be under 10 MB.")

    try:
        # B. IMAGE PROCESSING
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # C. YOLOv11 DETECTION (top-3 for multi-food)
        results = yolo_model.predict(img, conf=0.25)
        if not results[0].probs:
            raise HTTPException(status_code=400, detail="No food detected in the image.")

        probs = results[0].probs
        top_indices = probs.top5[:3]  # Top 3 predictions
        top_foods = []

        for idx in top_indices:
            raw_label = results[0].names[idx]
            confidence = float(probs.data[idx])
            if confidence < 0.1:
                continue
            clean_name = raw_label.lower().replace("_", " ")

            # D. SEMANTIC SEARCH
            query_vector = vector_model.encode([clean_name])
            similarities = cosine_similarity(query_vector, db_vectors)[0]
            best_match_idx = np.argmax(similarities)
            similarity_score = float(similarities[best_match_idx])
            matched_food_code = int(db_codes[best_match_idx])

            # E. DATABASE RETRIEVAL
            conn = get_mysql_connection()
            cursor = conn.cursor(dictionary=True)

            cursor.execute("SELECT main_description FROM main_food_desc WHERE food_code = %s", (matched_food_code,))
            food_meta = cursor.fetchone()

            cursor.execute("""
                SELECT nutrient_code, nutrient_value 
                FROM nutrient_values WHERE food_code = %s
            """, (matched_food_code,))
            nutrient_rows = cursor.fetchall()
            cursor.close()
            conn.close()

            nutrition_facts = {}
            for row in nutrient_rows:
                val = float(row['nutrient_value']) * portion_size
                nutrition_facts[str(row['nutrient_code'])] = round(val, 2)

            top_foods.append({
                "label": clean_name.title(),
                "confidence": f"{confidence * 100:.2f}%",
                "database_match": {
                    "name": food_meta['main_description'] if food_meta else clean_name.title(),
                    "similarity": f"{similarity_score * 100:.2f}%",
                    "food_code": matched_food_code,
                },
                "nutrition_facts": nutrition_facts,
            })

        if not top_foods:
            raise HTTPException(status_code=400, detail="No food detected in the image.")

        # Use primary (top-1) for nutrient extraction
        primary = top_foods[0]
        nf = primary["nutrition_facts"]

        # Extract macros with portion
        energy_keys = ['208', 'Energy (kcal)', 'Energy']
        protein_keys = ['203', 'Protein (g)', 'Protein']
        carb_keys = ['205', 'Carbohydrate (g)', 'Carbohydrate']
        fat_keys = ['204', 'Total Fat (g)', 'Total lipid (fat) (g)']

        def get_nutrient(keys):
            for k in keys:
                if k in nf:
                    return nf[k]
            return 0.0

        calories = get_nutrient(energy_keys)
        protein = get_nutrient(protein_keys)
        carbs = get_nutrient(carb_keys)
        fat = get_nutrient(fat_keys)

        # F. Get daily goal
        profile = profiles_col.find_one({"user_id": user["user_id"]})
        daily_goal = 2500
        if profile:
            w, h, a = profile.get("weight_kg", 70), profile.get("height_cm", 170), profile.get("age", 25)
            if profile.get("gender") == "male":
                bmr = 10 * w + 6.25 * h - 5 * a + 5
            else:
                bmr = 10 * w + 6.25 * h - 5 * a - 161
            multipliers = {"sedentary": 1.2, "light": 1.375, "moderate": 1.55, "active": 1.725, "very_active": 1.9}
            daily_goal = round(bmr * multipliers.get(profile.get("activity_level", "moderate"), 1.55))

        # G. AI RECOMMENDATIONS
        recommendations = generate_recommendations(protein, carbs, fat, calories, daily_goal)

        return {
            "status": "success",
            "portion_size": portion_size,
            "ai_detection": {
                "label": primary["label"],
                "confidence": primary["confidence"],
            },
            "database_match": primary["database_match"],
            "nutrition_facts": nf,
            "macros": {
                "calories": round(calories, 1),
                "protein": round(protein, 1),
                "carbs": round(carbs, 1),
                "fat": round(fat, 1),
            },
            "recommendations": recommendations,
            "alternatives": top_foods[1:] if len(top_foods) > 1 else [],
            "daily_goal": daily_goal,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ──────────────────────────────────────────────
# 9. MEAL LOG ENDPOINTS
# ──────────────────────────────────────────────
@app.post("/meals")
async def log_meal(body: MealLogBody, user=Depends(get_current_user)):
    meal_doc = body.model_dump()
    meal_doc["user_id"] = user["user_id"]
    meal_doc["logged_at"] = datetime.now(timezone.utc)
    meals_col.insert_one(meal_doc)
    return {"status": "success", "message": "Meal logged"}


@app.get("/meals")
async def get_meals(
    days: int = Query(7, ge=1, le=365),
    user=Depends(get_current_user),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    cursor = meals_col.find(
        {"user_id": user["user_id"], "logged_at": {"$gte": since}}
    ).sort("logged_at", -1)

    meals = []
    for m in cursor:
        m["_id"] = str(m["_id"])
        m["logged_at"] = m["logged_at"].isoformat()
        meals.append(m)
    return {"status": "success", "meals": meals}


@app.delete("/meals/{meal_id}")
async def delete_meal(meal_id: str, user=Depends(get_current_user)):
    result = meals_col.delete_one({"_id": ObjectId(meal_id), "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Meal not found")
    return {"status": "success", "message": "Meal deleted"}


# ──────────────────────────────────────────────
# 10. FOOD SEARCH (Manual Entry)
# ──────────────────────────────────────────────
@app.get("/search")
async def search_food(
    q: str = Query(..., min_length=2),
    user=Depends(get_current_user),
):
    query_vector = vector_model.encode([q.lower()])
    similarities = cosine_similarity(query_vector, db_vectors)[0]

    # Top 5 results
    top_indices = np.argsort(similarities)[-5:][::-1]
    results = []

    conn = get_mysql_connection()
    cursor = conn.cursor(dictionary=True)

    for idx in top_indices:
        food_code = int(db_codes[idx])
        sim = float(similarities[idx])

        cursor.execute("SELECT main_description FROM main_food_desc WHERE food_code = %s", (food_code,))
        meta = cursor.fetchone()

        cursor.execute("SELECT nutrient_code, nutrient_value FROM nutrient_values WHERE food_code = %s", (food_code,))
        nutrient_rows = cursor.fetchall()
        nutrition_facts = {str(r['nutrient_code']): float(r['nutrient_value']) for r in nutrient_rows}

        energy_keys = ['208', 'Energy (kcal)', 'Energy']
        protein_keys = ['203', 'Protein (g)', 'Protein']
        carb_keys = ['205', 'Carbohydrate (g)', 'Carbohydrate']
        fat_keys = ['204', 'Total Fat (g)', 'Total lipid (fat) (g)']

        def get_nut(keys):
            for k in keys:
                if k in nutrition_facts:
                    return nutrition_facts[k]
            return 0.0

        energy = get_nut(energy_keys)
        protein = get_nut(protein_keys)
        carbs = get_nut(carb_keys)
        fat = get_nut(fat_keys)

        results.append({
            "food_code": food_code,
            "name": meta['main_description'] if meta else f"Food #{food_code}",
            "similarity": f"{sim * 100:.1f}%",
            "calories": round(energy, 1),
            "protein": round(protein, 1),
            "carbs": round(carbs, 1),
            "fat": round(fat, 1),
            "nutrition_facts": nutrition_facts,
        })

    cursor.close()
    conn.close()
    return {"status": "success", "results": results}


# ──────────────────────────────────────────────
# 11. ANALYTICS
# ──────────────────────────────────────────────
@app.get("/analytics")
async def get_analytics(
    range: str = Query("week", regex="^(week|month)$"),
    user=Depends(get_current_user),
):
    days = 7 if range == "week" else 30
    since = datetime.now(timezone.utc) - timedelta(days=days)

    pipeline = [
        {"$match": {"user_id": user["user_id"], "logged_at": {"$gte": since}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$logged_at"}},
            "total_calories": {"$sum": "$calories"},
            "total_protein": {"$sum": "$protein"},
            "total_carbs": {"$sum": "$carbs"},
            "total_fat": {"$sum": "$fat"},
            "meal_count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    data = list(meals_col.aggregate(pipeline))

    # Fill missing days with zeros
    all_days = []
    for i in range(days):
        d = (datetime.now(timezone.utc) - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        found = next((x for x in data if x["_id"] == d), None)
        all_days.append({
            "date": d,
            "calories": round(found["total_calories"], 1) if found else 0,
            "protein": round(found["total_protein"], 1) if found else 0,
            "carbs": round(found["total_carbs"], 1) if found else 0,
            "fat": round(found["total_fat"], 1) if found else 0,
            "meals": found["meal_count"] if found else 0,
        })

    # Summary stats
    total_cals = sum(d["calories"] for d in all_days)
    active_days = sum(1 for d in all_days if d["meals"] > 0)

    return {
        "status": "success",
        "range": range,
        "days": all_days,
        "summary": {
            "total_calories": round(total_cals, 1),
            "avg_calories": round(total_cals / max(active_days, 1), 1),
            "total_protein": round(sum(d["protein"] for d in all_days), 1),
            "total_carbs": round(sum(d["carbs"] for d in all_days), 1),
            "total_fat": round(sum(d["fat"] for d in all_days), 1),
            "active_days": active_days,
            "total_meals": sum(d["meals"] for d in all_days),
        },
    }


# ──────────────────────────────────────────────
# 12. EXPORT (CSV / PDF)
# ──────────────────────────────────────────────
@app.get("/export")
async def export_data(
    format: str = Query("csv", regex="^(csv|pdf)$"),
    range: str = Query("week", regex="^(week|month)$"),
    user=Depends(get_current_user),
):
    days = 7 if range == "week" else 30
    since = datetime.now(timezone.utc) - timedelta(days=days)
    meals = list(meals_col.find(
        {"user_id": user["user_id"], "logged_at": {"$gte": since}}
    ).sort("logged_at", -1))

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Date", "Food", "Calories", "Protein (g)", "Carbs (g)", "Fat (g)", "Portion"])
        for m in meals:
            writer.writerow([
                m["logged_at"].strftime("%Y-%m-%d %H:%M"),
                m["food_name"], round(m["calories"], 1),
                round(m["protein"], 1), round(m["carbs"], 1),
                round(m["fat"], 1), m.get("portion_size", 1.0),
            ])
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=nutrivision_{range}.csv"},
        )

    else:  # PDF
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 20)
        pdf.cell(0, 15, "NutriVision Report", new_x="LMARGIN", new_y="NEXT", align="C")
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 8, f"User: {user['username']}  |  Range: Last {days} days", new_x="LMARGIN", new_y="NEXT", align="C")
        pdf.ln(10)

        # Summary
        total_cals = sum(m["calories"] for m in meals)
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, f"Total Meals: {len(meals)}   |   Total Calories: {total_cals:.0f} kcal", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(5)

        # Table header
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_fill_color(34, 197, 94)
        pdf.set_text_color(255, 255, 255)
        col_w = [35, 55, 25, 25, 25, 25]
        headers = ["Date", "Food", "Calories", "Protein", "Carbs", "Fat"]
        for i, h in enumerate(headers):
            pdf.cell(col_w[i], 8, h, border=1, fill=True, align="C")
        pdf.ln()

        # Table rows
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(0, 0, 0)
        for m in meals:
            pdf.cell(col_w[0], 7, m["logged_at"].strftime("%m-%d %H:%M"), border=1, align="C")
            pdf.cell(col_w[1], 7, m["food_name"][:25], border=1)
            pdf.cell(col_w[2], 7, f"{m['calories']:.0f}", border=1, align="C")
            pdf.cell(col_w[3], 7, f"{m['protein']:.1f}g", border=1, align="C")
            pdf.cell(col_w[4], 7, f"{m['carbs']:.1f}g", border=1, align="C")
            pdf.cell(col_w[5], 7, f"{m['fat']:.1f}g", border=1, align="C")
            pdf.ln()

        pdf_bytes = pdf.output()
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=nutrivision_{range}.pdf"},
        )


# ──────────────────────────────────────────────
# 13. RUN
# ──────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)