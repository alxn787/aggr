import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { RedisService } from './redis';
import { DataService, type FilterOptions, type SortOptions, type PaginationOptions } from './data-service';
import { WSS } from './wss';
import { config } from './config';

export class Server {
    private app: express.Application;
    private redis: RedisService;
    private dataService: DataService;
    private wss: WSS;
    private port: number;

    constructor(port: number = 3000) {
        this.app = express();
        this.port = port;
        
        // Initialize services
        this.redis = new RedisService();
        this.dataService = new DataService(this.redis, new (require('./api-service').ApiService)());
        this.wss = new WSS(this.redis, this.dataService, 8080);
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware() {
        this.app.use(helmet());
        this.app.use(cors({
            origin: process.env.CORS_ORIGIN || '*',
            credentials: true
        }));
        this.app.use(morgan('combined'));
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
    }

    private setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                redis: this.redis ? 'connected' : 'disconnected',
                websocket: this.wss.getConnectedClientsCount()
            });
        });

        
        this.app.get('/api/tokens', async (req, res) => {
            try {
                const filters: FilterOptions = {
                    timePeriod: req.query.timePeriod as any,
                    minVolume: req.query.minVolume ? parseFloat(req.query.minVolume as string) : undefined,
                    maxVolume: req.query.maxVolume ? parseFloat(req.query.maxVolume as string) : undefined,
                    minPriceChange: req.query.minPriceChange ? parseFloat(req.query.minPriceChange as string) : undefined,
                    maxPriceChange: req.query.maxPriceChange ? parseFloat(req.query.maxPriceChange as string) : undefined,
                    dexIds: req.query.dexIds ? (req.query.dexIds as string).split(',') : undefined,
                    symbols: req.query.symbols ? (req.query.symbols as string).split(',') : undefined,
                };

                const sort: SortOptions = {
                    field: (req.query.sortField as any) || 'volume24h',
                    direction: (req.query.sortDirection as any) || 'desc'
                };

                const pagination: PaginationOptions = {
                    limit: parseInt(req.query.limit as string) || 20,
                    cursor: req.query.cursor as string
                };

                const result = await this.dataService.getTokens(filters, sort, pagination);
                
                res.json({
                    success: true,
                    data: result.data,
                    pagination: {
                        nextCursor: result.nextCursor,
                        hasMore: result.hasMore,
                        total: result.total
                    },
                    filters,
                    sort,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error fetching tokens:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to fetch tokens',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // Get specific token by address
        this.app.get('/api/tokens/:address', async (req, res) => {
            try {
                const { address } = req.params;
                const token = await this.dataService.getTokenByAddress(address);
                
                if (!token) {
                    return res.status(404).json({
                        success: false,
                        error: 'Token not found'
                    });
                }

                res.json({
                    success: true,
                    data: token,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error fetching token:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to fetch token',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // Refresh token data
        this.app.post('/api/refresh', async (req, res) => {
            try {
                await this.dataService.refreshTokenData();
                res.json({
                    success: true,
                    message: 'Token data refreshed successfully',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error refreshing tokens:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to refresh token data',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // WebSocket info
        this.app.get('/api/websocket', (req, res) => {
            res.json({
                success: true,
                data: {
                    url: `ws://localhost:8080`,
                    connectedClients: this.wss.getConnectedClientsCount(),
                    messageTypes: [
                        'subscribe',
                        'update-filters',
                        'ping'
                    ]
                }
            });
        });

        // Error handling middleware
        this.app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
            console.error('Unhandled error:', err);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
            });
        });

        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                success: false,
                error: 'Not found',
                message: `Route ${req.method} ${req.path} not found`
            });
        });
    }

    async start() {
        try {
            await this.dataService.startPeriodicRefresh(config.cache.refreshIntervalMs);

            this.app.listen(this.port, () => {
                console.log(`Server running on http://localhost:${this.port}`);
                console.log(`WebSocket server running on ws://localhost:8080`);
                console.log(`Health check: http://localhost:${this.port}/health`);
                console.log(`API docs: http://localhost:${this.port}/api/tokens`);
            });
        } catch (error) {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
    }

    async stop() {
        try {
            await this.wss.close();
            await this.redis.close();
            console.log('Server stopped gracefully');
        } catch (error) {
            console.error('Error stopping server:', error);
        }
    }
}
