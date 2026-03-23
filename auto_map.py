import mysql.connector
import json
from rapidfuzz import process, fuzz

# 1. Connect to your database
db = mysql.connector.connect(
    host="localhost", user="root", password="honey@2007", database="ai_dietician_db"
)
cursor = db.cursor(dictionary=True)

# 2. Get all official FNDDS descriptions and codes
cursor.execute("SELECT food_code, main_food_description FROM main_food_desc")
fndds_data = cursor.fetchall()
# Create a dictionary for fast lookup: { "Description": "Code" }
fndds_lookup = {row['main_food_description']: row['food_code'] for row in fndds_data}

# 3. Your 101 Food-101 Classes (Example subset)
yolo_classes = ["apple_pie", "baby_back_ribs", "baklava", "beef_carpaccio", "beef_tartare"] 

mapping = {}

print("🚀 Starting Auto-Mapping...")
for food in yolo_classes:
    # Clean the name (apple_pie -> apple pie)
    clean_name = food.replace("_", " ")
    
    # Find the BEST match in the FNDDS descriptions
    match, score, index = process.extractOne(
        clean_name, fndds_lookup.keys(), scorer=fuzz.token_sort_ratio
    )
    
    if score > 70: # Only map if it's a strong match
        mapping[food] = fndds_lookup[match]
        print(f"✅ Matched '{food}' to '{match}' (Score: {int(score)})")
    else:
        print(f"⚠️ Low confidence for '{food}'. Closest: '{match}' ({int(score)})")

# 4. Save the results to your mapping.json
with open("mapping.json", "w") as f:
    json.dump(mapping, f, indent=4)

print("\n✨ Done! Your mapping.json has been automatically generated.")