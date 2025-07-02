const WebSocket = require('ws');

class MarketDataServer {
    constructor(port = 8080) {
        this.port = port;
        this.wss = null;
        this.clients = new Set();
        this.symbols = [
            { symbol: 'EURUSD', price: 1.0850, volatility: 0.0001, trend: 0 },
            { symbol: 'GBPUSD', price: 1.2720, volatility: 0.0002, trend: 0 },
            { symbol: 'USDJPY', price: 149.50, volatility: 0.02, trend: 0 },
            { symbol: 'BTCUSD', price: 43500, volatility: 50, trend: 0 },
            { symbol: 'ETHUSD', price: 2650, volatility: 20, trend: 0 },
            { symbol: 'AAPL', price: 185.50, volatility: 0.5, trend: 0 },
            { symbol: 'TSLA', price: 240.80, volatility: 2.0, trend: 0 },
            { symbol: 'MSFT', price: 378.90, volatility: 1.0, trend: 0 },
            { symbol: 'EURGBP', price: 0.8520, volatility: 0.0001, trend: 0 },
            { symbol: 'EURJPY', price: 161.20, volatility: 0.02, trend: 0 },
            { symbol: 'GBPJPY', price: 190.80, volatility: 0.03, trend: 0 },
            { symbol: 'USDCAD', price: 1.3620, volatility: 0.0002, trend: 0 },
            { symbol: 'NZDUSD', price: 0.6180, volatility: 0.0003, trend: 0 },
            { symbol: 'EURCHF', price: 0.9420, volatility: 0.0001, trend: 0 },
            { symbol: 'GBPAUD', price: 1.9120, volatility: 0.0004, trend: 0 },
            { symbol: 'AUDUSD', price: 0.6650, volatility: 0.0002, trend: 0 },
            { symbol: 'USDCHF', price: 0.8680, volatility: 0.0002, trend: 0 },
            { symbol: 'XAUUSD', price: 2045.50, volatility: 5.0, trend: 0 },
            { symbol: 'XAGUSD', price: 24.80, volatility: 0.2, trend: 0 },
            { symbol: 'UKOIL', price: 82.40, volatility: 1.0, trend: 0 }
        ];
        
        this.orderBooks = new Map();
        this.isRunning = false;
        this.updateCount = 0;
        
        this.initializeOrderBooks();
    }
    
    start() {
        this.wss = new WebSocket.Server({ port: this.port });
        
        this.wss.on('connection', (ws) => {
            console.log(`📡 Client connected. Total clients: ${this.clients.size + 1}`);
            this.clients.add(ws);
            
            // Send initial data to new client
            this.sendInitialData(ws);
            
            // Start data generation if first client
            if (this.clients.size === 1) {
                this.startDataGeneration();
            }
            
            ws.on('close', () => {
                this.clients.delete(ws);
                console.log(`📡 Client disconnected. Total clients: ${this.clients.size}`);
                
                // Stop data generation if no clients
                if (this.clients.size === 0) {
                    this.stopDataGeneration();
                }
            });
            
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.clients.delete(ws);
            });
        });
        
        console.log(`🚀 Market data server started on ws://localhost:${this.port}`);
        console.log(`📊 Broadcasting ${this.symbols.length} symbols`);
    }
    
    initializeOrderBooks() {
        this.symbols.forEach(({symbol, price}) => {
            const orderBook = {
                symbol,
                bids: [],
                asks: [],
                timestamp: Date.now()
            };
            
            // Generate realistic order book depth
            for (let i = 0; i < 10; i++) {
                const spread = symbol.includes('JPY') ? 0.01 : 0.0001;
                orderBook.bids.push({
                    price: price - (i + 1) * spread,
                    size: Math.floor(Math.random() * 1000000) + 100000
                });
                orderBook.asks.push({
                    price: price + (i + 1) * spread,
                    size: Math.floor(Math.random() * 1000000) + 100000
                });
            }
            
            this.orderBooks.set(symbol, orderBook);
        });
    }
    
    sendInitialData(ws) {
        // Send current prices for all symbols
        this.symbols.forEach(({symbol, price}) => {
            this.sendToClient(ws, {
                type: 'price_update',
                symbol,
                price: parseFloat(price.toFixed(symbol.includes('JPY') ? 2 : 4)),
                change: 0,
                volume: Math.floor(Math.random() * 1000000) + 100000,
                bid: price - 0.0001,
                ask: price + 0.0001,
                timestamp: Date.now()
            });
        });
        
        // Send initial order books
        this.orderBooks.forEach(orderBook => {
            this.sendToClient(ws, {
                type: 'order_book',
                ...orderBook
            });
        });
    }
    
    sendToClient(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }
    
    broadcast(message) {
        const messageStr = JSON.stringify(message);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(messageStr);
            }
        });
    }
    
    startDataGeneration() {
        this.isRunning = true;
        console.log('Starting ultra-high frequency data generation');
        
        // Multiple intervals for realistic burst patterns
        const intervals = [1, 2, 3, 5, 8, 13, 21];
        
        intervals.forEach(interval => {
            const timer = setInterval(() => {
                if (!this.isRunning) {
                    clearInterval(timer);
                    return;
                }
                
                // Generate multiple updates per interval
                const updateCount = Math.floor(Math.random() * 3) + 1;
                for (let i = 0; i < updateCount; i++) {
                    this.generatePriceUpdate();
                }
            }, interval);
        });
                
        // Order book updates
        setInterval(() => {
            if (this.isRunning) this.generateOrderBookUpdate();
        }, 100);
        
        // Trade generation
        setInterval(() => {
            if (this.isRunning) this.generateTrade();
        }, 150);
        
        // Stats reporting
        setInterval(() => {
            if (this.isRunning) {
                console.log(`📈 Generated ${this.updateCount} updates in last second`);
                this.updateCount = 0;
            }
        }, 1000);
    }
    
    generatePriceUpdate() {
        const symbolData = this.symbols[Math.floor(Math.random() * this.symbols.length)];
        
        // Generate realistic price movement
        const randomWalk = (Math.random() - 0.5) * symbolData.volatility * 2;
        const trendComponent = symbolData.trend * Math.sin(Date.now() / 10000);
        const newPrice = Math.max(0.01, symbolData.price + randomWalk + trendComponent);
        const change = newPrice - symbolData.price;
        
        symbolData.price = newPrice;
        
        // Generate volume and bid/ask
        const volume = Math.floor(Math.random() * 1000000) + 50000;
        const spread = symbolData.symbol.includes('JPY') ? 0.01 : 0.0001;
        const bid = newPrice - spread / 2;
        const ask = newPrice + spread / 2;
        
        this.broadcast({
            type: 'price_update',
            symbol: symbolData.symbol,
            price: parseFloat(newPrice.toFixed(symbolData.symbol.includes('JPY') ? 2 : 4)),
            change: parseFloat(change.toFixed(6)),
            volume,
            bid: parseFloat(bid.toFixed(symbolData.symbol.includes('JPY') ? 2 : 4)),
            ask: parseFloat(ask.toFixed(symbolData.symbol.includes('JPY') ? 2 : 4)),
            timestamp: Date.now()
        });
        
        this.updateCount++;
        
        // Occasionally update trend
        if (Math.random() < 0.001) {
            symbolData.trend = (Math.random() - 0.5) * 0.001;
        }
    }
    
    generateOrderBookUpdate() {
        const symbolData = this.symbols[Math.floor(Math.random() * this.symbols.length)];
        const orderBook = this.orderBooks.get(symbolData.symbol);
        
        if (!orderBook) return;
        
        // Update random levels
        const isBid = Math.random() > 0.5;
        const levels = isBid ? orderBook.bids : orderBook.asks;
        
        if (levels.length > 0) {
            const levelIndex = Math.floor(Math.random() * levels.length);
            levels[levelIndex].size = Math.floor(Math.random() * 1000000) + 50000;
            orderBook.timestamp = Date.now();
            
            this.broadcast({
                type: 'order_book',
                ...orderBook
            });
        }
    }
    
    generateTrade() {
        const symbolData = this.symbols[Math.floor(Math.random() * this.symbols.length)];
        const side = Math.random() > 0.5 ? 'buy' : 'sell';
        const size = Math.floor(Math.random() * 100000) + 10000;
        
        this.broadcast({
            type: 'trade',
            symbol: symbolData.symbol,
            price: symbolData.price,
            size: size,
            side: side,
            timestamp: Date.now(),
            id: Math.random().toString(36).substr(2, 9)
        });
    }
    
    stopDataGeneration() {
        this.isRunning = false;
        console.log('⏹️ Stopped data generation');
    }
    
    stop() {
        this.stopDataGeneration();
        if (this.wss) {
            this.wss.close();
            console.log('🛑 Market data server stopped');
        }
    }
}

// Start server if run directly
if (require.main === module) {
    const server = new MarketDataServer(8080);
    server.start();
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down market data server...');
        server.stop();
        process.exit(0);
    });
}

module.exports = MarketDataServer;