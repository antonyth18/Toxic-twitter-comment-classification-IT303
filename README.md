# Toxic Twitter Comment Classification System

This repository is structured as a monorepo containing three core packages:
1. **`/backend`**: Node.js + Express API + PostgreSQL (via Prisma ORM) — handles Auth, 2FA, logs, and database access.
2. **`/classifier-service`**: Python + FastAPI — runs the ML classifier model to flag toxicity and subcategories.
3. **`/web-client`**: React + Vite + Tailwind CSS — web interface dashboard.

---

## Prerequisites
To run this project, make sure you have installed:
- **Docker Desktop** (version 20.10+ recommended)
- **Node.js** (v18.0+ recommended) & **npm** (for local development/testing)
- **Python 3.10+** (for local classifier development)

---

## Environment Setup
First, prepare the environment files for all three services by copying their `.env.example` templates:

```bash
# 1. Backend environment
cp backend/.env.example backend/.env

# 2. Classifier environment
cp classifier-service/.env.example classifier-service/.env

# 3. Web client environment
cp web-client/.env.example web-client/.env
```

---

## Running with Docker Compose (Recommended)
You can build and start all services, including a local PostgreSQL instance, in one command:

```bash
docker-compose up --build
```

This will start:
- **Database**: PostgreSQL on `localhost:5432`
- **Backend API**: Node Express on `http://localhost:5000` (healthcheck: `/api/health`)
- **Classifier Service**: FastAPI on `http://localhost:8000` (healthcheck: `/health`)
- **Web Client**: React + Vite on `http://localhost:3000`

On initial boot, the backend container automatically runs Prisma schema migrations and seeds any default parameters.

---

## Running Services Locally

### 1. Database (PostgreSQL)
Run a local PostgreSQL database or configure one via Neon/Supabase, and get its connection string.

### 2. Backend Service
```bash
cd backend
npm install
# Run migrations
npx prisma migrate dev --name init
# Start server in development mode
npm run dev
```

### 3. Classifier Service
```bash
cd classifier-service
# Set up a virtual environment (optional but recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
# Start the FastAPI server
uvicorn main:app --reload --port 8000
```

### 4. Web Client
```bash
cd web-client
npm install
npm run dev -- --port 3000
```
