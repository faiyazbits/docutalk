# Docker Setup Guide

Complete guide for running Docutalk with Docker and Docker Compose.

## Prerequisites

- Docker Desktop installed and running
- Docker Compose (included with Docker Desktop)
- API Keys (DeepSeek and OpenAI)

## Quick Start with Docker Compose

### 1. Configure Environment

```bash
# Copy and edit environment file
cd server
cp .env.example .env

# Edit .env and add your API keys:
# DEEPSEEK_API_KEY=sk-your-actual-key
# OPENAI_API_KEY=sk-your-actual-key
```

### 2. Start Everything (Development)

```bash
# From root directory
docker-compose up -d

# Or with rebuild
docker-compose up -d --build
```

This will start:
- ChromaDB on port 8000
- Server on port 3000
- Client on port 3001

### 3. Access the Application

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000
- **Chroma DB**: http://localhost:8000

### 4. View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f server
docker-compose logs -f client
docker-compose logs -f chromadb
```

### 5. Stop Everything

```bash
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v
```

## Production Deployment

### Build for Production

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Start in production mode
docker-compose -f docker-compose.prod.yml up -d
```

### Production Features

- Optimized production builds
- Health checks
- Auto-restart on failure
- Non-root user for security

## Individual Docker Commands

### Run Only Chroma

```bash
docker run -d \
  --name chromadb \
  -p 8000:8000 \
  -v chroma-data:/chroma/chroma \
  chromadb/chroma
```

### Build & Run Server

```bash
# Development
cd server
docker build -t docutalk-server:dev --target development .
docker run -d \
  --name docutalk-server \
  -p 3000:3000 \
  -v $(pwd):/app \
  --env-file .env \
  docutalk-server:dev

# Production
docker build -t docutalk-server:prod --target production .
docker run -d \
  --name docutalk-server \
  -p 3000:3000 \
  --env-file .env \
  docutalk-server:prod
```

### Build & Run Client

```bash
# Development
cd client
docker build -t docutalk-client:dev --target development .
docker run -d \
  --name docutalk-client \
  -p 3001:3001 \
  -v $(pwd):/app \
  docutalk-client:dev

# Production
docker build -t docutalk-client:prod --target production .
docker run -d \
  --name docutalk-client \
  -p 80:80 \
  docutalk-client:prod
```

## Docker Compose Commands

```bash
# Start services
docker-compose up -d

# Start specific service
docker-compose up -d chromadb

# Rebuild and start
docker-compose up -d --build

# Stop services
docker-compose stop

# Restart services
docker-compose restart

# Remove services
docker-compose down

# Remove services and volumes
docker-compose down -v

# View logs
docker-compose logs -f [service-name]

# Execute command in container
docker-compose exec server sh
docker-compose exec client sh

# Scale services (if needed)
docker-compose up -d --scale server=3
```

## Docker Compose Services

### Development (docker-compose.yml)

| Service | Port | Description |
|---------|------|-------------|
| chromadb | 8000 | Vector database |
| server | 3000 | Node.js API with hot reload |
| client | 3001 | Next.js dev server |

### Production (docker-compose.prod.yml)

| Service | Port | Description |
|---------|------|-------------|
| chromadb | 8000 | Vector database |
| server | 3000 | Node.js API (optimized) |

## Volume Management

### List Volumes

```bash
docker volume ls
```

### Inspect Chroma Data

```bash
docker volume inspect docutalk_chroma-data
```

### Backup Chroma Data

```bash
# Create backup
docker run --rm \
  -v docutalk_chroma-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/chroma-backup.tar.gz -C /data .

# Restore backup
docker run --rm \
  -v docutalk_chroma-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/chroma-backup.tar.gz -C /data
```

## Troubleshooting

### Check Container Status

```bash
docker-compose ps
```

### View Container Logs

```bash
# All logs
docker-compose logs

# Specific service
docker-compose logs server

# Follow logs
docker-compose logs -f --tail=100 server
```

### Restart a Service

```bash
docker-compose restart server
```

### Rebuild a Service

```bash
docker-compose up -d --build server
```

### Enter Container Shell

```bash
docker-compose exec server sh
docker-compose exec client sh
```

### Network Issues

```bash
# Inspect network
docker network inspect docutalk_docutalk-network

# Recreate network
docker-compose down
docker-compose up -d
```

### Clean Everything

```bash
# Remove containers, networks, volumes
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Remove everything Docker (USE WITH CAUTION!)
docker system prune -a --volumes
```

## Custom Dockerfile Stages

### Server Dockerfile Stages

- **development**: Hot reload, dev dependencies
- **production**: Optimized, production-only deps, non-root user

### Client Dockerfile Stages

- **development**: Next.js dev server
- **build**: Build Next.js app
- **production**: Serving static files

## Security Best Practices

### Production Checklist

- Use non-root user
- Enable health checks
- Set resource limits
- Use secrets management
- Enable HTTPS
- Scan images for vulnerabilities
- Keep images updated

### Resource Limits (add to docker-compose)

```yaml
services:
  server:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

## Monitoring

### Container Stats

```bash
# Real-time stats
docker stats

# Specific container
docker stats docutalk-server
```

### Health Checks

```bash
# Check health
docker inspect --format='{{.State.Health.Status}}' docutalk-server

# View health logs
docker inspect docutalk-server | jq '.[].State.Health'
```

## Deployment Options

### Docker Swarm

```bash
docker stack deploy -c docker-compose.prod.yml docutalk
```

### Kubernetes

Convert docker-compose to Kubernetes:
```bash
kompose convert -f docker-compose.prod.yml
```

### Cloud Platforms

- **AWS ECS**: Use task definitions
- **Google Cloud Run**: Deploy containers
- **Azure Container Instances**: Deploy groups
- **DigitalOcean App Platform**: Deploy from Dockerfile

## Environment Variables

### Required (.env)

```bash
DEEPSEEK_API_KEY=sk-your-key
OPENAI_API_KEY=sk-your-key
```

### Optional

```bash
PORT=3000
NODE_ENV=production
CHROMA_URL=http://chromadb:8000
CHROMA_COLLECTION=rag-collection
```

## Common Workflows

### Development Workflow

```bash
# Start everything
docker-compose up -d

# Make code changes (hot reload works)

# View logs
docker-compose logs -f server

# Restart if needed
docker-compose restart server
```

### Production Deployment

```bash
# Build images
docker-compose -f docker-compose.prod.yml build

# Push to registry (optional)
docker tag docutalk-server:prod your-registry/docutalk-server:latest
docker push your-registry/docutalk-server:latest

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

### Document Ingestion

```bash
# Copy PDFs to server container
docker cp document.pdf docutalk-server:/app/documents/

# Run ingestion
docker-compose exec server pnpm run ingest
```

## Tips

1. **Use volumes for development** - Code changes reflect immediately
2. **Multi-stage builds** - Smaller production images
3. **Health checks** - Automatic restart on failure
4. **Resource limits** - Prevent resource exhaustion
5. **Network isolation** - Services in same network can communicate
6. **Persistent data** - Use volumes for Chroma data

## Getting Help

```bash
# Docker version
docker --version
docker-compose --version

# System info
docker info

# Check logs
docker-compose logs --tail=50
```

---

**Happy Dockerizing!**
