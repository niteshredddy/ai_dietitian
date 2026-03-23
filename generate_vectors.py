import mysql.connector
import numpy as np
from sentence_transformers import SentenceTransformer

# 1. Load the Model (Industry standard for speed/accuracy)
model = SentenceTransformer('all-MiniLM-L6-v2')

db = mysql.connector.connect(
    host="localhost", user="root", password="honey@2007", database="ai_dietician_db"
)
cursor = db.cursor(dictionary=True)

print("Fetching descriptions...")
cursor.execute("SELECT food_code, main_description FROM main_food_desc")
rows = cursor.fetchall()

descriptions = [r['main_description'] for r in rows]
food_codes = [r['food_code'] for r in rows]

print(f"Vectorizing {len(descriptions)} items... (This may take a few mins)")
# This turns text into a large matrix of numbers
vectors = model.encode(descriptions, show_progress_bar=True)

# 2. Save everything to disk
np.save("food_vectors.npy", vectors)
np.save("food_codes.npy", np.array(food_codes))
print("✅ Success! Vectors saved to disk.")