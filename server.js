// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocket } = require('ws');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: '*' } });

// Connect to upstream market-data feed
const upstream = new WebSocket(
    `${process.env.STREAM_URL}?token=${process.env.STREAM_KEY}`
);
upstream.on('open', () => console.log('Connected upstream'));
upstream.on('message', msg => {
    const tick = JSON.parse(msg);
    io.emit('priceUpdate', tick);
});
upstream.on('error', console.error);

// Health-check endpoint
app.get('/', (_req, res) => res.send('Server is running, entering pentration stage'));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () =>
    console.log(`Listening on http://localhost:${PORT}`)
);
