FROM golang:1.23-alpine AS build
WORKDIR /src
COPY voice_sfu/go.mod voice_sfu/go.sum ./
RUN go mod download
COPY voice_sfu/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/voice_sfu ./cmd/voice_sfu

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=build /out/voice_sfu .
ENV VOICE_HTTP_ADDR=:8088
EXPOSE 8088/tcp
EXPOSE 10000-10100/udp
CMD ["./voice_sfu"]
