import { Server } from './server';

async function main() {
    console.log('Starting MemeCoin Aggregator Service...');
    
    const server = new Server(3000);
    
    process.on('SIGINT', async () => {
        console.log('Received SIGINT, shutting down gracefully...');
        await server.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('Received SIGTERM, shutting down gracefully...');
        await server.stop();
        process.exit(0);
    });

    process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
        process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        process.exit(1);
    });

    await server.start();
}

main().catch((error) => {
    console.error('Failed to start application:', error);
    process.exit(1);
});