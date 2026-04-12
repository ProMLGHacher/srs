FROM node:20-alpine AS front-build
WORKDIR /build/front
COPY front/package.json front/package-lock.json ./
RUN npm ci
COPY front/ ./
RUN npm run build

FROM golang:1.23-alpine AS go-build
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM alpine:3.20 AS app
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=go-build /out/server .
ENV PORT=3001
ENV SRS_HTTP=http://127.0.0.1:1985
ENV SRS_EIP=127.0.0.1
EXPOSE 3001
CMD ["./server"]

FROM nginx:1.27-alpine AS nginx
COPY --from=front-build /build/front/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
