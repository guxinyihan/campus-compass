FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /tracking ./cmd/tracking

FROM alpine:3.21
RUN adduser -D -u 10001 app
USER app
COPY --from=build /tracking /tracking
EXPOSE 8081
ENTRYPOINT ["/tracking"]
