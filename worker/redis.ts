import Redis from 'ioredis';

export class RedisService {
    private redis: Redis;

    constructor() {
        this.redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            maxRetriesPerRequest: 3,
        });

        this.redis.on('error', (err) => {
            console.error('Redis connection error:', err);
        });

        this.redis.on('connect', () => {
            console.log('Connected to Redis');
        });
    }

    async set(key: string, value: any, ttlSeconds: number = 30): Promise<void> {
        await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
    }

    async get(key: string): Promise<any> {
        const value = await this.redis.get(key);
        return value ? JSON.parse(value) : null;
    }

    async del(key: string): Promise<void> {
        await this.redis.del(key);
    }

    async exists(key: string): Promise<boolean> {
        const result = await this.redis.exists(key);
        return result === 1;
    }

    async setHash(key: string, field: string, value: any): Promise<void> {
        await this.redis.hset(key, field, JSON.stringify(value));
    }

    async getHash(key: string, field: string): Promise<any> {
        const value = await this.redis.hget(key, field);
        return value ? JSON.parse(value) : null;
    }

    async getAllHash(key: string): Promise<Record<string, any>> {
        const hash = await this.redis.hgetall(key);
        const result: Record<string, any> = {};
        for (const [field, value] of Object.entries(hash)) {
            result[field] = JSON.parse(value);
        }
        return result;
    }

    async publish(channel: string, message: any): Promise<void> {
        await this.redis.publish(channel, JSON.stringify(message));
    }

    async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
        const subscriber = this.redis.duplicate();
        await subscriber.subscribe(channel);
        subscriber.on('message', (ch, message) => {
            if (ch === channel) {
                callback(JSON.parse(message));
            }
        });
    }

    async close(): Promise<void> {
        await this.redis.quit();
    }
}
