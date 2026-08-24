FROM node:18-slim

WORKDIR /app

# Install openssl for prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

RUN npx prisma generate

COPY . .

EXPOSE 5000

# Automatically push database schema to postgres container on startup and start backend
CMD ["sh", "-c", "npx prisma db push && npm run start"]
