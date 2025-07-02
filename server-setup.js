// server.js
const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Set headers required for SharedArrayBuffer
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all handler to serve index.html for other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`SharedArrayBuffer headers enabled`);
    console.log(`Open your browser to http://localhost:${PORT} to see the demo`);
});
