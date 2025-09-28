import { DataService } from './data-service';
import { ApiService } from './api-service';
import { RedisService } from './redis';

async function testSimpleInterval() {
    console.log('Testing 10 second interval with DexScreener only...\n');
    
    const redis = new RedisService();
    const apiService = new ApiService();
    const dataService = new DataService(redis, apiService);
    
    try {
        await redis.del('tokens:all');
        console.log('Cleared existing cache');
        
        let updateCount = 0;
        const startTime = Date.now();
        
        const subscription = await redis.subscribe('token-updates', (message) => {
            updateCount++;
            const elapsed = Date.now() - startTime;
            console.log(`Update ${updateCount} received after ${elapsed}ms`);
            console.log(`Message type: ${message.type}`);
            console.log(`Data length: ${message.data?.length || 0} tokens`);
            console.log(`Timestamp: ${new Date(message.timestamp).toISOString()}`);
            console.log('---');
        });
        
        console.log('Starting 10 second refresh interval...');
        await dataService.startPeriodicRefresh(10000);
        
        console.log('Monitoring for 30 seconds...');
        await new Promise(resolve => setTimeout(resolve, 30000));
        
        console.log(`\nSummary:`);
        console.log(`Total updates received: ${updateCount}`);
        console.log(`Expected updates (30s / 10s): ~3`);
        console.log(`Average interval: ${updateCount > 0 ? (Date.now() - startTime) / updateCount : 0}ms`);
        
        const cachedData = await redis.get('tokens:all');
        console.log(`Cached tokens: ${cachedData?.length || 0}`);
        
        if (cachedData && cachedData.length > 0) {
            console.log('\nSample cached token:');
            console.log(JSON.stringify(cachedData[0], null, 2));
        }
        
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await redis.close();
    }
}

testSimpleInterval();
