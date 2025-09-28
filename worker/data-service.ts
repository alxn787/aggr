import { RedisService } from './redis';
import { ApiService, type TokenData } from './api-service';

export interface FilterOptions {
    timePeriod?: '1h' | '24h' | '7d';
    minVolume?: number;
    maxVolume?: number;
    minPriceChange?: number;
    maxPriceChange?: number;
    dexIds?: string[];
    symbols?: string[];
}

export interface SortOptions {
    field: 'volume24h' | 'priceChange24h' | 'marketCap' | 'priceUsd' | 'liquidity';
    direction: 'asc' | 'desc';
}

export interface PaginationOptions {
    limit: number;
    cursor?: string;
}

export interface PaginatedResult<T> {
    data: T[];
    nextCursor?: string;
    hasMore: boolean;
    total: number;
}

export class DataService {
    private redis: RedisService;
    private apiService: ApiService;
    private cacheKey = 'tokens:all';
    private cacheTTL = 30; // 30 seconds

    constructor(redis: RedisService, apiService: ApiService) {
        this.redis = redis;
        this.apiService = apiService;
    }

    async getTokens(
        filters: FilterOptions = {},
        sort: SortOptions = { field: 'volume24h', direction: 'desc' },
        pagination: PaginationOptions = { limit: 20 }
    ): Promise<PaginatedResult<TokenData>> {
        // Try to get from cache first
        let tokens = await this.redis.get(this.cacheKey);
        
        if (!tokens) {
            // Cache miss - fetch from APIs
            tokens = await this.refreshTokenData();
        }

        // Apply filters
        let filteredTokens = this.applyFilters(tokens, filters);

        // Apply sorting
        filteredTokens = this.applySorting(filteredTokens, sort);

        // Apply pagination
        const paginatedResult = this.applyPagination(filteredTokens, pagination);

        return paginatedResult;
    }

    async refreshTokenData(): Promise<TokenData[]> {
        try {
            const tokenAddresses = [
                'G1DXVVmqJs8Ei79QbK41dpgk2WtXSGqLtx9of7o8BAGS',
                'So11111111111111111111111111111111111111112'
            ];

            const newTokens = await this.apiService.fetchAllTokenData(tokenAddresses);
            
            if (newTokens.length === 0) {
                console.log('No tokens fetched, skipping update');
                return [];
            }
            
            const existingTokens = await this.redis.get(this.cacheKey) || [];
            
            const hasChanges = this.hasTokenDataChanged(existingTokens, newTokens);
            
            if (hasChanges) {
                console.log(`Data changed, updating cache and broadcasting update`);
                
                await this.redis.set(this.cacheKey, newTokens, this.cacheTTL);
                
                await this.redis.publish('token-updates', {
                    type: 'full-update',
                    data: newTokens,
                    timestamp: Date.now()
                });
            } else {
                console.log('No changes detected, skipping update');
            }

            return newTokens;
        } catch (error) {
            console.error('Error in refreshTokenData:', error);
            return [];
        }
    }

    private applyFilters(tokens: TokenData[], filters: FilterOptions): TokenData[] {
        return tokens.filter(token => {
            if (filters.timePeriod) {
                return true;
            }

            if (filters.minVolume !== undefined && token.volume24h < filters.minVolume) {
                return false;
            }
            if (filters.maxVolume !== undefined && token.volume24h > filters.maxVolume) {
                return false;
            }

            if (filters.minPriceChange !== undefined && token.priceChange24h < filters.minPriceChange) {
                return false;
            }
            if (filters.maxPriceChange !== undefined && token.priceChange24h > filters.maxPriceChange) {
                return false;
            }

            if (filters.dexIds && filters.dexIds.length > 0) {
                const tokenDexIds = token.dexId.split(',');
                if (!filters.dexIds.some(dexId => tokenDexIds.includes(dexId))) {
                    return false;
                }
            }

            if (filters.symbols && filters.symbols.length > 0) {
                if (!filters.symbols.includes(token.symbol)) {
                    return false;
                }
            }

            return true;
        });
    }

    private applySorting(tokens: TokenData[], sort: SortOptions): TokenData[] {
        return tokens.sort((a, b) => {
            const aValue = a[sort.field];
            const bValue = b[sort.field];
            
            if (sort.direction === 'asc') {
                return aValue - bValue;
            } else {
                return bValue - aValue;
            }
        });
    }

    private applyPagination(tokens: TokenData[], pagination: PaginationOptions): PaginatedResult<TokenData> {
        const { limit, cursor } = pagination;
        const total = tokens.length;
        
        let startIndex = 0;
        if (cursor) {
            const cursorIndex = parseInt(cursor);
            if (!isNaN(cursorIndex)) {
                startIndex = cursorIndex;
            }
        }

        const endIndex = startIndex + limit;
        const data = tokens.slice(startIndex, endIndex);
        const hasMore = endIndex < total;
        const nextCursor = hasMore ? endIndex.toString() : undefined;

        return {
            data,
            nextCursor,
            hasMore,
            total
        };
    }

    async getTokenByAddress(address: string): Promise<TokenData | null> {
        const tokens = await this.redis.get(this.cacheKey);
        if (!tokens) {
            return null;
        }

        return tokens.find((token: TokenData) => 
            token.address.toLowerCase() === address.toLowerCase()
        ) || null;
    }

    async updateTokenPrice(address: string, newPrice: number): Promise<void> {
        const tokens = await this.redis.get(this.cacheKey);
        if (!tokens) {
            return;
        }

        const tokenIndex = tokens.findIndex((token: TokenData) => 
            token.address.toLowerCase() === address.toLowerCase()
        );

        if (tokenIndex !== -1) {
            const oldPrice = tokens[tokenIndex].priceUsd;
            tokens[tokenIndex].priceUsd = newPrice;
            tokens[tokenIndex].lastUpdated = Date.now();

            // Update cache
            await this.redis.set(this.cacheKey, tokens, this.cacheTTL);

            // Publish price update
            await this.redis.publish('token-updates', {
                type: 'price-update',
                address: address,
                oldPrice,
                newPrice,
                timestamp: Date.now()
            });
        }
    }

    private hasTokenDataChanged(existingTokens: TokenData[], newTokens: TokenData[]): boolean {
        if (existingTokens.length !== newTokens.length) {
            return true;
        }

        const existingMap = new Map(existingTokens.map(token => [token.address, token]));
        
        for (const newToken of newTokens) {
            const existingToken = existingMap.get(newToken.address);
            
            if (!existingToken) {
                return true;
            }
            
            if (this.isTokenDifferent(existingToken, newToken)) {
                return true;
            }
        }
        
        return false;
    }
    
    private isTokenDifferent(existing: TokenData, incoming: TokenData): boolean {
        const threshold = 0.001;
        
        if (Math.abs(existing.priceUsd - incoming.priceUsd) > threshold) {
            return true;
        }
        
        if (Math.abs(existing.volume24h - incoming.volume24h) > existing.volume24h * 0.01) {
            return true;
        }
        
        if (Math.abs(existing.priceChange24h - incoming.priceChange24h) > 0.01) {
            return true;
        }
        
        if (existing.marketCap && incoming.marketCap && 
            Math.abs(existing.marketCap - incoming.marketCap) > existing.marketCap * 0.01) {
            return true;
        }
        
        if (Math.abs(existing.liquidity - incoming.liquidity) > existing.liquidity * 0.01) {
            return true;
        }
        
        return false;
    }

    async startPeriodicRefresh(intervalMs: number = 30000): Promise<void> {
        setInterval(async () => {
            try {
                await this.refreshTokenData();
            } catch (error) {
                console.error('Error during periodic refresh:', error);
            }
        }, intervalMs);
    }
}
