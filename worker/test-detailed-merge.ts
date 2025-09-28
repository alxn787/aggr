import { ApiService } from './api-service';
import { type TokenData } from './api-service';

async function testDetailedSolMerging() {
    console.log('Detailed SOL Token Merging Analysis...\n');
    const apiService = new ApiService();
    const solAddress = 'So11111111111111111111111111111111111111112';

    try {
        console.log('1. DEXSCREENER DATA:');
        console.log('============================================================');
        const dexscreenerData = await apiService.fetchDexScreenerData([solAddress]);
        console.log(`Found ${dexscreenerData.length} SOL pairs from DexScreener:\n`);
        dexscreenerData.forEach((token, index) => {
            console.log(`${index + 1}. DEX: ${token.dexId}`);
            console.log(`   Pair Address: ${token.pairAddress}`);
            console.log(`   Price USD: $${token.priceUsd.toFixed(2)}`);
            console.log(`   Price Native: ${token.priceNative.toFixed(4)} SOL`);
            console.log(`   Volume 24h: $${token.volume24h.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
            console.log(`   Price Change 24h: ${token.priceChange24h ? token.priceChange24h.toFixed(2) : 'N/A'}%`);
            console.log(`   Liquidity: $${token.liquidity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
            console.log(`   Market Cap: $${token.marketCap ? token.marketCap.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : 'N/A'}\n`);
        });

        console.log('\n2. JUPITER SEARCH DATA:');
        console.log('============================================================');
        const jupiterSearchData = await apiService.fetchJupiterSearchData('SOL');
        console.log(`Found ${jupiterSearchData.length} SOL-related tokens from Jupiter Search:\n`);
        jupiterSearchData.forEach((token, index) => {
            console.log(`${index + 1}. ${token.symbol} (${token.name})`);
            console.log(`   Address: ${token.address}`);
            console.log(`   Price USD: $${token.priceUsd.toFixed(10)}`);
            console.log(`   Volume 24h: $${token.volume24h.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`);
            console.log(`   Price Change 24h: ${token.priceChange24h ? token.priceChange24h.toFixed(15) : 'N/A'}%`);
            console.log(`   Market Cap: $${token.marketCap ? token.marketCap.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : 'N/A'}`);
            console.log(`   Liquidity: $${token.liquidity.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`);
            console.log(`   ────────────────────────────────────────────────────────────`);
        });

        console.log('\n3. MERGING PROCESS:');
        console.log('============================================================');
        const allTokensForMerge = [...dexscreenerData, ...jupiterSearchData];
        const mergedTokens = apiService['mergeDuplicateTokens'](allTokensForMerge);

        const solDexscreenerEntry = dexscreenerData.find(t => t.address === solAddress);
        const solJupiterEntry = jupiterSearchData.find(t => t.address === solAddress);

        if (solDexscreenerEntry) {
            console.log('SOL Token from DexScreener:');
            console.log(JSON.stringify(solDexscreenerEntry, null, 2));
        }
        if (solJupiterEntry) {
            console.log('\nSOL Token from Jupiter Search:');
            console.log(JSON.stringify(solJupiterEntry, null, 2));
        }

        console.log('\n4. FINAL MERGED DATA:');
        console.log('============================================================');
        const finalSolToken = mergedTokens.find(token => token.address === solAddress);
        if (finalSolToken) {
            console.log('Merged SOL Token:');
            console.log(JSON.stringify(finalSolToken, null, 2));

            console.log('\nMerging Analysis:');
            console.log(`- Price USD: $${finalSolToken.priceUsd.toFixed(2)} (minimum from all sources)`);
            console.log(`- Volume 24h: $${finalSolToken.volume24h.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} (aggregated)`);
            console.log(`- DEX IDs: ${finalSolToken.dexId} (combined from all sources)`);
            console.log(`- Last Updated: ${new Date(finalSolToken.lastUpdated).toISOString()}`);
        } else {
            console.log('SOL token not found in merged data.');
        }

        console.log('\nDetailed merge analysis completed!');

    } catch (error) {
        console.error('Detailed merge test failed:', error);
    }
}

testDetailedSolMerging();
