import os
import io
import logging
import numpy as np
import cv2
import mysql.connector.pooling
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

# 1. INITIAL SETUP & LOGGING
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="NutriVision Pro - Semantic Edition")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. LOAD MODELS & VECTOR DATA (Once at startup for speed)
try:
    logger.info("🚀 Loading YOLOv11 and SentenceTransformer...")
    yolo_model = YOLO("best.pt")
    vector_model = SentenceTransformer('all-MiniLM-L6-v2')

    # Load the vectors you generated
    db_vectors = np.load("food_vectors.npy")
    db_codes = np.load("food_codes.npy")
    logger.info(f"✅ Loaded {len(db_vectors)} semantic food vectors.")
except Exception as e:
    logger.error(f"❌ Initialization Error: {e}")

# 3. DATABASE CONNECTION POOLING
db_config = {
    "host": "localhost",
    "user": "root",
    "password": "honey@2007", # <--- UPDATE THIS
    "database": "ai_dietician_db"
}
db_pool = mysql.connector.pooling.MySQLConnectionPool(pool_name="diet_pool", pool_size=5, **db_config)

# 4. HELPER FUNCTIONS
def get_db_connection():
    return db_pool.get_connection()

@app.post("/analyze")
async def analyze_food(file: UploadFile = File(...)):
    try:
        # A. IMAGE PROCESSING
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # B. YOLOv11 DETECTION
        results = yolo_model.predict(img, conf=0.25)
        if not results[0].probs:
             raise HTTPException(status_code=400, detail="No food detected in image.")
             
        top_index = results[0].probs.top1
        raw_label = results[0].names[top_index]
        confidence = float(results[0].probs.top1conf)
        clean_name = raw_label.lower().replace("_", " ")

        # C. SEMANTIC SEARCH (VECTOR MATCHING)
        # Convert label to vector and find nearest neighbor in food space
        query_vector = vector_model.encode([clean_name])
        similarities = cosine_similarity(query_vector, db_vectors)[0]
        
        best_match_idx = np.argmax(similarities)
        similarity_score = float(similarities[best_match_idx])
        matched_food_code = int(db_codes[best_match_idx])

        # D. DATABASE RETRIEVAL
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Get Official FNDDS Description
        cursor.execute("SELECT main_description FROM main_food_desc WHERE food_code = %s", (matched_food_code,))
        food_meta = cursor.fetchone()

        # Get all Nutrient Values
        cursor.execute("""
            SELECT nutrient_code, nutrient_value 
            FROM nutrient_values 
            WHERE food_code = %s
        """, (matched_food_code,))
        nutrient_rows = cursor.fetchall()
        
        nutrition_facts = {str(row['nutrient_code']): float(row['nutrient_value']) for row in nutrient_rows}

        cursor.close()
        conn.close()

        return {
            "status": "success",
            "ai_detection": {
                "label": clean_name.title(),
                "confidence": f"{confidence * 100:.2f}%"
            },
            "database_match": {
                "name": food_meta['main_description'],
                "similarity": f"{similarity_score * 100:.2f}%",
                "food_code": matched_food_code
            },
            "nutrition_facts": nutrition_facts
        }

    except Exception as e:
        logger.error(f"Error during analysis: {e}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)