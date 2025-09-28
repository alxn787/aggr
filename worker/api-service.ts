import axios, { type AxiosResponse } from 'axios';

export interface TokenData {
    address: string;
    symbol: string;
    name: string;
    priceUsd: number;
    priceNative: number;
    volume24h: number;
    priceChange24h: number;
    marketCap: number;
    liquidity: number;
    dexId: string;
    pairAddress: string;
    chainId: string;
    lastUpdated: number;
}

export interface DexScreenerResponse {
    pairs: Array<{
        chainId: string;
        dexId: string;
        pairAddress: string;
        baseToken: {
            address: string;
            symbol: string;
            name: string;
        };
        quoteToken: {
            address: string;
            symbol: string;
            name: string;
        };
        priceUsd: string;
        priceNative: string;
        volume: {
            h24: number;
        };
        priceChange: {
            h24: number;
        };
        liquidity: {
            usd: number;
        };
        marketCap: number;
        fdv: number;
    }>;
}


export class RateLimiter {
    private requests: Map<string, number[]> = new Map();
    private maxRequests: number;
    private windowMs: number;

    constructor(maxRequests: number = 300, windowMs: number = 60000) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
    }

    canMakeRequest(key: string): boolean {
        const now = Date.now();
        const requests = this.requests.get(key) || [];
        
        // Remove old requests outside the window
        const validRequests = requests.filter(time => now - time < this.windowMs);
        
        if (validRequests.length >= this.maxRequests) {
            return false;
        }
        
        validRequests.push(now);
        this.requests.set(key, validRequests);
        return true;
    }

    getWaitTime(key: string): number {
        const now = Date.now();
        const requests = this.requests.get(key) || [];
        const validRequests = requests.filter(time => now - time < this.windowMs);
        
        if (validRequests.length < this.maxRequests) {
            return 0;
        }
        
        const oldestRequest = Math.min(...validRequests);
        return this.windowMs - (now - oldestRequest);
    }
}

export class ApiService {
    private rateLimiters: Map<string, RateLimiter> = new Map();
    private retryDelays = [1000, 2000, 4000, 8000];

    constructor() {
        this.rateLimiters.set('dexscreener', new RateLimiter(300, 60000));
        this.rateLimiters.set('jupiter', new RateLimiter(200, 60000));
    }

    private async makeRequestWithRetry<T>(
        url: string,
        apiKey: string,
        retryCount: number = 0
    ): Promise<AxiosResponse<T>> {
        const rateLimiter = this.rateLimiters.get(apiKey);
        
        if (rateLimiter && !rateLimiter.canMakeRequest(apiKey)) {
            const waitTime = rateLimiter.getWaitTime(apiKey);
            console.log(`Rate limited for ${apiKey}, waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        try {
            const response = await axios.get<T>(url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'MemeCoinAggregator/1.0',
                },
            });
            return response;
        } catch (error: any) {
            if (retryCount < this.retryDelays.length && error.response?.status >= 500) {
                const delay = this.retryDelays[retryCount];
                console.log(`Request failed, retrying in ${delay}ms (attempt ${retryCount + 1})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.makeRequestWithRetry(url, apiKey, retryCount + 1);
            }
            throw error;
        }
    }

    async fetchDexScreenerData(tokenAddresses: string[]): Promise<TokenData[]> {
        try {
            const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddresses.join(',')}`;
            const response = await this.makeRequestWithRetry<DexScreenerResponse>(url, 'dexscreener');
            
            return response.data.pairs.map(pair => ({
                address: pair.baseToken.address,
                symbol: pair.baseToken.symbol,
                name: pair.baseToken.name,
                priceUsd: parseFloat(pair.priceUsd),
                priceNative: parseFloat(pair.priceNative),
                volume24h: pair.volume.h24,
                priceChange24h: pair.priceChange?.h24 || 0,
                marketCap: pair.marketCap || pair.fdv,
                liquidity: pair.liquidity.usd,
                dexId: pair.dexId,
                pairAddress: pair.pairAddress,
                chainId: pair.chainId,
                lastUpdated: Date.now(),
            }));
        } catch (error) {
            console.error('DexScreener API error:', error);
            return [];
        }
    }


    async fetchJupiterSearchData(query: string = 'SOL'): Promise<TokenData[]> {
        try {
            const url = `https://lite-api.jup.ag/tokens/v2/search?query=${query}`;
            const response = await this.makeRequestWithRetry<any>(url, 'jupiter');
            
            return response.data?.map((token: any) => ({
                address: token.id,
                symbol: token.symbol,
                name: token.name,
                priceUsd: token.usdPrice || 0,
                priceNative: 0,
                volume24h: token.stats24h?.buyVolume + token.stats24h?.sellVolume || 0,
                priceChange24h: token.stats24h?.priceChange || 0,
                marketCap: token.mcap || token.fdv || 0,
                liquidity: token.liquidity || 0,
                dexId: 'jupiter-search',
                pairAddress: token.firstPool?.id || '',
                chainId: 'solana',
                lastUpdated: Date.now(),
            })) || [];
        } catch (error) {
            console.error('Jupiter Search API error:', error);
            return [];
        }
    }

    async fetchAllTokenData(tokenAddresses: string[]): Promise<TokenData[]> {
        const [dexscreenerData, jupiterSearchData] = await Promise.allSettled([
            this.fetchDexScreenerData(tokenAddresses),
            this.fetchJupiterSearchData('SOL'),
        ]);

        const allTokens: TokenData[] = [];
        
        if (dexscreenerData.status === 'fulfilled') {
            allTokens.push(...dexscreenerData.value);
        }
        
        if (jupiterSearchData.status === 'fulfilled') {
            allTokens.push(...jupiterSearchData.value);
        }

        return this.mergeDuplicateTokens(allTokens);
    }

    private mergeDuplicateTokens(tokens: TokenData[]): TokenData[] {
        const tokenMap = new Map<string, TokenData>();

        for (const token of tokens) {
            const key = token.address.toLowerCase();
            const existing = tokenMap.get(key);

            if (!existing) {
                tokenMap.set(key, token);
            } else {
                // Merge logic: prefer data with higher volume or more complete data
                const merged = this.mergeTokenData(existing, token);
                tokenMap.set(key, merged);
            }
        }

        return Array.from(tokenMap.values());
    }

    private mergeTokenData(existing: TokenData, incoming: TokenData): TokenData {
        return {
            address: existing.address,
            symbol: existing.symbol || incoming.symbol,
            name: existing.name || incoming.name,
            priceUsd: Math.min(existing.priceUsd, incoming.priceUsd),
            priceNative: Math.min(existing.priceNative, incoming.priceNative),
            volume24h: Math.max(existing.volume24h, incoming.volume24h),
            priceChange24h: existing.priceChange24h || incoming.priceChange24h,
            marketCap: Math.max(existing.marketCap, incoming.marketCap),
            liquidity: Math.max(existing.liquidity, incoming.liquidity),
            dexId: `${existing.dexId},${incoming.dexId}`,
            pairAddress: existing.pairAddress || incoming.pairAddress,
            chainId: existing.chainId || incoming.chainId,
            lastUpdated: Math.max(existing.lastUpdated, incoming.lastUpdated),
        };
    }
}
