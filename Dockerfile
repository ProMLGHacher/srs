FROM node:20-alpine AS front-build
WORKDIR /build
COPY front_app/package.json front_app/package-lock.json ./
RUN npm ci
COPY front_app/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY server/package.json ./
RUN npm install --omit=dev
COPY server/index.js ./
COPY --from=front-build /build/dist ./public
ENV NODE_ENV=production
ENV SRS_HTTP=http://127.0.0.1:1985
ENV SRS_EIP=127.0.0.1
EXPOSE 3001
CMD ["node", "index.js"]
