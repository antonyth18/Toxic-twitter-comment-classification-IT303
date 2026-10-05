# Toxic Twitter Comment Classification System

An end-to-end full-stack platform designed to detect, classify, and audit toxic Twitter/X comments in real time. Built with a microservice architecture supporting multi-label toxicity categorization, role-based access control (RBAC), and Time-based One-Time Password (TOTP) two-factor authentication (2FA).

---

## Architecture Overview

This project is organized as a monorepo consisting of three primary services backed by PostgreSQL:

```
SoftwareEngineering_Project/
├── backend/             # Node.js + Express API + Prisma ORM (Port 5000)
├── classifier-service/  # Python + FastAPI + PyTorch / ML Models (Port 8000)
├── web-client/          # React 18 + Vite + Tailwind CSS Dashboard (Port 3000)
└── docs/                # Software Engineering SRS, DFDs, and Architecture Specifications
```

### Services Summary

| Service | Tech Stack | Port | Responsibilities |
|---|---|---|---|
| **Database** | PostgreSQL 14+ | `5432` | Stores users, TOTP credentials, audit logs, and classified tweet history |
| **Classifier Service** | Python, FastAPI, PyTorch, Transformers | `8000` | Multi-label toxicity inference (`toxic`, `severe_toxic`, `obscene`, `threat`, `insult`, `identity_hate`) |
| **Backend API** | Node.js, Express, Prisma ORM | `5000` | Auth & 2FA management, feed ingestion, classification orchestration, history persistence |
| **Web Client** | React 18, Vite, Tailwind CSS, Lucide | `3000` | Responsive user dashboard, TOTP QR setup, live feed scanner, history auditing |

---

## Prerequisites

Ensure the following tools are installed and configured on your system before proceeding:

- **Node.js** (v18.0.0 or higher) & **npm** ([Download Node.js](https://nodejs.org/))
- **Python** (v3.10 or higher) & **pip** ([Download Python](https://www.python.org/))
- **PostgreSQL** (v14 or higher) running locally or hosted (e.g. Neon, Supabase) ([Download PostgreSQL](https://www.postgresql.org/download/))

---

## Environment Configuration

Before running the application, configure the environment variables for each service. Sample configuration files (`.env.example`) are provided in their respective directories.

### 1. Backend (`backend/.env`)

Copy `backend/.env.example` to `backend/.env`:

```bash
cp backend/.env.example backend/.env
```

Configure your local database credentials and secrets:

```env
PORT=5000

# Local PostgreSQL Connection String (adjust user, password, and port if needed)
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/toxic_comments?schema=public

# Authentication Security
JWT_SECRET=your_super_secret_jwt_key_here!

# Microservice URL for local development
CLASSIFIER_SERVICE_URL=http://localhost:8000

# Twitter / X Ingestion Mode
# Set to true to avoid paid Twitter API tiers while simulating realistic live feeds
TWITTER_MOCK_MODE=true

# Admin Seeding Credentials (used by npm run seed:admin)
ADMIN_EMAIL=admin123@toxic.com
ADMIN_PASSWORD=AdminPassword12345!
```

### 2. Classifier Service (`classifier-service/.env`)

Copy `classifier-service/.env.example` to `classifier-service/.env`:

```bash
cp classifier-service/.env.example classifier-service/.env
```

```env
PORT=8000
```

### 3. Web Client (`web-client/.env`)

Copy `web-client/.env.example` to `web-client/.env`:

```bash
cp web-client/.env.example web-client/.env
```

```env
VITE_API_URL=http://localhost:5000
```

---

## Installation & Running the Project (Step-by-Step)

For local development with hot-reloading across services, run each component in its own terminal window.

### Step 1: Prepare the PostgreSQL Database

1. Ensure your local PostgreSQL service is started (e.g., via Windows Services or pgAdmin).
2. Create a database named `toxic_comments`:
   ```sql
   CREATE DATABASE toxic_comments;
   ```
3. Verify that your connection details in `backend/.env` match your local PostgreSQL username and password.

---

### Step 2: Setup & Run Classifier Service

Open a terminal and navigate to `classifier-service`:

```bash
cd classifier-service
```

1. **Create and activate a Python virtual environment:**

   - **Windows (PowerShell):**
     ```powershell
     python -m venv venv
     .\venv\Scripts\activate
     ```
     *(If script execution is disabled on PowerShell, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` first).*

   - **Linux / macOS:**
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Start the FastAPI server:**
   ```bash
   python main.py
   # Or using uvicorn directly:
   # uvicorn main:app --reload --port 8000
   ```

4. **Verify Classifier is Running:**
   Open [http://localhost:8000/health](http://localhost:8000/health) in your browser. It should respond with `{"status": "ok"}`.

---

### Step 3: Setup & Run Backend Service

Open a second terminal and navigate to `backend`:

```bash
cd backend
```

1. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

2. **Generate Prisma Client & Apply Database Migrations:**
   ```bash
   # Generate Prisma client bindings
   npx prisma generate

   # Apply database migrations to your PostgreSQL database
   npx prisma migrate dev
   ```

3. **Seed Initial Administrator Account (Optional but Recommended):**
   ```bash
   npm run seed:admin
   ```
   This will output the administrator email (`admin123@toxic.com`), role, and **TOTP Secret (Base32)** which you can enter into your authenticator app (Google Authenticator, Authy, etc.).

4. **Start the Express backend in development mode:**
   ```bash
   npm run dev
   ```

5. **Verify Backend is Running:**
   Open [http://localhost:5000/api/health](http://localhost:5000/api/health) in your browser. It should respond with `{"status": "ok"}`.

---

### Step 4: Setup & Run Web Client

Open a third terminal and navigate to `web-client`:

```bash
cd web-client
```

1. **Install frontend dependencies:**
   ```bash
   npm install
   ```

2. **Start the Vite development server:**
   ```bash
   npm run dev
   ```

3. **Open the Application:**
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

---

## Application Usage & Features

### 1. Two-Factor Authentication (TOTP 2FA)
- **User Registration:** Click **Get Started** or **Register** on the landing page. Fill in your details.
- **2FA Enrollment:** Upon registration, a dynamic QR code and a Base32 secret key are displayed. Scan the QR code using **Google Authenticator**, **Microsoft Authenticator**, or **Authy**.
- **Login Verification:** Enter your email and password, then input the 6-digit TOTP code generated by your authenticator app to access the platform.
- **Seeded Admin Login:** If you ran `npm run seed:admin`, you can log in with:
  - **Email:** `admin123@toxic.com`
  - **Password:** `AdminPassword12345!`
  - **TOTP Code:** Generated using the Base32 key printed in terminal during seeding.

### 2. Live Tweet Feed & Toxicity Scanning
- Navigate to the **Dashboard** (`/home`).
- Enter a topic, hashtag, or Twitter handle (or leave blank) and click **Fetch Feed**.
- **Zero-Cost Mock Mode (`TWITTER_MOCK_MODE=true`):** To avoid paid X/Twitter Developer API costs, the backend generates dynamic streams of comments containing realistic toxic, abusive, threatening, and benign samples.
- The classifier evaluates each tweet and tags toxic categories:
  - `TOXIC`
  - `SEVERE TOXIC`
  - `OBSCENE`
  - `THREAT`
  - `INSULT`
  - `IDENTITY HATE`
- Results are automatically persisted to the PostgreSQL database under your user account.

### 3. Classification History & Audit Logs
- Navigate to **History** (`/history`) from the top navigation bar.
- View all historical scans performed by your account, loaded dynamically from PostgreSQL.
- Filter records by **All**, **Toxic Only**, or **Normal Only**.
- View detailed confidence percentages and subcategory breakdowns for each comment.

---

## Automated Testing

To run the backend integration and unit test suite:

```bash
cd backend
npm test
```

This executes Jest test suites covering authentication, TOTP validation, role-based access control, and audit logging.

---

## Troubleshooting & FAQs

### 1. `PrismaClientInitializationError: Can't reach database server`
- Ensure your local PostgreSQL service is running and accepting connections.
- Check `backend/.env` to confirm the host, port (`5432`), database name (`toxic_comments`), username, and password are correct.
- Test connection directly via `psql`:
  ```bash
  psql -U postgres -d toxic_comments
  ```

### 2. PowerShell: `cannot be loaded because running scripts is disabled on this system`
When activating the Python virtual environment on Windows PowerShell:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\venv\Scripts\activate
```

### 3. Classifier Connection Error (`Classifier service unavailable`)
- Confirm that the Python service is running on port `8000` by visiting [http://localhost:8000/health](http://localhost:8000/health).
- Verify `CLASSIFIER_SERVICE_URL=http://localhost:8000` is set in `backend/.env`.

---

## Contributors & Academic Attribution

Developed as part of the **IT303 - Software Engineering** curriculum.

- **Lead Developer:** Anirudh Thiagarajan Trichy (Roll: 241IT009)
- **Course Instructor / Guide:** Dr. Sowmya Kamath S, Department of Information Technology, National Institute of Technology Karnataka (NITK), Surathkal.
