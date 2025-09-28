# MemeCoin Aggregator Service

A real-time meme coin data aggregation service that fetches data from multiple DEX sources, provides caching, filtering, sorting, and real-time WebSocket updates.

## Features

- **Multi-DEX Integration**: Fetches data from DexScreener and Jupiter Search APIs
- **Rate Limiting**: Intelligent rate limiting with exponential backoff
- **Redis Caching**: 30-second TTL caching to reduce API calls
- **Real-time Updates**: WebSocket support for live price updates
- **Advanced Filtering**: Filter by volume, price change, DEX, symbols, and time periods
- **Sorting & Pagination**: Sort by various metrics with cursor-based pagination
- **Token Merging**: Intelligent merging of duplicate tokens from different sources
- **RESTful API**: Express.js server with comprehensive endpoints

## Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   DexScreener   │    │   Jupiter       │
│      API        │    │   Search API    │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          └──────────┬───────────┘
                     │
        ┌─────────────▼─────────────┐
        │      API Service          │
        │  (Rate Limiting + Retry)  │
        └─────────────┬─────────────┘
                     │
        ┌─────────────▼─────────────┐
        │     Data Service          │
        │ (Caching + Merging)       │
        └─────────────┬─────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
┌───▼───────┐  ┌─────▼───────┐  ┌─────▼───────┐
│   Redis   │  │ WebSocket   │  │  HTTP       │
│   Cache   │  │  Server     │  │  Server     │
└───────────┘  └─────────────┘  └─────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+ or Bun
- Redis server running locally

### Installation

1. Install dependencies:
```bash
bun install
```

2. Start Redis (if not already running):
```bash
# macOS with Homebrew
brew services start redis

# Docker
docker run -d -p 6379:6379 redis:alpine
```

3. Start the service:
```bash
bun run index.ts
```

The service will start on:
- HTTP API: http://localhost:3000
- WebSocket: ws://localhost:8080

## API Endpoints

### GET /api/tokens
Get filtered and paginated token data.

**Query Parameters:**
- `limit` (number): Number of tokens per page (default: 20)
- `cursor` (string): Pagination cursor
- `sortField` (string): Sort field (`volume24h`, `priceChange24h`, `marketCap`, `priceUsd`, `liquidity`)
- `sortDirection` (string): Sort direction (`asc`, `desc`)
- `minVolume` (number): Minimum 24h volume filter
- `maxVolume` (number): Maximum 24h volume filter
- `minPriceChange` (number): Minimum 24h price change filter
- `maxPriceChange` (number): Maximum 24h price change filter
- `dexIds` (string): Comma-separated DEX IDs to filter by
- `symbols` (string): Comma-separated token symbols to filter by

**Example:**
```bash
curl "http://localhost:3000/api/tokens?limit=10&sortField=volume24h&sortDirection=desc&minVolume=1000"
```

### GET /api/tokens/:address
Get specific token by address.

**Example:**
```bash
curl "http://localhost:3000/api/tokens/G1DXVVmqJs8Ei79QbK41dpgk2WtXSGqLtx9of7o8BAGS"
```

### POST /api/refresh
Manually refresh token data from APIs.

**Example:**
```bash
curl -X POST "http://localhost:3000/api/refresh"
```

### GET /api/websocket
Get WebSocket connection information.

### GET /health
Health check endpoint.

## WebSocket API

Connect to `ws://localhost:8080` for real-time updates.

### Message Types

#### Subscribe to filtered data
```json
{
  "type": "subscribe",
  "filters": {
    "minVolume": 1000,
    "dexIds": ["meteora", "raydium"]
  },
  "sort": {
    "field": "volume24h",
    "direction": "desc"
  },
  "pagination": {
    "limit": 20
  }
}
```

#### Update filters
```json
{
  "type": "update-filters",
  "filters": {
    "minPriceChange": 10
  }
}
```

#### Ping
```json
{
  "type": "ping"
}
```

### Server Messages

#### Data update
```json
{
  "type": "data",
  "data": {
    "data": [...],
    "nextCursor": "20",
    "hasMore": true,
    "total": 100
  }
}
```

#### Price update
```json
{
  "type": "update",
  "data": {
    "type": "price-update",
    "address": "G1DXVVmqJs8Ei79QbK41dpgk2WtXSGqLtx9of7o8BAGS",
    "oldPrice": 0.0002190,
    "newPrice": 0.0002250,
    "timestamp": 1640995200000
  }
}
```

## Configuration

Environment variables can be set in a `.env` file:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# CORS Configuration
CORS_ORIGIN=*

# API Rate Limits (requests per minute)
DEXSCREENER_RATE_LIMIT=300
JUPITER_RATE_LIMIT=200

# Cache Configuration
CACHE_TTL_SECONDS=30
REFRESH_INTERVAL_MS=30000

# WebSocket Configuration
WS_PORT=8080
```

## Development

### Project Structure

```
worker/
├── index.ts           # Main entry point
├── server.ts          # Express.js server
├── wss.ts            # WebSocket server
├── redis.ts          # Redis service
├── api-service.ts    # Multi-DEX API integration
├── data-service.ts   # Data aggregation and caching
├── config.ts         # Configuration management
└── package.json      # Dependencies
```

### Key Components

- **ApiService**: Handles multiple DEX API calls with rate limiting and retry logic
- **DataService**: Manages data aggregation, caching, filtering, and sorting
- **RedisService**: Redis client with caching and pub/sub functionality
- **WSS**: WebSocket server with client filtering and real-time updates
- **Server**: Express.js REST API with comprehensive endpoints

## Production Considerations

1. **Redis**: Use a production Redis instance (AWS ElastiCache, Redis Cloud, etc.)
2. **Rate Limiting**: Adjust rate limits based on your API quotas
3. **Monitoring**: Add logging and monitoring (Winston, Prometheus, etc.)
4. **Scaling**: Consider horizontal scaling with Redis clustering
5. **Security**: Add authentication and rate limiting for API endpoints
6. **Error Handling**: Implement circuit breakers and fallback mechanisms

## License

MIT
