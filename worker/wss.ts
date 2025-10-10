import { WebSocketServer, WebSocket } from "ws";
import { RedisService } from "./redis";
import { DataService, type FilterOptions, type SortOptions, type PaginationOptions } from "./data-service";
import { config } from "./config";

interface ClientConnection extends WebSocket {
    id: string;
    filters?: FilterOptions;
    sort?: SortOptions;
    pagination?: PaginationOptions;
}

export class WSS {
    private wss: WebSocketServer;
    private redis: RedisService;
    private dataService: DataService;
    private clients: Map<string, ClientConnection> = new Map();

    constructor(redis: RedisService, dataService: DataService, port: number = config.websocket.port) {
        this.redis = redis;
        this.dataService = dataService;
        this.wss = new WebSocketServer({ port, host: config.websocket.host });

        this.wss.on("connection", (ws: WebSocket) => {
            const clientId = this.generateClientId();
            const client = ws as ClientConnection;
            client.id = clientId;
            
            this.clients.set(clientId, client);
            console.log(`Client ${clientId} connected`);

            ws.on("message", async (message: string) => {
                try {
                    const data = JSON.parse(message.toString());
                    await this.handleClientMessage(client, data);
                } catch (error) {
                    console.error("Error handling client message:", error);
                    this.sendError(client, "Invalid message format");
                }
            });

            ws.on("close", () => {
                this.clients.delete(clientId);
                console.log(`Client ${clientId} disconnected`);
            });

            ws.on("error", (error) => {
                console.error(`Client ${clientId} error:`, error);
                this.clients.delete(clientId);
            });

            this.sendInitialData(client);
        });

        this.redis.subscribe('token-updates', (update) => {
            this.broadcastUpdate(update);
        });

        console.log(`WebSocket server running on ws://${config.websocket.host}:${port}`);
    }

    private generateClientId(): string {
        return Math.random().toString(36).substr(2, 9);
    }

    private async handleClientMessage(client: ClientConnection, data: any) {
        switch (data.type) {
            case 'subscribe':
                client.filters = data.filters;
                client.sort = data.sort;
                client.pagination = data.pagination;
                
                const filteredData = await this.dataService.getTokens(
                    client.filters,
                    client.sort,
                    client.pagination
                );
                this.sendToClient(client, {
                    type: 'data',
                    data: filteredData
                });
                break;

            case 'update-filters':
                client.filters = { ...client.filters, ...data.filters };
                client.sort = { ...client.sort, ...data.sort };
                client.pagination = { ...client.pagination, ...data.pagination };
                
                const updatedData = await this.dataService.getTokens(
                    client.filters,
                    client.sort,
                    client.pagination
                );
                this.sendToClient(client, {
                    type: 'data',
                    data: updatedData
                });
                break;

            case 'ping':
                this.sendToClient(client, { type: 'pong' });
                break;

            default:
                this.sendError(client, `Unknown message type: ${data.type}`);
        }
    }

    private async sendInitialData(client: ClientConnection) {
        try {
            const data = await this.dataService.getTokens();
            this.sendToClient(client, {
                type: 'data',
                data: data
            });
        } catch (error) {
            console.error("Error sending initial data:", error);
            this.sendError(client, "Failed to load initial data");
        }
    }

    private sendToClient(client: ClientConnection, message: any) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    }

    private sendError(client: ClientConnection, error: string) {
        this.sendToClient(client, {
            type: 'error',
            message: error
        });
    }

    private async broadcastUpdate(update: any) {
        let message: string;
        
        if (update.type === 'full-update') {
            message = JSON.stringify({
                type: 'full-update',
                data: update.data,
                timestamp: update.timestamp
            });
        } else {
            message = JSON.stringify({
                type: 'update',
                data: update
            });
        }

        for (const [clientId, client] of this.clients) {
            if (client.readyState === WebSocket.OPEN) {
                if (this.shouldSendUpdateToClient(client, update)) {
                    client.send(message);
                }
            }
        }
    }

    private shouldSendUpdateToClient(client: ClientConnection, update: any): boolean {
        if (update.type === 'refresh') {
            return true;
        }

        if (update.type === 'full-update') {
            return true;
        }

        if (update.type === 'price-update' && client.filters) {
            return true;
        }

        return true;
    }

    sendUpdate(data: any) {
        const message = JSON.stringify({
            type: 'manual-update',
            data: data
        });

        for (const [clientId, client] of this.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        }
    }

    getConnectedClientsCount(): number {
        return this.clients.size;
    }

    async close(): Promise<void> {
        for (const [clientId, client] of this.clients) {
            client.close();
        }
        this.clients.clear();
        this.wss.close();
    }
}