// WebWorker for high-performance data processing
// This handles all WebSocket processing and writes to shared memory

// Memory layout constants
const MEMORY_LAYOUT = {
    SYMBOL_COUNT: 50,
    PRICE_OFFSET: 0,          // Float32Array: 0-200 bytes
    TIMESTAMP_OFFSET: 200,    // Float64Array: 200-600 bytes  
    CHANGE_OFFSET: 600,       // Float32Array: 600-800 bytes
    VOLUME_OFFSET: 800,       // Float32Array: 800-1000 bytes
    BID_OFFSET: 1000,         // Float32Array: 1000-1200 bytes
    ASK_OFFSET: 1200,         // Float32Array: 1200-1400 bytes
    FLAGS_OFFSET: 1400,       // Uint8Array: 1400+ bytes (dirty flags)
    BUFFER_SIZE: 1500         // 1.5KB total
};

// Symbol to index mapping
const SYMBOL_MAP = new Map([
    ['EURUSD', 0], ['GBPUSD', 1], ['USDJPY', 2], ['BTCUSD', 3], ['ETHUSD', 4],
    ['AAPL', 5], ['TSLA', 6], ['MSFT', 7], ['EURGBP', 8], ['EURJPY', 9],
    ['GBPJPY', 10], ['USDCAD', 11], ['NZDUSD', 12], ['EURCHF', 13], ['GBPAUD', 14],
    ['AUDUSD', 15], ['USDCHF', 16], ['XAUUSD', 17], ['XAGUSD', 18], ['UKOIL', 19]
]);

// Global variables - DECLARED ONLY ONCE
let sharedBuffer, priceArray, timestampArray, changeArray, volumeArray, bidArray, askArray, flagsArray;
let updateCount = 0;
let mockServer;

// Mock data generation for ultra-high frequency
class UltraHighFrequencyGenerator {
    constructor() {
        this.symbols = Array.from(SYMBOL_MAP.keys()).map(symbol => ({
            symbol,
            basePrice: symbol === 'USDJPY' ? 149 : symbol.includes('XAU') ? 2000 : symbol.includes('OIL') ? 80 : 1.2,
            volatility: symbol.includes('BTC') ? 100 : symbol.includes('XAU') ? 5 : 0.001,
            trend: (Math.random() - 0.5) * 0.001
        }));
        
        this.orderBooks = new Map();
        this.initializeOrderBooks();
        this.isRunning = false;
    }
    
    initializeOrderBooks() {
        this.symbols.forEach(({symbol, basePrice}) => {
            const book = { bids: [], asks: [] };
            for (let i = 0; i < 10; i++) {
                book.bids.push({ price: basePrice - i * 0.0001, size: Math.random() * 1000000 });
                book.asks.push({ price: basePrice + i * 0.0001, size: Math.random() * 1000000 });
            }
            this.orderBooks.set(symbol, book);
        });
    }
    
    start() {
        this.isRunning = true;
        
        // Ultra-high frequency price generation
        // Multiple intervals for different update speeds
        [1, 2, 3, 5, 8, 13].forEach(interval => {
            const timer = setInterval(() => {
                if (!this.isRunning) {
                    clearInterval(timer);
                    return;
                }
                
                // Update multiple symbols per interval
                const updateCount = Math.floor(Math.random() * 3) + 1;
                for (let i = 0; i < updateCount; i++) {
                    this.generatePriceUpdate();
                }
            }, interval);
        });
        
        console.log('🔥 Ultra-high frequency generator started in WebWorker');
    }
    
    generatePriceUpdate() {
        const symbolData = this.symbols[Math.floor(Math.random() * this.symbols.length)];
        const symbolIndex = SYMBOL_MAP.get(symbolData.symbol);
        
        if (symbolIndex === undefined) return;
        
        // Generate realistic price movement
        const currentPrice = priceArray[symbolIndex] || symbolData.basePrice;
        const randomWalk = (Math.random() - 0.5) * symbolData.volatility;
        const trendComponent = symbolData.trend * Math.sin(Date.now() / 10000);
        const newPrice = Math.max(0.01, currentPrice + randomWalk + trendComponent);
        const change = newPrice - currentPrice;
        const volume = Math.floor(Math.random() * 1000000) + 50000;
        
        // Get order book for bid/ask
        const book = this.orderBooks.get(symbolData.symbol);
        const bid = book ? book.bids[0].price : newPrice - 0.0001;
        const ask = book ? book.asks[0].price : newPrice + 0.0001;
        
        // Direct writes to shared memory 
        priceArray[symbolIndex] = newPrice;
        timestampArray[symbolIndex] = Date.now();
        changeArray[symbolIndex] = change;
        volumeArray[symbolIndex] = volume;
        bidArray[symbolIndex] = bid;
        askArray[symbolIndex] = ask;
        
        // Set dirty flag using Atomics (flagsArray is Uint8Array)
        Atomics.store(flagsArray, symbolIndex, 1);
        
        updateCount++;
        
        // Occasionally update the base price for trending
        if (Math.random() < 0.001) {
            symbolData.basePrice = newPrice;
            symbolData.trend = (Math.random() - 0.5) * 0.001;
        }
    }
    
    stop() {
        this.isRunning = false;
    }
}

// WebWorker message handler
self.onmessage = function(event) {
    const { type, data } = event.data;
    
    switch (type) {
        case 'init':
            initializeSharedMemory(data.sharedBuffer);
            startDataGeneration(data.symbols);
            break;
            
        case 'start':
            if (mockServer) mockServer.start();
            break;
            
        case 'stop':
            if (mockServer) mockServer.stop();
            break;
            
        case 'add_symbols':
            // Add new symbols to generation
            break;
            
        default:
            console.log('Unknown message type:', type);
    }
};

function initializeSharedMemory(buffer) {
    console.log('🧠 Initializing shared memory in WebWorker');
    
    // ASSIGNMENT only - variable already declared at top
    sharedBuffer = buffer;
    
    // Create typed arrays pointing to shared memory
    priceArray = new Float32Array(sharedBuffer, MEMORY_LAYOUT.PRICE_OFFSET, MEMORY_LAYOUT.SYMBOL_COUNT);
    timestampArray = new Float64Array(sharedBuffer, MEMORY_LAYOUT.TIMESTAMP_OFFSET, MEMORY_LAYOUT.SYMBOL_COUNT);
    changeArray = new Float32Array(sharedBuffer, MEMORY_LAYOUT.CHANGE_OFFSET, MEMORY_LAYOUT.SYMBOL_COUNT);
    volumeArray = new Float32Array(sharedBuffer, MEMORY_LAYOUT.VOLUME_OFFSET, MEMORY_LAYOUT.SYMBOL_COUNT);
    bidArray = new Float32Array(sharedBuffer, MEMORY_LAYOUT.BID_OFFSET, MEMORY_LAYOUT.SYMBOL_COUNT);
    askArray = new Float32Array(sharedBuffer, MEMORY_LAYOUT.ASK_OFFSET, MEMORY_LAYOUT.SYMBOL_COUNT);
    flagsArray = new Uint8Array(sharedBuffer, MEMORY_LAYOUT.FLAGS_OFFSET, MEMORY_LAYOUT.SYMBOL_COUNT);
    
    console.log('✅ Shared memory arrays initialized:', {
        priceArray: priceArray.length,
        timestampArray: timestampArray.length,
        totalSymbols: MEMORY_LAYOUT.SYMBOL_COUNT
    });
}

function startDataGeneration(symbols) {
    console.log('🚀 Starting ultra-high frequency data generation');
    
    mockServer = new UltraHighFrequencyGenerator();
    mockServer.start();
    
    // Send periodic stats back to main thread
    setInterval(() => {
        self.postMessage({
            type: 'stats',
            data: {
                updatesPerSecond: updateCount,
                activeSymbols: Array.from(SYMBOL_MAP.keys()).length,
                workerMemoryUsage: priceArray.length * 4 // bytes
            }
        });
        updateCount = 0;
    }, 1000);
}

console.log('💪 WebWorker loaded and ready for shared memory operations');