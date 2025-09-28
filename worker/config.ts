export const config = {
    server: {
        port: parseInt(process.env.PORT || '3000'),
        nodeEnv: process.env.NODE_ENV || 'development',
    },
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
    },
    api: {
        rateLimits: {
            dexscreener: parseInt(process.env.DEXSCREENER_RATE_LIMIT || '300'),
            jupiter: parseInt(process.env.JUPITER_RATE_LIMIT || '200'),
        },
    },
        cache: {
            ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '30'),
            refreshIntervalMs: parseInt(process.env.REFRESH_INTERVAL_MS || '5000'),
        },
    websocket: {
        port: parseInt(process.env.WS_PORT || '8080'),
    },
};
