FROM node:20-alpine AS front-build
WORKDIR /build
COPY front_app/package.json front_app/package-lock.json ./
RUN npm ci
COPY front_app/ ./
RUN npm run build

FROM golang:1.23-alpine AS go-build
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
COPY --from=front-build /build/dist ./internal/static/web/dist
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=go-build /out/server .
ENV PORT=3001
ENV SRS_HTTP=http://127.0.0.1:1985
ENV SRS_EIP=127.0.0.1
EXPOSE 3001
CMD ["./server"]
