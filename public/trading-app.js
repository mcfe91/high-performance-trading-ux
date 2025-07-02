// Memory layout constants (shared with worker)
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

// Symbol mapping (same as worker)
const SYMBOL_MAP = new Map([
    ['EURUSD', 0], ['GBPUSD', 1], ['USDJPY', 2], ['BTCUSD', 3], ['ETHUSD', 4],
    ['AAPL', 5], ['TSLA', 6], ['MSFT', 7], ['EURGBP', 8], ['EURJPY', 9],
    ['GBPJPY', 10], ['USDCAD', 11], ['NZDUSD', 12], ['EURCHF', 13], ['GBPAUD', 14],
    ['AUDUSD', 15], ['USDCHF', 16], ['XAUUSD', 17], ['XAGUSD', 18], ['UKOIL', 19]
]);

const INDEX_TO_SYMBOL = new Map(
    Array.from(SYMBOL_MAP.entries()).map(([symbol, index]) => [index, symbol])
);

// Component Pool for performance
class ComponentPool {
    constructor(createFn, resetFn, initialSize = 50) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.available = [];
        this.inUse = new Set();
        
        for (let i = 0; i < initialSize; i++) {
            this.available.push(createFn());
        }
    }
    
    acquire() {
        let obj = this.available.pop();
        if (!obj) {
            obj = this.createFn();
            console.log('Pool exhausted, creating new object');
        }
        this.inUse.add(obj);
        return obj;
    }
    
    release(obj) {
        if (this.inUse.has(obj)) {
            this.inUse.delete(obj);
            this.resetFn(obj);
            this.available.push(obj);
        }
    }
    
    getStats() {
        return {
            available: this.available.length,
            inUse: this.inUse.size
        };
    }
}

// Render Batch for performance
class RenderBatch {
    constructor() {
        this.frameStart = 0;
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.avgFrameTime = 0;
    }
    
    processBatch(components) {
        this.frameStart = performance.now();
        
        let renderCount = 0;
        components.forEach(component => {
            if (component && component.dirty) {
                component.markDirty();
                renderCount++;
            }
        });
        
        const frameTime = performance.now() - this.frameStart;
        this.lastFrameTime = frameTime;
        this.frameCount++;
        this.avgFrameTime = (this.avgFrameTime * (this.frameCount - 1) + frameTime) / this.frameCount;
        
        if (this.frameCount % 60 === 0) {
            document.getElementById('frame-time').textContent = this.avgFrameTime.toFixed(10) + 'ms';
        }
        
        return renderCount;
    }
    
    getStats() {
        return {
            lastFrameTime: this.lastFrameTime,
            avgFrameTime: this.avgFrameTime,
            frameCount: this.frameCount
        };
    }
}

// PixiJS Components
class PriceDisplayComponent extends PIXI.Container {
    constructor() {
        super();
        this.symbol = '';
        this.price = 0;
        this.change = 0;
        this.dirty = true;
        this.setupGraphics();
    }
    
    setupGraphics() {
        this.background = new PIXI.Graphics();
        this.addChild(this.background);
        
        this.symbolText = new PIXI.Text('', {
            fontFamily: 'Courier New', fontSize: 14, fontWeight: 'bold', fill: 0xffffff
        });
        this.symbolText.x = 5; this.symbolText.y = 2;
        this.addChild(this.symbolText);
        
        this.priceText = new PIXI.Text('', {
            fontFamily: 'Courier New', fontSize: 16, fontWeight: 'bold', fill: 0xffffff
        });
        this.priceText.x = 5; this.priceText.y = 20;
        this.addChild(this.priceText);
        
        this.changeText = new PIXI.Text('', {
            fontFamily: 'Courier New', fontSize: 12, fill: 0xcccccc
        });
        this.changeText.x = 5; this.changeText.y = 40;
        this.addChild(this.changeText);
    }
    
    setup(symbol, price) {
        this.symbol = symbol;
        this.updatePrice(price, 0);
        this.visible = true;
    }
    
    updatePrice(price, change) {
        this.price = price;
        this.change = change;
        
        this.symbolText.text = this.symbol;
        this.priceText.text = price.toFixed(this.symbol.includes('JPY') ? 2 : 4);
        this.changeText.text = change >= 0 ? `+${change.toFixed(4)}` : change.toFixed(4);
        
        const color = change > 0 ? 0x00ff00 : change < 0 ? 0xff0000 : 0xffffff;
        this.priceText.style.fill = color;
        
        this.background.clear();
        const bgColor = change > 0 ? 0x001a00 : change < 0 ? 0x1a0000 : 0x1a1a1a;
        this.background.beginFill(bgColor, 0.8);
        this.background.drawRoundedRect(0, 0, 120, 60, 5);
        this.background.endFill();
        
        this.markDirty();
    }
    
    markDirty() {
        this.dirty = true;
    }
    
    reset() {
        this.visible = false;
        this.dirty = false;
        this.x = 0;
        this.y = 0;
    }
}

// Order Book Component
class OrderBookComponent extends PIXI.Container {
    constructor() {
        super();
        this.symbol = '';
        this.bids = [];
        this.asks = [];
        this.dirty = true;
        this.setupGraphics();
    }
    
    setupGraphics() {
        this.titleText = new PIXI.Text('Order Book', {
            fontFamily: 'Courier New', fontSize: 16, fontWeight: 'bold', fill: 0xffffff
        });
        this.titleText.x = 5; this.titleText.y = 5;
        this.addChild(this.titleText);
        
        const headerStyle = { fontFamily: 'Courier New', fontSize: 12, fill: 0xcccccc };
        
        const bidHeader = new PIXI.Text('BIDS', headerStyle);
        bidHeader.x = 5; bidHeader.y = 30;
        this.addChild(bidHeader);
        
        const askHeader = new PIXI.Text('ASKS', headerStyle);
        askHeader.x = 120; askHeader.y = 30;
        this.addChild(askHeader);
        
        this.bidContainer = new PIXI.Container();
        this.bidContainer.x = 5; this.bidContainer.y = 50;
        this.addChild(this.bidContainer);
        
        this.askContainer = new PIXI.Container();
        this.askContainer.x = 120; this.askContainer.y = 50;
        this.addChild(this.askContainer);
    }
    
    updateOrderBook(symbol, bids, asks) {
        this.symbol = symbol;
        this.bids = bids.slice(0, 10);
        this.asks = asks.slice(0, 10);
        this.titleText.text = `${symbol} Order Book`;
        this.renderLevels();
        this.markDirty();
    }
    
    renderLevels() {
        this.bidContainer.removeChildren();
        this.askContainer.removeChildren();
        
        const levelStyle = { fontFamily: 'Courier New', fontSize: 10, fill: 0xffffff };
        
        this.bids.forEach((bid, index) => {
            const levelText = new PIXI.Text(
                `${bid.price.toFixed(4)} ${this.formatSize(bid.size)}`,
                { ...levelStyle, fill: 0x00ff00 }
            );
            levelText.y = index * 15;
            this.bidContainer.addChild(levelText);
        });
        
        this.asks.forEach((ask, index) => {
            const levelText = new PIXI.Text(
                `${ask.price.toFixed(4)} ${this.formatSize(ask.size)}`,
                { ...levelStyle, fill: 0xff0000 }
            );
            levelText.y = index * 15;
            this.askContainer.addChild(levelText);
        });
    }
    
    formatSize(size) {
        if (size >= 1000000) return `${(size / 1000000).toFixed(1)}M`;
        if (size >= 1000) return `${(size / 1000).toFixed(0)}K`;
        return size.toString();
    }
    
    markDirty() { this.dirty = true; }
    reset() { this.visible = false; this.dirty = false; }
}

// Trade Feed Component
class TradeFeedComponent extends PIXI.Container {
    constructor() {
        super();
        this.trades = [];
        this.maxTrades = 15;
        this.dirty = true;
        this.setupGraphics();
    }
    
    setupGraphics() {
        this.titleText = new PIXI.Text('Live Trades', {
            fontFamily: 'Courier New', fontSize: 16, fontWeight: 'bold', fill: 0xffffff
        });
        this.titleText.x = 5; this.titleText.y = 5;
        this.addChild(this.titleText);
        
        this.tradeContainer = new PIXI.Container();
        this.tradeContainer.x = 5; this.tradeContainer.y = 30;
        this.addChild(this.tradeContainer);
    }
    
    addTrade(trade) {
        this.trades.unshift(trade);
        if (this.trades.length > this.maxTrades) {
            this.trades = this.trades.slice(0, this.maxTrades);
        }
        this.renderTrades();
        this.markDirty();
    }
    
    renderTrades() {
        this.tradeContainer.removeChildren();
        
        this.trades.forEach((trade, index) => {
            const color = trade.side === 'buy' ? 0x00ff00 : 0xff0000;
            const tradeText = new PIXI.Text(
                `${trade.symbol} ${trade.side.toUpperCase()} ${trade.price.toFixed(4)} ${this.formatSize(trade.size)}`,
                { fontFamily: 'Courier New', fontSize: 10, fill: color }
            );
            tradeText.y = index * 15;
            tradeText.alpha = Math.max(0.3, 1 - (index * 0.05));
            this.tradeContainer.addChild(tradeText);
        });
    }
    
    formatSize(size) {
        if (size >= 1000000) return `${(size / 1000000).toFixed(1)}M`;
        if (size >= 1000) return `${(size / 1000).toFixed(0)}K`;
        return size.toString();
    }
    
    markDirty() { this.dirty = true; }
    reset() { this.visible = false; this.dirty = false; }
}

// Main Trading Application
class TradingApp {
    constructor(canvas) {
        this.canvas = canvas;
        
        // Initialize PixiJS
        this.app = new PIXI.Application({
            view: canvas,
            width: canvas.width,
            height: canvas.height,
            backgroundColor: 0x0a0a0a,
            antialias: true,
            targetFrameRate: 120,
        });
        
        this.symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSD', 'ETHUSD'];
        this.activePriceDisplays = new Map();
        this.updateCount = 0;
        this.lastStatsUpdate = Date.now();
        this.connectionStatus = 'disconnected';
        this.stressTestMode = false;
        
        // Shared memory components
        this.sharedBuffer = null;
        this.priceArray = null;
        this.timestampArray = null;
        this.changeArray = null;
        this.volumeArray = null;
        this.bidArray = null;
        this.askArray = null;
        this.flagsArray = null;
        this.lastTimestamps = new Float64Array(MEMORY_LAYOUT.SYMBOL_COUNT);
        this.dataWorker = null;
        
        this.setupPerformanceSystems();
        this.setupUI();
        this.initializeSharedMemory();
        this.startStatsUpdates();
        
        console.log('Real-time Trading App initialized with WebSocket + SharedArrayBuffer');
    }
    
    setupPerformanceSystems() {
        this.renderBatch = new RenderBatch();
        this.priceDisplayPool = new ComponentPool(
            () => new PriceDisplayComponent(),
            (obj) => obj.reset(),
            100
        );
    }
    
    setupUI() {
        // Price displays container
        this.priceContainer = new PIXI.Container();
        this.priceContainer.x = 20; this.priceContainer.y = 20;
        this.app.stage.addChild(this.priceContainer);
        
        // Order book
        this.orderBook = new OrderBookComponent();
        this.orderBook.x = 800; this.orderBook.y = 20;
        this.app.stage.addChild(this.orderBook);
        
        // Trade feed
        this.tradeFeed = new TradeFeedComponent();
        this.tradeFeed.x = 20; this.tradeFeed.y = 400;
        this.app.stage.addChild(this.tradeFeed);
        
        // Performance stats display
        this.statsDisplay = new PIXI.Text('', {
            fontFamily: 'Courier New', fontSize: 12, fill: 0x00ff00
        });
        this.statsDisplay.x = 20; this.statsDisplay.y = canvas.height - 60;
        this.app.stage.addChild(this.statsDisplay);
        
        // Connection status display
        this.connectionDisplay = new PIXI.Text('', {
            fontFamily: 'Courier New', fontSize: 12, fill: 0x00ffff
        });
        this.connectionDisplay.x = 20; this.connectionDisplay.y = canvas.height - 40;
        this.app.stage.addChild(this.connectionDisplay);
    }
    
    initializeSharedMemory() {
        console.log('Initializing SharedArrayBuffer + WebSocket Worker system...');
        
        // Check if SharedArrayBuffer is supported
        if (typeof SharedArrayBuffer === 'undefined') {
            console.error('SharedArrayBuffer not supported. This app requires HTTPS and proper CORS headers.');
            this.showError('SharedArrayBuffer not supported. Please use HTTPS and proper CORS headers.');
            return;
        }
        
        try {
            // Create shared memory buffer
            this.sharedBuffer = new SharedArrayBuffer(MEMORY_LAYOUT.BUFFER_SIZE);
            
            // Create typed arrays pointing to shared memory
            this.priceArray = new Float32Array(this.sharedBuffer, MEMORY_LAYOUT.PRICE_OFFSET, MEMORY_LAYOUT.SYMBOL_COUNT);
            this.timestampArray = new Float64Array(this.sharedBuffer, MEMORY_LAYOUT.TIMESTAMP_OFFSET, MEMORY_LAYOUT.SYMBOL_COUNT);
            this.changeArray = new Float32Array(this.sharedBuffer, MEMORY_LAYOUT.CHANGE_OFFSET, MEMORY_LAYOUT.SYMBOL_COUNT);
            this.volumeArray = new Float32Array(this.sharedBuffer, MEMORY_LAYOUT.VOLUME_OFFSET, MEMORY_LAYOUT.SYMBOL_COUNT);
            this.bidArray = new Float32Array(this.sharedBuffer, MEMORY_LAYOUT.BID_OFFSET, MEMORY_LAYOUT.SYMBOL_COUNT);
            this.askArray = new Float32Array(this.sharedBuffer, MEMORY_LAYOUT.ASK_OFFSET, MEMORY_LAYOUT.SYMBOL_COUNT);
            this.flagsArray = new Uint8Array(this.sharedBuffer, MEMORY_LAYOUT.FLAGS_OFFSET, MEMORY_LAYOUT.SYMBOL_COUNT);
            
            // Initialize WebWorker
            this.dataWorker = new Worker('data-worker.js');
            
            this.dataWorker.onmessage = (event) => {
                const { type, data } = event.data;
                if (type === 'stats') {
                    this.handleWorkerStats(data);
                } else if (type === 'connection_status') {
                    this.handleConnectionStatus(data);
                }
            };
            
            this.dataWorker.onerror = (error) => {
                console.error('WebWorker error:', error);
                this.showError('WebWorker failed to initialize');
            };
            
            // Send shared buffer to worker and start connection
            this.dataWorker.postMessage({
                type: 'init',
                data: {
                    sharedBuffer: this.sharedBuffer,
                    serverUrl: 'ws://localhost:8080'
                }
            });
            
            // Start memory polling
            this.startMemoryPolling();
            
            console.log('SharedArrayBuffer + WebSocket Worker system initialized');
            
        } catch (error) {
            console.error('Failed to initialize SharedArrayBuffer system:', error);
            this.showError('Failed to initialize SharedArrayBuffer system');
        }
    }
    
    startMemoryPolling() {
        let debugCounter = 0;
        
        const pollMemory = () => {
            debugCounter++;
            
            const updatedComponents = [];
            let updatesThisFrame = 0;
            
            // Check each symbol for updates (same logic)
            for (let i = 0; i < MEMORY_LAYOUT.SYMBOL_COUNT; i++) {
                const isDirty = Atomics.load(this.flagsArray, i);
                
                if (isDirty) {
                    const price = this.priceArray[i];
                    const timestamp = this.timestampArray[i];
                    const change = this.changeArray[i];
                    const volume = this.volumeArray[i];
                    const bid = this.bidArray[i];
                    const ask = this.askArray[i];
                    
                    if (timestamp > this.lastTimestamps[i]) {
                        const symbol = INDEX_TO_SYMBOL.get(i);
                        if (symbol && price > 0) {
                            const component = this.updatePriceFromMemory(symbol, price, change, volume, bid, ask);
                            if (component) {
                                updatedComponents.push(component);
                            }
                            this.lastTimestamps[i] = timestamp;
                            updatesThisFrame++;
                        }
                    }
                    
                    Atomics.store(this.flagsArray, i, 0);
                }
            }
            
            this.updateCount += updatesThisFrame;

            if (updatedComponents.length > 0) {
                this.renderBatch.processBatch(updatedComponents);
            }
        };
        
        this.app.ticker.add(pollMemory);
        
        console.log('Memory polling synced to PixiJS render loop');
    }

    updatePriceFromMemory(symbol, price, change, volume, bid, ask) {
        let priceDisplay = this.activePriceDisplays.get(symbol);
        
        if (!priceDisplay) {
            priceDisplay = this.priceDisplayPool.acquire();
            priceDisplay.setup(symbol, price);
            
            // Position in grid
            const index = this.activePriceDisplays.size;
            const col = index % 5;
            const row = Math.floor(index / 5);
            priceDisplay.x = col * 140;
            priceDisplay.y = row * 80;
            
            this.priceContainer.addChild(priceDisplay);
            this.activePriceDisplays.set(symbol, priceDisplay);
        } else {
            priceDisplay.updatePrice(price, change);
        }
        
        // Update order book for first symbol
        if (this.activePriceDisplays.size === 1) {
            this.updateOrderBookFromMemory(symbol, bid, ask, volume);
        }
        
        // Simulate trade feed
        if (Math.random() < 0.05) { // 5% chance per update
            this.simulateTradeFromMemory(symbol, price, volume);
        }
        
        return priceDisplay;
    }
    
    updateOrderBookFromMemory(symbol, bid, ask, volume) {
        // Generate mock order book from bid/ask
        const bids = [];
        const asks = [];
        
        for (let i = 0; i < 10; i++) {
            bids.push({
                price: bid - (i * 0.0001),
                size: volume * (1 - i * 0.1)
            });
            asks.push({
                price: ask + (i * 0.0001),
                size: volume * (1 - i * 0.1)
            });
        }
        
        this.orderBook.updateOrderBook(symbol, bids, asks);
    }
    
    simulateTradeFromMemory(symbol, price, size) {
        const trade = {
            symbol,
            price,
            size: Math.floor(size / 10),
            side: Math.random() > 0.5 ? 'buy' : 'sell',
            timestamp: Date.now(),
            id: Math.random().toString(36).substr(2, 9)
        };
        
        this.tradeFeed.addTrade(trade);
    }
    
    handleWorkerStats(stats) {
        // Update connection status based on worker stats
        if (stats.connected !== undefined) {
            this.connectionStatus = stats.connected ? 'connected' : 'disconnected';
            this.updateConnectionStatus();
        }
    }
    
    handleConnectionStatus(data) {
        this.connectionStatus = data.connected ? 'connected' : 'disconnected';
        this.updateConnectionStatus();
    }
    
    updateConnectionStatus() {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            if (this.connectionStatus === 'connected') {
                statusElement.textContent = 'WebSocket: Connected ● Real-time market data';
                statusElement.className = 'connection-status connected';
            } else {
                statusElement.textContent = 'WebSocket: Disconnected ● No market data';
                statusElement.className = 'connection-status disconnected';
            }
        }
        
        // Update PixiJS connection display
        this.connectionDisplay.text = `Connection: ${this.connectionStatus}`;
        this.connectionDisplay.style.fill = this.connectionStatus === 'connected' ? 0x00ff00 : 0xff0000;
    }
    
    showError(message) {
        console.error(message);
        this.connectionDisplay.text = `Error: ${message}`;
        this.connectionDisplay.style.fill = 0xff0000;
    }
    
    startStatsUpdates() {
        setInterval(() => {
            const now = Date.now();
            const timeDiff = (now - this.lastStatsUpdate) / 1000;
            const updatesPerSec = Math.round(this.updateCount / timeDiff);
            
            // Update HTML stats
            document.getElementById('updates-per-sec').textContent = updatesPerSec;
            document.getElementById('active-symbols').textContent = this.activePriceDisplays.size;
            
            const poolStats = this.priceDisplayPool.getStats();
            document.getElementById('pool-available').textContent = poolStats.available;
            
            // Update PixiJS stats display
            const batchStats = this.renderBatch.getStats();
            this.statsDisplay.text = `WebSocket + SharedArrayBuffer | FPS: ${Math.round(this.app.ticker.FPS)} | Updates/sec: ${updatesPerSec} | Pool: ${poolStats.inUse}/${poolStats.available + poolStats.inUse}`;
            
            this.updateCount = 0;
            this.lastStatsUpdate = now;
        }, 1000);
    }
    
    // Control methods for UI buttons
    reconnectWebSocket() {
        if (this.dataWorker) {
            console.log('Reconnecting WebSocket...');
            this.dataWorker.postMessage({ type: 'reconnect' });
        }
    }
    
    addMoreSymbols() {
        const allSymbols = Array.from(SYMBOL_MAP.keys());
        const currentCount = this.symbols.length;
        if (currentCount < allSymbols.length) {
            this.symbols = allSymbols.slice(0, Math.min(currentCount + 2, allSymbols.length));
            console.log(`Added symbols. Total: ${this.symbols.length}`);
        }
    }
    
    removeSymbols() {
        if (this.symbols.length > 2) {
            const removedSymbols = this.symbols.slice(-2);
            this.symbols = this.symbols.slice(0, -2);
            
            removedSymbols.forEach(symbol => {
                const display = this.activePriceDisplays.get(symbol);
                if (display) {
                    this.priceContainer.removeChild(display);
                    this.priceDisplayPool.release(display);
                    this.activePriceDisplays.delete(symbol);
                }
            });
            
            console.log(`Removed symbols. Total: ${this.symbols.length}`);
        }
    }
    
    stressTest() {
        this.stressTestMode = !this.stressTestMode;
        
        if (this.stressTestMode) {
            this.symbols = Array.from(SYMBOL_MAP.keys()).slice(0, 15);
            console.log('Stress test mode ON - 15 symbols');
        } else {
            this.symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSD', 'ETHUSD'];
            
            // Remove extra displays
            this.activePriceDisplays.forEach((display, symbol) => {
                if (!this.symbols.includes(symbol)) {
                    this.priceContainer.removeChild(display);
                    this.priceDisplayPool.release(display);
                    this.activePriceDisplays.delete(symbol);
                }
            });
            console.log('Stress test mode OFF');
        }
    }
}