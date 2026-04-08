FROM node:20-alpine AS front-build
WORKDIR /build/front_app
COPY kvatum /build/kvatum
COPY front_app/package.json front_app/package-lock.json ./
RUN npm ci
RUN ln -s /build/front_app/node_modules /build/node_modules
COPY front_app/ /build/front_app/
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
COPY --from=front-build /build/front_app/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
