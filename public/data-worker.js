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
    // Forex majors  
    ['EURUSD', 0], ['GBPUSD', 1], ['USDJPY', 2], ['USDCAD', 3], ['AUDUSD', 4], ['NZDUSD', 5], ['USDCHF', 6], ['EURGBP', 7], ['EURJPY', 8], ['GBPJPY', 9], ['EURCHF', 10], ['GBPAUD', 11],
    
    // More forex
    ['AUDCAD', 12], ['AUDCHF', 13], ['AUDNZD', 14], ['CADCHF', 15], ['CADJPY', 16], ['CHFJPY', 17], ['EURAUD', 18], ['EURCAD', 19],
    
    // Stocks
    ['AAPL', 20], ['TSLA', 21], ['MSFT', 22], ['GOOGL', 23], ['AMZN', 24], ['META', 25], ['NFLX', 26], ['NVDA', 27], ['AMD', 28], ['INTC', 29],
    
    // Crypto
    ['BTCUSD', 30], ['ETHUSD', 31], ['ADAUSD', 32], ['SOLUSD', 33], ['DOTUSD', 34], ['MATICUSD', 35], ['AVAXUSD', 36], ['ATOMUSD', 37],
    
    // Commodities  
    ['XAUUSD', 38], ['XAGUSD', 39], ['UKOIL', 40], ['NATGAS', 41], ['COPPER', 42], ['PLATINUM', 43],
    
    // Indices
    ['SPX500', 44], ['NASDAQ', 45], ['DOW30', 46], ['VIX', 47], ['DAX30', 48], ['FTSE100', 49]
]);

const SYMBOLS = [
    // Major Forex (existing)
    'EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSD', 'ETHUSD', 'AAPL', 'TSLA', 'MSFT', 'EURGBP', 'EURJPY', 'GBPJPY', 'USDCAD', 'NZDUSD', 'EURCHF', 'GBPAUD', 'AUDUSD', 'USDCHF', 'XAUUSD', 'XAGUSD', 'UKOIL',
    
    // More Forex pairs
    'AUDCAD', 'AUDCHF', 'AUDNZD', 'CADCHF', 'CADJPY', 'CHFJPY', 'EURAUD', 'EURCAD', 'EURNOK', 'EURNZD', 'EURSEK', 'GBPAUD', 'GBPCAD', 'GBPCHF', 'GBPNZD', 'NZDCAD', 'NZDCHF', 'NZDJPY', 'USDNOK', 'USDSEK',
    
    // Major Stocks  
    'GOOGL', 'AMZN', 'META', 'NFLX', 'NVDA', 'AMD', 'INTC', 'CRM', 'ORCL', 'ADBE', 'PYPL', 'DIS', 'BABA', 'JD', 'PDD', 'NIO', 'XPEV', 'LI', 'PLTR', 'SNOW',
    
    // More Crypto
    'ADAUSD', 'SOLUSD', 'DOTUSD', 'MATICUSD', 'AVAXUSD', 'ATOMUSD', 'ALGOUSD', 'XLMUSD', 'VETUSD', 'FILUSD', 'MANAUSD', 'SANDUSD', 'CHZUSD', 'ENJUSD', 'BATUSD',
    
    // Commodities & Metals
    'NATGAS', 'COPPER', 'PLATINUM', 'PALLADIUM', 'WHEAT', 'CORN', 'SUGAR', 'COFFEE', 'COCOA', 'COTTON', 'LUMBER', 'HEATING',
    
    // Indices
    'SPX500', 'NASDAQ', 'DOW30', 'RUSSELL', 'VIX', 'DAX30', 'FTSE100', 'CAC40', 'NIKKEI', 'HSI', 'ASX200', 'TSX'
];

function decodePriceUpdate(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const symbolIndex = view.getUint8(1);
    
    return {
        type: 'price_update',
        symbol: SYMBOLS[symbolIndex],
        price: view.getFloat64(2, true),
        change: view.getFloat64(10, true),
        volume: view.getUint32(18, true),
        bid: view.getFloat64(22, true),
        ask: view.getFloat64(30, true),
        timestamp: view.getFloat64(32, true)
    };
}

function decodeOrderBook(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const symbolIndex = view.getUint8(1);
    const symbol = SYMBOLS[symbolIndex];
    const timestamp = view.getFloat64(2, true);
    
    const bids = [];
    const asks = [];
    let offset = 10;
    
    // Decode 5 bid levels
    for (let i = 0; i < 5; i++) {
        const price = view.getFloat64(offset, true);
        const size = view.getUint32(offset + 8, true);
        if (price > 0) bids.push({ price, size });
        offset += 12;
    }
    
    // Decode 5 ask levels  
    for (let i = 0; i < 5; i++) {
        const price = view.getFloat64(offset, true);
        const size = view.getUint32(offset + 8, true);
        if (price > 0) asks.push({ price, size });
        offset += 12;
    }
    
    return {
        type: 'order_book',
        symbol,
        bids,
        asks,
        timestamp
    };
}

function decodeTrade(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const symbolIndex = view.getUint8(1);
    const idHash = view.getUint32(23, true);
    
    return {
        type: 'trade',
        symbol: SYMBOLS[symbolIndex],
        price: view.getFloat64(2, true),
        size: view.getUint32(10, true),
        side: view.getUint8(14) === 1 ? 'buy' : 'sell',
        timestamp: view.getFloat64(15, true),
        id: idHash.toString(16)
    };
}

function decodeBinaryMessage(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const messageType = view.getUint8(0);
    
    switch (messageType) {
        case 1: return decodePriceUpdate(arrayBuffer);
        case 2: return decodeOrderBook(arrayBuffer);
        case 3: return decodeTrade(arrayBuffer);
        default:
            console.warn('Unknown binary message type:', messageType);
            return null;
    }
}

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
            this.websocket.binaryType = 'arraybuffer';
            
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
                    const message = decodeBinaryMessage(event.data);
                    if (message) {
                    this.handleMarketData(message);
                    }
                } catch (error) {
                    console.error('Failed to parse binary message:', error);
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