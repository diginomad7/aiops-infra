# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git gcc musl-dev

# Copy go.mod and go.sum files first to leverage Docker caching
COPY go.mod go.sum ./
RUN go mod download

# Copy the source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o /aiops-detector ./src/cmd/anomaly-detector

# Final stage
FROM alpine:3.18

RUN apk add --no-cache bash python3 curl ca-certificates tzdata

# Set timezone
ENV TZ=UTC

# Create scripts directory
RUN mkdir -p /app/scripts

WORKDIR /app

# Copy the compiled binary from the builder stage
COPY --from=builder /aiops-detector /app/aiops-detector

# Add sample scripts for testing
COPY scripts/ /app/scripts/

# Make scripts executable
RUN chmod +x /app/scripts/*.sh

# Expose ports
EXPOSE 8080 9090

# Command to run
ENTRYPOINT ["/app/aiops-detector"]
CMD ["--listen", ":8080", "--metrics", ":9090", "--scripts-dir", "/app/scripts"] 