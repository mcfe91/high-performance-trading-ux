# Ultra-High Performance WebGL Trading Platform

A real-time trading platform built for maximum performance using SharedArrayBuffer, WebWorkers, and binary protocols.

## Features

- **Binary WebSocket Protocol** - 70% smaller messages, 5-10x faster parsing than JSON
- **SharedArrayBuffer + WebWorkers** - Ultra-low latency data processing 
- **WebGL Rendering** - Hardware-accelerated UI with PixiJS
- **Object Pooling** - Zero-garbage collection for smooth 60+ FPS
- **Real-time Market Data** - Live price feeds, order books, and trade streams
- **Stress Testing** - Handle thousands of updates per second

https://github.com/user-attachments/assets/5d4840a2-e101-4a63-a6e7-56b67220b614

## Architecture

```
┌─────────────┐    Binary Protocol      ┌─────────────┐
│ Mock Server │ ◄─────WebSocket───────► │ WebWorker   │
│             │   (40 bytes vs 120+)    │             │
└─────────────┘                         └──────┬──────┘
                                               │
                                               ▼
                                        ┌───────────────────┐
                                        │ SharedArrayBuffer │
                                        │     [price]       │
                                        └──────┬────────────┘
                                            │ Zero-copy
                                            ▼
┌─────────────┐                         ┌─────────────┐
│   PixiJS    │ ◄────────────────────►  │ Main Thread │
│ WebGL UI    │      60-120 FPS         │             │
└─────────────┘                         └─────────────┘
```

- **Mock Server**: Generates realistic market data via WebSocket
- **Binary Protocol**: Custom encoding (40 bytes vs 120+ JSON)  
- **WebWorker**: Handles WebSocket and data processing off main thread
- **SharedArrayBuffer**: Pre-allocated / Zero-copy memory sharing for performance
- **PixiJS**: Hardware-accelerated rendering at 60-120 FPS and custom UI components

## Quick Start

```bash
# Install dependencies
npm install

# Start mock server + web server
npm run dev

# Or run separately:
npm run mock-server  # Market data on :8080
npm run start        # Web server on :3000
```

Open `http://localhost:3000` in a modern browser (requires HTTPS for SharedArrayBuffer in production).

## Performance

- **5,000+ messages/sec** with binary protocol vs JSON
- **>60 FPS** smooth rendering  
- **75% smaller** network messages
- **Zero latency** SharedArrayBuffer updates

## TODO
- Symbols are currently hardcoded to support memory layout. Make this dynamic somehow...
- Tradebook and Live trade data is currently just simulated in the client. Serialize and also dynamically write to shared memory. Hard!

