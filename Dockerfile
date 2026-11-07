# Development/demo image for the Next.js app (API + web page).
# On start it applies database migrations, runs the dev seed, then serves on :3000.
FROM node:22-alpine

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Install dependencies first so Docker caches this layer between code changes.
COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && npm start -- -p 3000 -H 0.0.0.0"]
