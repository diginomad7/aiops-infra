FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY src/ ./src/

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/anomaly-detector ./src/cmd/anomaly-detector

# Create final minimal image
FROM alpine:3.18

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/anomaly-detector .

# Create non-root user
RUN adduser -D -u 1000 appuser && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8080

CMD ["./anomaly-detector"] 