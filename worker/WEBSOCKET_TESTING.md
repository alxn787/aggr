# WebSocket Testing Guide

## Testing WebSocket with Postman

### 1. **Basic WebSocket Connection**
- **URL**: `ws://localhost:8080`
- **Connection Type**: WebSocket

### 2. **Message Types to Test**

#### **Subscribe to Data**
```json
{
  "type": "subscribe",
  "filters": {
    "minVolume": 1000000,
    "dexIds": ["raydium", "orca"]
  },
  "sort": {
    "field": "volume24h",
    "direction": "desc"
  },
  "pagination": {
    "limit": 10
  }
}
```

#### **Update Filters**
```json
{
  "type": "update-filters",
  "filters": {
    "minPriceChange": 10,
    "maxPriceChange": 100
  },
  "sort": {
    "field": "priceChange24h",
    "direction": "desc"
  }
}
```

#### **Ping Test**
```json
{
  "type": "ping"
}
```

### 3. **Expected Responses**

#### **Initial Data Response**
```json
{
  "type": "data",
  "data": {
    "data": [...],
    "nextCursor": "...",
    "hasMore": true,
    "total": 2
  }
}
```

#### **Real-time Updates**
```json
{
  "type": "full-update",
  "data": [...],
  "timestamp": 1759046662337
}
```

#### **Pong Response**
```json
{
  "type": "pong"
}
```

### 4. **Testing Steps**

1. **Start the server**: `bun run index.ts`
2. **Open Postman WebSocket tab**
3. **Connect to**: `ws://localhost:8080`
4. **Send subscribe message** (see above)
5. **Wait for initial data**
6. **Send update-filters message** to test filtering
7. **Send ping message** to test connection
8. **Wait for real-time updates** (updates every 5 seconds)

### 5. **Alternative WebSocket Testing Tools**

#### **Using wscat (Command Line)**
```bash
# Install wscat
npm install -g wscat

# Connect and test
wscat -c ws://localhost:8080

# Send messages
{"type": "subscribe", "filters": {}, "sort": {"field": "volume24h", "direction": "desc"}, "pagination": {"limit": 5}}
{"type": "ping"}
```

#### **Using Browser Console**
```javascript
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
    console.log('Connected');
    ws.send(JSON.stringify({
        type: 'subscribe',
        filters: {},
        sort: { field: 'volume24h', direction: 'desc' },
        pagination: { limit: 5 }
    }));
};

ws.onmessage = (event) => {
    console.log('Received:', JSON.parse(event.data));
};

ws.onclose = () => console.log('Disconnected');
ws.onerror = (error) => console.error('Error:', error);
```

### 6. **Testing Real-time Updates**

1. **Connect multiple WebSocket clients**
2. **Send refresh request**: `POST /api/refresh`
3. **Observe updates** being pushed to all connected clients
4. **Test filtering** by sending different filter messages
5. **Monitor performance** with multiple concurrent connections

### 7. **Expected Behavior**

- **Immediate response** to subscribe/update-filters
- **Real-time updates** every 5 seconds (configurable)
- **Filtered data** based on client preferences
- **Automatic reconnection** handling
- **Error messages** for invalid requests
