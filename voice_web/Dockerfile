FROM node:20-alpine AS build
WORKDIR /build
COPY voice_web/package.json voice_web/package-lock.json ./
RUN npm ci
COPY voice_web/ ./
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /build/dist /usr/share/nginx/html
COPY voice_web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
