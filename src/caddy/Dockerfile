# Stage 1: Build Caddy
FROM golang:alpine AS builder

# Install upx (compression)
RUN apk add --no-cache upx ca-certificates

# Set working directory
WORKDIR /app

# Copy go.mod and go.sum
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY main.go ./

# Build Caddy with aggressive optimizations
# CGO_ENABLED=0: Static binary
ENV CGO_ENABLED=0

# Build caddy to /caddy
# -ldflags '-s -w': Strip DWARF/symbols
# -trimpath: Remove file paths
RUN go build \
    -o /caddy \
    -trimpath \
    -ldflags "-s -w" \
    .

# Aggressive compression with UPX
RUN upx --best --lzma /caddy

# Stage 2: Scratch Runtime (Minimal)
FROM scratch

# Copy certificates
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy compressed Caddy binary
COPY --from=builder /caddy /usr/bin/caddy

# Copy Caddyfile
COPY Caddyfile /etc/caddy/Caddyfile

# Set environment variables
ENV XDG_CONFIG_HOME=/config
ENV XDG_DATA_HOME=/data

# Expose standard ports
EXPOSE 80
EXPOSE 443
EXPOSE 2019

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
