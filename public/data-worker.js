const MEMORY_LAYOUT = {
    SYMBOL_COUNT: 50,
    PRICE_OFFSET: 0,
    TIMESTAMP_OFFSET: 200,
    CHANGE_OFFSET: 600,
    VOLUME_OFFSET: 800,
    BID_OFFSET: 1000,
    ASK_OFFSET: 1200,
    FLAGS_OFFSET: 1400,
    BUFFER_SIZE: 1500
};

const SYMBOL_MAP = new Map([
    ['EURUSD', 0], ['GBPUSD', 1], ['USDJPY', 2], ['BTCUSD', 3], ['ETHUSD', 4],
    ['AAPL', 5], ['TSLA', 6], ['MSFT', 7], ['EURGBP', 8], ['EURJPY', 9],
    ['GBPJPY', 10], ['USDCAD', 11], ['NZDUSD', 12], ['EURCHF', 13], ['GBPAUD', 14],
    ['AUDUSD', 15], ['USDCHF', 16], ['XAUUSD', 17], ['XAGUSD', 18], ['UKOIL', 19]
]);

let sharedBuffer, priceArray, timestampArray, changeArray, volumeArray, bidArray, askArray, flagsArray;
let updateCount = 0;

class MarketDataClient {
    constructor(serverUrl = 'ws://localhost:8080') {
        this.serverUrl = serverUrl;
        this.websocket = null;
        this.reconnectTimer = null;
        this.connectionRetryCount = 0;
        this.maxRetries = 10;
        this.reconnectDelay = 1000;
        this.isConnected = false;
    }
    
    connect() {
        try {
            console.log(`Connecting to market data server: ${this.serverUrl}`);
            
            this.websocket = new WebSocket(this.serverUrl);
            
            this.websocket.onopen = () => {
                console.log('WebSocket connected to market data server');
                this.isConnected = true;
                this.connectionRetryCount = 0;
                this.reconnectDelay = 1000;
                
                self.postMessage({
                    type: 'connection_status',
                    data: { connected: true }
                });
            };
            
            this.websocket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMarketData(message);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };
            
            this.websocket.onclose = (event) => {
                console.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
                this.isConnected = false;
                
                self.postMessage({
                    type: 'connection_status',
                    data: { connected: false }
                });
                
                if (event.code !== 1000 && this.connectionRetryCount < this.maxRetries) {
                    this.scheduleReconnect();
                }
            };
            
            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.isConnected = false;
            };
            
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            this.scheduleReconnect();
        }
    }
    
    scheduleReconnect() {
        if (this.connectionRetryCount >= this.maxRetries) {
            console.error(`Max reconnection attempts (${this.maxRetries}) reached. Giving up.`);
            return;
        }
        
        this.connectionRetryCount++;
        console.log(`Scheduling reconnection attempt ${this.connectionRetryCount}/${this.maxRetries} in ${this.reconnectDelay}ms`);
        
        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, this.reconnectDelay);
        
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5 + Math.random() * 1000, 30000);
    }
    
    handleMarketData(message) {
        switch (message.type) {
            case 'price_update':
                this.processPriceUpdate(message);
                break;
            case 'order_book':
                this.processOrderBook(message);
                break;
            case 'trade':
                this.processTrade(message);
                break;
            default:
                console.warn('Unknown message type:', message.type);
        }
    }
    
    processPriceUpdate(data) {
        const symbolIndex = SYMBOL_MAP.get(data.symbol);
        
        if (symbolIndex === undefined) {
            console.warn(`Unknown symbol: ${data.symbol}`);
            return;
        }
        
        priceArray[symbolIndex] = data.price;
        timestampArray[symbolIndex] = data.timestamp;
        changeArray[symbolIndex] = data.change || 0;
        volumeArray[symbolIndex] = data.volume || 0;
        bidArray[symbolIndex] = data.bid || data.price - 0.0001;
        askArray[symbolIndex] = data.ask || data.price + 0.0001;
        
        Atomics.store(flagsArray, symbolIndex, 1);
        
        updateCount++;
    }
    
    processOrderBook(data) {
        const symbolIndex = SYMBOL_MAP.get(data.symbol);
        
        if (symbolIndex !== undefined && data.bids && data.asks && data.bids.length > 0 && data.asks.length > 0) {
            bidArray[symbolIndex] = data.bids[0].price;
            askArray[symbolIndex] = data.asks[0].price;
            timestampArray[symbolIndex] = data.timestamp;
            
            Atomics.store(flagsArray, symbolIndex, 1);
        }
    }
    
    processTrade(data) {
        if (data.size > 500000) {
            console.log(`Large trade: ${data.symbol} ${data.side} ${data.size} @ ${data.price}`);
        }
    }
    
    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (this.websocket) {
            this.websocket.close(1000, 'Intentional disconnect');
            this.websocket = null;
        }
        
        this.isConnected = false;
        console.log('WebSocket disconnected');
    }
}

let marketDataClient = null;

self.onmessage = function(event) {
    const { type, data } = event.data;
    
    switch (type) {
        case 'init':
            initializeSharedMemory(data.sharedBuffer);
            initializeWebSocket(data.serverUrl);
            break;
            
        case 'connect':
            if (marketDataClient) {
                marketDataClient.connect();
            }
            break;
            
        case 'disconnect':
            if (marketDataClient) {
                marketDataClient.disconnect();
            }
            break;
            
        case 'reconnect':
            if (marketDataClient) {
                marketDataClient.disconnect();
                setTimeout(() => marketDataClient.connect(), 100);
            }
            break;
            
        default:
            console.log('Unknown message type:', type);
    }
};

function initializeSharedMemory(buffer) {
    console.log('Initializing shared memory in WebWorker');
    
    sharedBuffer = buffer;
    
    priceArray = new Float32Array(sharedBuffer, MEMORY_LAYOUT.PRICE_OFFSET, MEMORY_LAYOUT.SYMBOL_COUNT);
    timestampArray = new Float64Array(sharedBuffer, MEMORY_LAYOUT.TIMESTAMP_OFFSET, MEMORY_LAYOUT.SYMBOL_COUNT);
    changeArray = new Float32Array(sharedBuffer, MEMORY_LAYOUT.CHANGE_OFFSET, MEMORY_LAYOUT.SYMBOL_COUNT);
    volumeArray = new Float32Array(sharedBuffer, MEMORY_LAYOUT.VOLUME_OFFSET, MEMORY_LAYOUT.SYMBOL_COUNT);
    bidArray = new Float32Array(sharedBuffer, MEMORY_LAYOUT.BID_OFFSET, MEMORY_LAYOUT.SYMBOL_COUNT);
    askArray = new Float32Array(sharedBuffer, MEMORY_LAYOUT.ASK_OFFSET, MEMORY_LAYOUT.SYMBOL_COUNT);
    flagsArray = new Uint8Array(sharedBuffer, MEMORY_LAYOUT.FLAGS_OFFSET, MEMORY_LAYOUT.SYMBOL_COUNT);
    
    console.log('Shared memory arrays initialized:', {
        priceArray: priceArray.length,
        timestampArray: timestampArray.length,
        totalSymbols: MEMORY_LAYOUT.SYMBOL_COUNT
    });
}

function initializeWebSocket(serverUrl = 'ws://localhost:8080') {
    console.log('Initializing WebSocket client');
    
    marketDataClient = new MarketDataClient(serverUrl);
    marketDataClient.connect();
    
    setInterval(() => {
        self.postMessage({
            type: 'stats',
            data: {
                updatesPerSecond: updateCount,
                connected: marketDataClient ? marketDataClient.isConnected : false,
                activeSymbols: Array.from(SYMBOL_MAP.keys()).length,
                workerMemoryUsage: priceArray.length * 4
            }
        });
        updateCount = 0;
    }, 1000);
}

console.log('WebSocket Data Worker loaded and ready for real-time market data');