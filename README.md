# 🥗 NutriVision Pro — AI-Based Dietary Assessment System

**NutriVision Pro** is a full-stack AI-powered dietitian platform that transforms food imagery into actionable nutritional intelligence. Built as a college project for **KMCE**, it combines **Computer Vision (YOLOv11)** with **Natural Language Processing (Sentence-Transformers)** to bridge the semantic gap between common food names and clinical USDA FNDDS database entries.

> Upload a photo of your meal → Get instant AI-powered food identification, detailed nutrition facts, and personalized dietary recommendations.

---

## 🚀 Key Features

- **AI Food Recognition** — YOLOv11 classifies food from images with top-3 predictions and confidence scores
- **Semantic Vector Matching** — SentenceTransformer maps detected labels to 5,400+ USDA FNDDS entries using cosine similarity
- **Personalized TDEE Goals** — Calculates daily calorie targets using the Mifflin-St Jeor equation based on user profile
- **Smart Diet Recommendations** — Rule-based engine analyzes macro ratios and generates actionable tips
- **Meal Logging & History** — Track every meal with full nutritional breakdowns
- **Analytics Dashboard** — Weekly/monthly trend charts for calories, protein, carbs, and fat
- **Manual Food Search** — Semantic search across the entire FNDDS database for manual entry
- **Export Reports** — Download meal history as CSV or professionally formatted PDF
- **Secure Authentication** — JWT-based auth with bcrypt password hashing
- **Portion Size Scaling** — Adjust nutrients from 0.25× to 5× portion sizes

---

## 🏗️ System Architecture

```
┌─────────────┐     REST API      ┌──────────────────────────────────────────┐
│   React.js  │◄────────────────►│            FastAPI Backend               │
│  Frontend   │   (JWT Auth)      │                                          │
│  (Vite)     │                   │  ┌──────────┐    ┌────────────────────┐  │
└─────────────┘                   │  │ YOLOv11  │───►│ SentenceTransformer│  │
                                  │  │ (best.pt)│    │  (all-MiniLM-L6)  │  │
                                  │  └──────────┘    └────────┬───────────┘  │
                                  │                           │              │
                                  │                  Cosine Similarity       │
                                  │                           │              │
                                  │               ┌───────────▼──────────┐   │
                                  │               │  food_vectors.npy    │   │
                                  │               │  (5,400+ embeddings) │   │
                                  │               └──────────────────────┘   │
                                  └──────────┬──────────────┬────────────────┘
                                             │              │
                                    ┌────────▼───┐   ┌──────▼──────┐
                                    │   MySQL    │   │  MongoDB    │
                                    │ (Railway)  │   │  Atlas      │
                                    │ FNDDS Data │   │ Users/Meals │
                                    └────────────┘   └─────────────┘
```

### AI Pipeline Flow

1. **Image Upload** → User uploads a food photo (JPEG/PNG/WebP, max 10 MB)
2. **YOLOv11 Detection** → `best.pt` model classifies the food (top-3 predictions)
3. **Semantic Encoding** → Detected label is encoded into a 384-dimensional vector using `all-MiniLM-L6-v2`
4. **Cosine Similarity Search** → Vector is matched against pre-computed FNDDS food description embeddings
5. **Nutrition Lookup** → Best-matched food code queries MySQL for detailed nutrient values (USDA FNDDS)
6. **Recommendations** → Rule-based engine analyzes macro ratios and generates personalized diet tips
7. **Response** → Full nutrition breakdown, recommendations, and alternatives returned to frontend

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite 8, Tailwind CSS v4, Chart.js, Framer Motion, Lucide Icons |
| **Backend** | FastAPI, Uvicorn, Python 3.x |
| **AI / ML** | Ultralytics YOLOv11, Sentence-Transformers (`all-MiniLM-L6-v2`), scikit-learn |
| **Databases** | MySQL on Railway (FNDDS reference data), MongoDB Atlas (users, meals, analytics) |
| **Auth** | PyJWT, Passlib (bcrypt) |
| **Export** | fpdf2 (PDF reports), CSV |
| **DevOps** | Git, python-dotenv |

---

## 📡 API Endpoints

| Method | Endpoint | Auth | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/register` | ❌ | Create new user account |
| `POST` | `/login` | ❌ | Authenticate and receive JWT token |
| `GET` | `/profile` | ✅ | Get user profile (weight, height, age, etc.) |
| `PUT` | `/profile` | ✅ | Update user profile |
| `GET` | `/daily-goal` | ✅ | Get calculated TDEE calorie goal |
| `POST` | `/analyze` | ✅ | **Core** — Upload food image for AI analysis |
| `GET` | `/search?q=` | ✅ | Semantic food search (returns top 5 matches) |
| `POST` | `/meals` | ✅ | Log a meal |
| `GET` | `/meals?days=` | ✅ | Get meal history (1–365 days) |
| `DELETE` | `/meals/{id}` | ✅ | Delete a logged meal |
| `GET` | `/analytics?range=` | ✅ | Aggregated nutrition stats (week/month) |
| `GET` | `/export?format=&range=` | ✅ | Export data as CSV or PDF |

---

## 📁 Project Structure

```
KMCE_Dietitian/
├── main.py                  # FastAPI backend (all endpoints)
├── best.pt                  # YOLOv11 trained model weights
├── food_vectors.npy         # Pre-computed FNDDS food embeddings
├── food_codes.npy           # Corresponding FNDDS food codes
├── generate_vectors.py      # Script to regenerate food embeddings
├── auto_map.py              # Fuzzy-match YOLO classes to FNDDS codes
├── requirements.txt         # Python dependencies
├── .env                     # Environment variables (not committed)
├── .gitignore
│
└── kmce-frontend/           # React frontend
    ├── package.json
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        ├── context/
        │   └── AuthContext.jsx
        ├── components/
        │   ├── Navbar.jsx
        │   ├── ProtectedRoute.jsx
        │   └── SearchBar.jsx
        └── pages/
            ├── Dashboard.jsx    # Food scanning & analysis
            ├── History.jsx      # Meal log history
            ├── Analytics.jsx    # Charts & trends
            ├── Settings.jsx     # User profile settings
            ├── Login.jsx
            └── Register.jsx
```

---

## ⚙️ Installation & Setup

### Prerequisites

- Python 3.9+
- Node.js 18+
- MySQL database (or Railway)
- MongoDB Atlas account

### 1. Clone the Repository

```bash
git clone https://github.com/niteshredddy/ai_dietitian.git
cd ai_dietitian
```

### 2. Backend Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Create a .env file with the following variables:
# DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
# MONGO_URI, MONGO_DB_NAME
# JWT_SECRET
# CORS_ORIGIN

# Start the backend server
python main.py
```

The API will be available at `http://localhost:8000`.

### 3. Frontend Setup

```bash
cd kmce-frontend

# Install Node dependencies
npm install

# Start the dev server
npm run dev
```

The frontend will be available at `http://localhost:5173`.

### 4. Generate Food Vectors (Optional)

If you need to regenerate the semantic food embeddings from your MySQL database:

```bash
python generate_vectors.py
```

This will create `food_vectors.npy` and `food_codes.npy`.

---

## 🧮 How TDEE Calculation Works

The daily calorie goal is calculated using the **Mifflin-St Jeor Equation**:

| Gender | Formula |
| :--- | :--- |
| Male | `BMR = 10 × weight(kg) + 6.25 × height(cm) - 5 × age + 5` |
| Female | `BMR = 10 × weight(kg) + 6.25 × height(cm) - 5 × age - 161` |

The BMR is then multiplied by an activity factor:

| Activity Level | Multiplier |
| :--- | :---: |
| Sedentary | 1.20 |
| Lightly Active | 1.375 |
| Moderately Active | 1.55 |
| Active | 1.725 |
| Very Active | 1.90 |

---

## 🔐 Environment Variables

Create a `.env` file in the project root:

```env
# MySQL (FNDDS reference data)
DB_HOST=your_mysql_host
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=your_database

# MongoDB Atlas (users, meal logs, analytics)
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/
MONGO_DB_NAME=nutrivision

# Auth
JWT_SECRET=your_secret_key

# CORS
CORS_ORIGIN=http://localhost:5173
```

---

## 👨‍💻 Author

**Nitesh Reddy** — [github.com/niteshredddy](https://github.com/niteshredddy)

Built as a project for **KMCE** (Department of Computer Science).

---

## 📄 License

This project is for academic/educational purposes.
