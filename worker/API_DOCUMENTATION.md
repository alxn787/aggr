# MemeCoin Aggregator API Documentation

A real-time meme coin data aggregation service that fetches data from multiple DEX sources, provides caching, filtering, sorting, and real-time WebSocket updates.

## 🚀 Live Deployment

**Base URL**: `http://20.40.57.32:3000`  
**WebSocket URL**: `ws://20.40.57.32:8080`

## 📋 Table of Contents

- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [REST API Endpoints](#rest-api-endpoints)
- [WebSocket API](#websocket-api)
- [Data Models](#data-models)
- [Error Handling](#error-handling)
- [Examples](#examples)

## 🔐 Authentication

Currently, the API does not require authentication. All endpoints are publicly accessible.

## ⚡ Rate Limiting

- **DexScreener API**: 300 requests per minute
- **Jupiter API**: 200 requests per minute
- **Internal Rate Limiting**: Applied with exponential backoff retry logic

## 🌐 REST API Endpoints

### Health Check

#### GET `/health`

Check the health status of the service.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "redis": "connected",
  "websocket": 5
}
```

**Example Request:**
```bash
curl http://20.40.57.32:3000/health
```

---

### Get Tokens

#### GET `/api/tokens`

Retrieve filtered and paginated token data.

**Query Parameters:**

| Parameter | Type | Description | Default | Example |
|-----------|------|-------------|---------|---------|
| `limit` | number | Number of tokens per page | 20 | `?limit=50` |
| `cursor` | string | Pagination cursor | - | `?cursor=20` |
| `sortField` | string | Sort field | `volume24h` | `?sortField=priceUsd` |
| `sortDirection` | string | Sort direction (`asc`, `desc`) | `desc` | `?sortDirection=asc` |
| `minVolume` | number | Minimum 24h volume filter | - | `?minVolume=1000` |
| `maxVolume` | number | Maximum 24h volume filter | - | `?maxVolume=100000` |
| `minPriceChange` | number | Minimum 24h price change filter (%) | - | `?minPriceChange=10` |
| `maxPriceChange` | number | Maximum 24h price change filter (%) | - | `?maxPriceChange=50` |
| `dexIds` | string | Comma-separated DEX IDs | - | `?dexIds=raydium,meteora` |
| `symbols` | string | Comma-separated token symbols | - | `?symbols=SOL,BONK` |
| `timePeriod` | string | Time period filter | - | `?timePeriod=24h` |

**Available Sort Fields:**
- `volume24h` - 24-hour trading volume
- `priceChange24h` - 24-hour price change percentage
- `marketCap` - Market capitalization
- `priceUsd` - USD price
- `liquidity` - Liquidity amount

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "address": "G1DXVVmqJs8Ei79QbK41dpgk2WtXSGqLtx9of7o8BAGS",
      "symbol": "SOL",
      "name": "Solana",
      "priceUsd": 0.0002250,
      "priceNative": 0.0002250,
      "volume24h": 1500000,
      "priceChange24h": 15.5,
      "marketCap": 50000000,
      "liquidity": 2500000,
      "dexId": "raydium,meteora",
      "pairAddress": "pair123...",
      "chainId": "solana",
      "lastUpdated": 1640995200000
    }
  ],
  "pagination": {
    "nextCursor": "20",
    "hasMore": true,
    "total": 100
  },
  "filters": {
    "minVolume": 1000,
    "dexIds": ["raydium", "meteora"]
  },
  "sort": {
    "field": "volume24h",
    "direction": "desc"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Example Requests:**

```bash
# Basic request
curl "http://20.40.57.32:3000/api/tokens"

# Filtered by volume and sorted by price
curl "http://20.40.57.32:3000/api/tokens?minVolume=1000&sortField=priceUsd&sortDirection=asc&limit=10"

# Filter by specific DEXs
curl "http://20.40.57.32:3000/api/tokens?dexIds=raydium,meteora&limit=5"

# Pagination
curl "http://20.40.57.32:3000/api/tokens?limit=20&cursor=40"

# Price change filter
curl "http://20.40.57.32:3000/api/tokens?minPriceChange=10&maxPriceChange=50"
```

---

### Get Token by Address

#### GET `/api/tokens/:address`

Retrieve a specific token by its address.

**Path Parameters:**
- `address` (string, required): Token contract address

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "G1DXVVmqJs8Ei79QbK41dpgk2WtXSGqLtx9of7o8BAGS",
    "symbol": "SOL",
    "name": "Solana",
    "priceUsd": 0.0002250,
    "priceNative": 0.0002250,
    "volume24h": 1500000,
    "priceChange24h": 15.5,
    "marketCap": 50000000,
    "liquidity": 2500000,
    "dexId": "raydium",
    "pairAddress": "pair123...",
    "chainId": "solana",
    "lastUpdated": 1640995200000
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Example Request:**
```bash
curl "http://20.40.57.32:3000/api/tokens/G1DXVVmqJs8Ei79QbK41dpgk2WtXSGqLtx9of7o8BAGS"
```

---

### Refresh Token Data

#### POST `/api/refresh`

Manually trigger a refresh of token data from external APIs.

**Response:**
```json
{
  "success": true,
  "message": "Token data refreshed successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Example Request:**
```bash
curl -X POST "http://20.40.57.32:3000/api/refresh"
```

---

### WebSocket Information

#### GET `/api/websocket`

Get WebSocket connection information and statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "ws://20.40.57.32:8080",
    "connectedClients": 5,
    "messageTypes": [
      "subscribe",
      "update-filters",
      "ping"
    ]
  }
}
```

**Example Request:**
```bash
curl "http://20.40.57.32:3000/api/websocket"
```

---

## 🔌 WebSocket API

### Connection

Connect to the WebSocket server at `ws://20.40.57.32:8080`.

### Message Types

#### Subscribe to Filtered Data

**Client → Server:**
```json
{
  "type": "subscribe",
  "filters": {
    "minVolume": 1000,
    "maxVolume": 100000,
    "minPriceChange": 10,
    "dexIds": ["raydium", "meteora"],
    "symbols": ["SOL", "BONK"]
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

**Server → Client:**
```json
{
  "type": "data",
  "data": {
    "data": [...tokens...],
    "nextCursor": "20",
    "hasMore": true,
    "total": 100
  }
}
```

#### Update Filters

**Client → Server:**
```json
{
  "type": "update-filters",
  "filters": {
    "minPriceChange": 20
  },
  "sort": {
    "field": "priceUsd",
    "direction": "asc"
  }
}
```

#### Ping/Pong

**Client → Server:**
```json
{
  "type": "ping"
}
```

**Server → Client:**
```json
{
  "type": "pong"
}
```

### Server Messages

#### Data Update
```json
{
  "type": "full-update",
  "data": [...all tokens...],
  "timestamp": 1640995200000
}
```

#### Price Update
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

#### Error Message
```json
{
  "type": "error",
  "message": "Invalid message format"
}
```

---

## 📊 Data Models

### TokenData

```typescript
interface TokenData {
  address: string;           // Token contract address
  symbol: string;            // Token symbol (e.g., "SOL")
  name: string;              // Token name (e.g., "Solana")
  priceUsd: number;          // Price in USD
  priceNative: number;       // Price in native token
  volume24h: number;         // 24-hour trading volume
  priceChange24h: number;    // 24-hour price change percentage
  marketCap: number;         // Market capitalization
  liquidity: number;         // Liquidity amount
  dexId: string;             // DEX identifier(s)
  pairAddress: string;       // Trading pair address
  chainId: string;           // Blockchain identifier
  lastUpdated: number;       // Last update timestamp
}
```

### FilterOptions

```typescript
interface FilterOptions {
  timePeriod?: '1h' | '24h' | '7d';
  minVolume?: number;
  maxVolume?: number;
  minPriceChange?: number;
  maxPriceChange?: number;
  dexIds?: string[];
  symbols?: string[];
}
```

### SortOptions

```typescript
interface SortOptions {
  field: 'volume24h' | 'priceChange24h' | 'marketCap' | 'priceUsd' | 'liquidity';
  direction: 'asc' | 'desc';
}
```

### PaginationOptions

```typescript
interface PaginationOptions {
  limit: number;
  cursor?: string;
}
```

---

## ❌ Error Handling

### HTTP Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "error": "Bad Request",
  "message": "Invalid query parameters"
}
```

#### 404 Not Found
```json
{
  "success": false,
  "error": "Not found",
  "message": "Route GET /api/invalid not found"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Something went wrong"
}
```

### WebSocket Error Responses

```json
{
  "type": "error",
  "message": "Invalid message format"
}
```

---

## 🧪 Examples

### JavaScript/Node.js

```javascript
// Fetch tokens with filters
const response = await fetch('http://20.40.57.32:3000/api/tokens?minVolume=1000&sortField=volume24h&limit=10');
const data = await response.json();
console.log(data);

// WebSocket connection
const ws = new WebSocket('ws://20.40.57.32:8080');

ws.onopen = () => {
  // Subscribe to filtered data
  ws.send(JSON.stringify({
    type: 'subscribe',
    filters: { minVolume: 1000 },
    sort: { field: 'volume24h', direction: 'desc' },
    pagination: { limit: 20 }
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

### Python

```python
import requests
import websocket
import json

# Fetch tokens
response = requests.get('http://20.40.57.32:3000/api/tokens', params={
    'minVolume': 1000,
    'sortField': 'volume24h',
    'limit': 10
})
data = response.json()
print(data)

# WebSocket connection
def on_message(ws, message):
    data = json.loads(message)
    print(f"Received: {data}")

def on_open(ws):
    # Subscribe to filtered data
    ws.send(json.dumps({
        "type": "subscribe",
        "filters": {"minVolume": 1000},
        "sort": {"field": "volume24h", "direction": "desc"},
        "pagination": {"limit": 20}
    }))

ws = websocket.WebSocketApp("ws://20.40.57.32:8080",
                          on_open=on_open,
                          on_message=on_message)
ws.run_forever()
```

### cURL Examples

```bash
# Health check
curl http://20.40.57.32:3000/health

# Get all tokens
curl "http://20.40.57.32:3000/api/tokens"

# Get tokens with volume filter
curl "http://20.40.57.32:3000/api/tokens?minVolume=1000&limit=5"

# Get specific token
curl "http://20.40.57.32:3000/api/tokens/G1DXVVmqJs8Ei79QbK41dpgk2WtXSGqLtx9of7o8BAGS"

# Refresh data
curl -X POST "http://20.40.57.32:3000/api/refresh"

# WebSocket info
curl "http://20.40.57.32:3000/api/websocket"
```

---

## 📈 Rate Limits & Performance

- **Cache TTL**: 30 seconds
- **Refresh Interval**: 5 seconds
- **Max Tokens per Request**: 100
- **WebSocket Connections**: No limit (scales with server capacity)

## 🔧 Configuration

The service can be configured using environment variables:

```env
# Server Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

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
REFRESH_INTERVAL_MS=5000

# WebSocket Configuration
WS_PORT=8080
WS_HOST=0.0.0.0
```

---

## 📞 Support

For questions or issues, please check the service health endpoint or contact the development team.

**Health Check**: `http://20.40.57.32:3000/health`
