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
const INDEX_TO_SYMBOL = new Map(
    Array.from(SYMBOL_MAP.entries()).map(([symbol, index]) => [index, symbol])
);

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

class RenderBatch {
    constructor() {
        this.frameStart = 0;
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.avgFrameTime = 0;
    }
    
    processBatch(componentCount) {
        this.frameStart = performance.now();
        
        const frameTime = performance.now() - this.frameStart;
        this.lastFrameTime = frameTime;
        this.frameCount++;
        this.avgFrameTime = (this.avgFrameTime * (this.frameCount - 1) + frameTime) / this.frameCount;
        
        if (this.frameCount % 60 === 0) {
            document.getElementById('frame-time').textContent = this.avgFrameTime.toFixed(2) + 'ms';
        }
        
        return componentCount;
    }
    
    getStats() {
        return {
            lastFrameTime: this.lastFrameTime,
            avgFrameTime: this.avgFrameTime,
            frameCount: this.frameCount
        };
    }
}

class PriceDisplayComponent extends PIXI.Container {
    constructor() {
        super();
        this.symbol = '';
        this.price = 0;
        this.change = 0;
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
    }
    
    reset() {
        this.visible = false;
        this.x = 0;
        this.y = 0;
    }
}

class OrderBookComponent extends PIXI.Container {
    constructor() {
        super();
        this.symbol = '';
        this.bids = [];
        this.asks = [];
        
        this.bidTextPool = new ComponentPool(
            () => new PIXI.Text('', { fontFamily: 'Courier New', fontSize: 10, fill: 0x00ff00 }),
            (text) => { text.text = ''; text.visible = false; text.y = 0; }
        );
        this.askTextPool = new ComponentPool(
            () => new PIXI.Text('', { fontFamily: 'Courier New', fontSize: 10, fill: 0xff0000 }),
            (text) => { text.text = ''; text.visible = false; text.y = 0; }
        );
        
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
    }
    
    renderLevels() {
        this.bidContainer.children.forEach(text => this.bidTextPool.release(text));
        this.askContainer.children.forEach(text => this.askTextPool.release(text));
        this.bidContainer.removeChildren();
        this.askContainer.removeChildren();
        
        this.bids.forEach((bid, index) => {
            const levelText = this.bidTextPool.acquire();
            levelText.text = `${bid.price.toFixed(4)} ${this.formatSize(bid.size)}`;
            levelText.y = index * 15;
            levelText.visible = true;
            this.bidContainer.addChild(levelText);
        });
        
        this.asks.forEach((ask, index) => {
            const levelText = this.askTextPool.acquire();
            levelText.text = `${ask.price.toFixed(4)} ${this.formatSize(ask.size)}`;
            levelText.y = index * 15;
            levelText.visible = true;
            this.askContainer.addChild(levelText);
        });
    }
    
    formatSize(size) {
        if (size >= 1000000) return `${(size / 1000000).toFixed(1)}M`;
        if (size >= 1000) return `${(size / 1000).toFixed(0)}K`;
        return size.toString();
    }
    
    reset() {
        this.visible = false;
        this.bidContainer.children.forEach(text => this.bidTextPool.release(text));
        this.askContainer.children.forEach(text => this.askTextPool.release(text));
        this.bidContainer.removeChildren();
        this.askContainer.removeChildren();
    }
}

class TradeFeedComponent extends PIXI.Container {
    constructor() {
        super();
        this.trades = [];
        this.maxTrades = 15;
        
        this.tradeTextPool = new ComponentPool(
            () => new PIXI.Text('', { fontFamily: 'Courier New', fontSize: 10, fill: 0xffffff }),
            (text) => { text.text = ''; text.visible = false; text.y = 0; text.alpha = 1; }
        );
        
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
    }
    
    renderTrades() {
        this.tradeContainer.children.forEach(text => this.tradeTextPool.release(text));
        this.tradeContainer.removeChildren();
        
        this.trades.forEach((trade, index) => {
            const color = trade.side === 'buy' ? 0x00ff00 : 0xff0000;
            const tradeText = this.tradeTextPool.acquire();
            tradeText.text = `${trade.symbol} ${trade.side.toUpperCase()} ${trade.price.toFixed(4)} ${this.formatSize(trade.size)}`;
            tradeText.style.fill = color;
            tradeText.y = index * 15;
            tradeText.alpha = Math.max(0.3, 1 - (index * 0.05));
            tradeText.visible = true;
            this.tradeContainer.addChild(tradeText);
        });
    }
    
    formatSize(size) {
        if (size >= 1000000) return `${(size / 1000000).toFixed(1)}M`;
        if (size >= 1000) return `${(size / 1000).toFixed(0)}K`;
        return size.toString();
    }
    
    reset() {
        this.visible = false;
        this.tradeContainer.children.forEach(text => this.tradeTextPool.release(text));
        this.tradeContainer.removeChildren();
    }
}

class TradingApp {
    constructor(canvas) {
        this.canvas = canvas;
        
        this.app = new PIXI.Application({
            view: canvas,
            width: canvas.width,
            height: canvas.height,
            backgroundColor: 0x0a0a0a,
            antialias: true,
            targetFrameRate: 120,
        });
        
        this.activeSymbols = new Set(['EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSD', 'ETHUSD']);
        this.activePriceDisplays = new Map();
        this.updateCount = 0;
        this.lastStatsUpdate = Date.now();
        this.connectionStatus = 'disconnected';
        this.stressTestMode = false;
        
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
        this.priceContainer = new PIXI.Container();
        this.priceContainer.x = 20; this.priceContainer.y = 20;
        this.app.stage.addChild(this.priceContainer);
        
        this.orderBook = new OrderBookComponent();
        this.orderBook.x = 800; this.orderBook.y = 20;
        this.app.stage.addChild(this.orderBook);
        
        this.tradeFeed = new TradeFeedComponent();
        this.tradeFeed.x = 20; this.tradeFeed.y = 400;
        this.app.stage.addChild(this.tradeFeed);
        
        this.statsDisplay = new PIXI.Text('', {
            fontFamily: 'Courier New', fontSize: 12, fill: 0x00ff00
        });
        this.statsDisplay.x = 20; this.statsDisplay.y = canvas.height - 60;
        this.app.stage.addChild(this.statsDisplay);
        
        this.connectionDisplay = new PIXI.Text('', {
            fontFamily: 'Courier New', fontSize: 12, fill: 0x00ffff
        });
        this.connectionDisplay.x = 20; this.connectionDisplay.y = canvas.height - 40;
        this.app.stage.addChild(this.connectionDisplay);
    }
    
    initializeSharedMemory() {
        console.log('Initializing SharedArrayBuffer + WebSocket Worker system...');
        
        if (typeof SharedArrayBuffer === 'undefined') {
            console.error('SharedArrayBuffer not supported. This app requires HTTPS and proper CORS headers.');
            this.showError('SharedArrayBuffer not supported. Please use HTTPS and proper CORS headers.');
            return;
        }
        
        try {
            this.sharedBuffer = new SharedArrayBuffer(MEMORY_LAYOUT.BUFFER_SIZE);
            
            this.priceArray = new Float32Array(this.sharedBuffer, MEMORY_LAYOUT.PRICE_OFFSET, MEMORY_LAYOUT.SYMBOL_COUNT);
            this.timestampArray = new Float64Array(this.sharedBuffer, MEMORY_LAYOUT.TIMESTAMP_OFFSET, MEMORY_LAYOUT.SYMBOL_COUNT);
            this.changeArray = new Float32Array(this.sharedBuffer, MEMORY_LAYOUT.CHANGE_OFFSET, MEMORY_LAYOUT.SYMBOL_COUNT);
            this.volumeArray = new Float32Array(this.sharedBuffer, MEMORY_LAYOUT.VOLUME_OFFSET, MEMORY_LAYOUT.SYMBOL_COUNT);
            this.bidArray = new Float32Array(this.sharedBuffer, MEMORY_LAYOUT.BID_OFFSET, MEMORY_LAYOUT.SYMBOL_COUNT);
            this.askArray = new Float32Array(this.sharedBuffer, MEMORY_LAYOUT.ASK_OFFSET, MEMORY_LAYOUT.SYMBOL_COUNT);
            this.flagsArray = new Uint8Array(this.sharedBuffer, MEMORY_LAYOUT.FLAGS_OFFSET, MEMORY_LAYOUT.SYMBOL_COUNT);
            
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
            
            this.dataWorker.postMessage({
                type: 'init',
                data: {
                    sharedBuffer: this.sharedBuffer,
                    serverUrl: 'ws://localhost:8080'
                }
            });
            
            this.startMemoryPolling();
            
            console.log('SharedArrayBuffer + WebSocket Worker system initialized');
            
        } catch (error) {
            console.error('Failed to initialize SharedArrayBuffer system:', error);
            this.showError('Failed to initialize SharedArrayBuffer system');
        }
    }
    
    startMemoryPolling() {
        const pollMemory = () => {
            let updatesThisFrame = 0;
            
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
                        if (symbol && price > 0 && this.activeSymbols.has(symbol)) {
                            this.updatePriceFromMemory(symbol, price, change, volume, bid, ask);
                            this.lastTimestamps[i] = timestamp;
                            updatesThisFrame++;
                        }
                    }
                    
                    Atomics.store(this.flagsArray, i, 0);
                }
            }
            
            this.updateCount += updatesThisFrame;
            this.renderBatch.processBatch(updatesThisFrame);
        };
        
        this.app.ticker.add(pollMemory);
        
        console.log('Memory polling synced to PixiJS render loop');
    }

    updatePriceFromMemory(symbol, price, change, volume, bid, ask) {
        let priceDisplay = this.activePriceDisplays.get(symbol);
        
        if (!priceDisplay) {
            priceDisplay = this.priceDisplayPool.acquire();
            priceDisplay.setup(symbol, price);
            
            this.activePriceDisplays.set(symbol, priceDisplay);
            this.priceContainer.addChild(priceDisplay);
            this.repositionDisplays();
        } else {
            priceDisplay.updatePrice(price, change);
        }
        
        if (this.activePriceDisplays.size === 1) {
            this.updateOrderBookFromMemory(symbol, bid, ask, volume);
        }
        
        if (Math.random() < 0.05) {
            this.simulateTradeFromMemory(symbol, price, volume);
        }
    }
    
    repositionDisplays() {
        let index = 0;
        this.activePriceDisplays.forEach((display) => {
            const col = index % 5;
            const row = Math.floor(index / 5);
            display.x = col * 140;
            display.y = row * 80;
            index++;
        });
    }
    
    cleanupRemovedSymbols() {
        Array.from(this.activePriceDisplays.keys()).forEach(symbol => {
            if (!this.activeSymbols.has(symbol)) {
                const display = this.activePriceDisplays.get(symbol);
                this.priceContainer.removeChild(display);
                this.priceDisplayPool.release(display);
                this.activePriceDisplays.delete(symbol);
            }
        });
        this.repositionDisplays();
    }
    
    updateOrderBookFromMemory(symbol, bid, ask, volume) {
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
            
            document.getElementById('updates-per-sec').textContent = updatesPerSec;
            document.getElementById('active-symbols').textContent = this.activePriceDisplays.size;
            
            const poolStats = this.priceDisplayPool.getStats();
            document.getElementById('pool-available').textContent = poolStats.available;
            
            const batchStats = this.renderBatch.getStats();
            this.statsDisplay.text = `WebSocket + SharedArrayBuffer | FPS: ${Math.round(this.app.ticker.FPS)} | Updates/sec: ${updatesPerSec} | Pool: ${poolStats.inUse}/${poolStats.available + poolStats.inUse}`;
            
            this.updateCount = 0;
            this.lastStatsUpdate = now;
        }, 1000);
    }
    
    reconnectWebSocket() {
        if (this.dataWorker) {
            console.log('Reconnecting WebSocket...');
            this.dataWorker.postMessage({ type: 'reconnect' });
        }
    }
    
    addMoreSymbols() {
        const allSymbols = Array.from(SYMBOL_MAP.keys());
        const currentSymbols = Array.from(this.activeSymbols);
        
        if (currentSymbols.length < allSymbols.length) {
            const availableSymbols = allSymbols.filter(s => !this.activeSymbols.has(s));
            const symbolsToAdd = availableSymbols.slice(0, 2);
            
            symbolsToAdd.forEach(symbol => this.activeSymbols.add(symbol));
            console.log(`Added symbols: ${symbolsToAdd.join(', ')}. Total: ${this.activeSymbols.size}`);
        }
    }
    
    removeSymbols() {
        if (this.activeSymbols.size > 2) {
            const symbolsArray = Array.from(this.activeSymbols);
            const symbolsToRemove = symbolsArray.slice(-2);
            
            symbolsToRemove.forEach(symbol => this.activeSymbols.delete(symbol));
            this.cleanupRemovedSymbols();
            
            console.log(`Removed symbols: ${symbolsToRemove.join(', ')}. Total: ${this.activeSymbols.size}`);
        }
    }
    
    stressTest() {
        this.stressTestMode = !this.stressTestMode;
        
        if (this.stressTestMode) {
            this.activeSymbols = new Set(Array.from(SYMBOL_MAP.keys()).slice(0, 15));
            console.log('Stress test mode ON - 15 symbols');
        } else {
            this.activeSymbols = new Set(['EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSD', 'ETHUSD']);
            this.cleanupRemovedSymbols();
            console.log('Stress test mode OFF');
        }
    }
}