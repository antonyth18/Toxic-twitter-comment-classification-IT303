FROM node:18-slim

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

# Start Vite client on port 3000
CMD ["npm", "run", "dev", "--", "--port", "3000"]
