# 🥗 NutriVision Pro: AI-Based Dietary Assessment

**NutriVision Pro** is a multimodal AI platform that transforms food imagery into actionable nutritional intelligence. By combining Computer Vision (YOLOv11) with Natural Language Processing (Sentence-Transformers), the system bridges the "semantic gap" between common food names and clinical database entries.

---

## 🚀 Key Innovations
- **Dual-Stage AI Pipeline:** Uses YOLOv11 for spatial detection and Sentence-Transformers for **Semantic Vector Mapping** ($Cosine Similarity$).
- **Hybrid Persistence:** - **MySQL (Local):** High-integrity relational storage for 5,000+ USDA FNDDS records.
    - **MongoDB Atlas (Cloud):** Scalable NoSQL storage for user profiles, meal telemetry, and longitudinal analytics.
- **Secure Authentication:** Stateless **JWT-based** identity management with bcrypt password hashing.
- **Dynamic Analytics:** Real-time trend visualization using Chart.js and TDEE calculation via the **Mifflin-St Jeor Equation**.

---

## 🛠️ Tech Stack
| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React.js, Tailwind CSS, Chart.js, React Router |
| **Backend** | FastAPI (Python), Uvicorn, PyJWT, Passlib |
| **AI/ML** | Ultralytics YOLOv11, Sentence-Transformers (all-MiniLM-L6-v2) |
| **Database** | MySQL (Reference), MongoDB Atlas (User Data) |
| **DevOps** | Git, Dotenv, Python-Multipart |

---

## 📸 System Architecture
The system follows a decoupled microservices-ready architecture:
1. **Vision:** Raw pixels are processed by YOLOv11 to extract class labels.
2. **Semantics:** Labels are converted to 384-dimensional dense vectors.
3. **Matching:** A "Nearest Neighbor" search maps the vector to the closest FNDDS entry.
4. **Delivery:** Results are served via a JWT-authorized FastAPI endpoint to the React Dashboard.

---

## ⚙️ Installation & Setup

### 1. Backend Setup
```bash
# Clone the repository
git clone [https://github.com/niteshredddy/ai_dietitian.git](https://github.com/niteshredddy/ai_dietitian.git)
cd ai_dietitian

# Install dependencies
pip install -r requirements.txt

# Configure Environment
# Create a .env file with your DB_PASSWORD and MONGO_URI
python main.py
