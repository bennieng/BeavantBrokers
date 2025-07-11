require('dotenv').config();

const path = require('path');
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { WebSocket } = require('ws');
const socketIO = require('socket.io');
const yahooFinance = require('yahoo-finance2').default;
const axios = require('axios');
// const fetch = require('node-fetch');




// app and server setup
const app = express();
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: '*' } });

// middleware
app.use(express.json());

// Serve ALL of /public (login.html, dashboard.html, CSS, JS, etc.)
app.use(express.static(path.join(__dirname, 'public')));


// mongodb setup
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('MongoDB error', err));

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    holdings: [
        {
            ticker: { type: String, required: true },
            quantity: { type: Number, required: true },
            price: { type: Number, required: true }
        }
    ]
});

const User = mongoose.model('User', userSchema);
// added for polygon api
const fetch = require('node-fetch');

// auth helper
function authenticateToken(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth) return res.sendStatus(401);
    const token = auth.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
        if (err) return res.sendStatus(403);
        req.user = payload;
        next();
    });
}

// auth routes
app.post('/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).send('Email + password required');
    try {
        const hash = await bcrypt.hash(password, 10);
        const user = await User.create({ email, passwordHash: hash });
        res.status(201).json({ id: user._id, email: user.email });
    } catch (err) {
        console.error(err);
        res.status(400).send('Registration failed');
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).send('Invalid credentials');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).send('Invalid credentials');

    const token = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '2h' }
    );
    res.json({ token });
});

app.post('/api/saveHoldings', authenticateToken, async (req, res) => {
    const email = req.user.email;
    const holdings = req.body;

    await User.updateOne(
        { email },
        { $set: { holdings } },
        { upsert: true }
    );
    res.sendStatus(200);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/me', authenticateToken, (req, res) => {
    res.json({ message: 'You are logged in', user: req.user });
});

app.get('/api/loadHoldings', authenticateToken, async (req, res) => {
    const user = await User.findOne({ email: req.user.email });
    res.json(user?.holdings || []);
});

// return current market price for single stock
app.get('/api/quote', authenticateToken, async (req, res) => {
    const symbol = (req.query.symbol || '').trim().toUpperCase();
    if (!symbol) {
        return res.status(400).json({ error: 'Missing symbol parameter' });
    }

    try {
        const quote = await yahooFinance.quote(symbol);
        if (!quote || typeof quote.regularMarketPrice !== 'number') {
            return res.status(404).json({ error: `No price for ${symbol}` });
        }
        return res.json({
            symbol: quote.symbol,
            price: quote.regularMarketPrice
        });
    } catch (err) {
        console.error(`[API /api/quote] Error fetching ${symbol}:`, err.message);
        return res.status(500).json({ error: `Failed to pull price for ${symbol}` });
    }
});

// polygon api calling
app.get('/api/history', authenticateToken, async (req, res) => {
    try {
        const { symbol, range } = req.query;
        const now = Date.now();
        let from;
        switch (range) {
            case '1d': from = now - 24 * 3600 * 1000; break;
            case '1w': from = now - 7 * 24 * 3600 * 1000; break;
            case '1m': from = now - 30 * 24 * 3600 * 1000; break;
            case '1y': from = now - 365 * 24 * 3600 * 1000; break;
            default: return res.status(400).send('Invalid range');
        }

        let timespan, multiplier;
        if (range === '1d' || range === '1w') {
            timespan = 'minute';
            multiplier = 1;
        } else if (range === '1m') {
            timespan = 'minute';
            multiplier = 5;
        } else {
            timespan = 'hour';
            multiplier = 1;
        }

        const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(symbol)}` +
            `/range/${multiplier}/${timespan}/${from}/${now}` +
            `?adjusted=true&sort=asc&limit=50000&apiKey=${process.env.POLYGON_API_KEY}`;

        console.log('Calling Polygon:', url);
        console.log('Using key:', process.env.POLYGON_API_KEY ? '***present***' : '***MISSING***');

        const polyRes = await axios.get(url);
        const polyJson = polyRes.data;
        console.log('🛰️  Polygon raw response:', polyJson);

        if (!Array.isArray(polyJson.results)) {
            return res
                .status(500)
                .json({ error: polyJson.error || 'Polygon returned no results' });
        }

        const bars = polyJson.results.map(r => ({
            t: r.t,
            o: r.o,
            h: r.h,
            l: r.l,
            c: r.c,
            v: r.v
        }));
        res.json(bars);
    } catch (err) {
        console.error('History fetch error', err);
        res.status(500).send('Server error');
    }
});

// next-day ML prediction proxy
app.get('/api/predict', authenticateToken, async (req, res) => {
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ error: 'Missing symbol' });

    try {
        const svc = await fetch(`http://localhost:8000/predict?symbol=${encodeURIComponent(symbol)}`);
        if (!svc.ok) {
            const err = await svc.json().catch(() => ({}));
            return res.status(svc.status).json({ error: err.detail || 'Prediction failed' });
        }
        const data = await svc.json();
        return res.json(data);
    } catch (err) {
        console.error('Prediction service error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});


// websocket feed and socket.io auth
const upstream = new WebSocket(`${process.env.STREAM_URL}?token=${process.env.STREAM_KEY}`);
upstream.on('open', () => console.log('🔗 Connected upstream'));
upstream.on('message', msg => io.emit('priceUpdate', JSON.parse(msg)));
upstream.on('error', console.error);

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Auth token missing'));
    jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
        if (err) return next(new Error('Invalid auth token'));
        socket.user = payload;
        next();
    });
});
const activePollers = new Map();

// check if market is open
function isMarketOpen() {
    const now = new Date();
    const day = now.getUTCDay(); // Sunday = 0, Saturday = 6
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();
    const isWeekday = day >= 1 && day <= 5;
    const isOpen = (hour > 13 || (hour === 13 && minute >= 30)) && hour < 20;
    return isWeekday && isOpen;
}

setInterval(() => {
    io.emit('marketStatus', { open: isMarketOpen() });
}, 10000); // Update market status every 10s

io.on('connection', socket => {
    console.log(`Client connected [id=${socket.id}]`);

    socket.on('subscribe', symbol => {
        const upperSymbol = symbol.toUpperCase();
        if (activePollers.has(upperSymbol)) return;

        console.log(`📡 Subscribing to ${upperSymbol}`);

        const intervalId = setInterval(async () => {
            try {
                const quote = await yahooFinance.quote(upperSymbol);
                io.emit('priceUpdate', {
                    symbol: quote.symbol,
                    price: quote.regularMarketPrice,
                    timestamp: quote.regularMarketTime * 1000,
                    change: quote.regularMarketChange,
                    changePercent: quote.regularMarketChangePercent,
                });
            } catch (err) {
                console.error(`[Polling ${upperSymbol}]`, err.message);
            }
        }, 1000);

        activePollers.set(upperSymbol, intervalId);
    });

    socket.on('disconnect', () => {
        console.log(`Client disconnected [id=${socket.id}]`);
    });
});

io.on('connection', socket => {
    console.log(`👤 ${socket.user.email} connected to Socket.IO`);
});

// connect to price stream
const priceWs = new WebSocket(
    `${process.env.STREAM_URL}?token=${process.env.STREAM_KEY}`
);
priceWs.on('open', () =>
    console.log('✅ Connected to price stream:', process.env.STREAM_URL)
);
priceWs.on('message', raw => {
    let tick;
    try {
        tick = JSON.parse(raw);
    } catch (e) {
        console.error('Invalid price data:', e);
        return;
    }
    io.emit('priceUpdate', tick);
});
priceWs.on('error', err =>
    console.error('Price stream error:', err)
);

// poll single stock
function startYahooPolling(symbol, intervalMs = 5000) {
    setInterval(async () => {
        yahooFinance.suppressNotices(['yahooSurvey']);
        try {
            const quote = await yahooFinance.quote(symbol);
            // quote looks like:  { symbol: 'AAPL', regularMarketPrice: 172.25, regularMarketTime: 1691601234, … }
            io.emit('stockData', {
                symbol: quote.symbol,
                price: quote.regularMarketPrice,
                timestamp: quote.regularMarketTime * 1000, // convert to ms
                change: quote.regularMarketChange,
                changePercent: quote.regularMarketChangePercent,
                // will add more fields later
            });
        } catch (err) {
            console.error(`[YahooPolling] Error fetching ${symbol}:`, err.message);
        }
    }, intervalMs);
}

// when client connects, stat polling
io.on('connection', socket => {
    console.log(`Client connected [id=${socket.id}]`);
    const defaultSymbol = 'AAPL';
    if (!io.hasStartedPolling) {
        startYahooPolling(defaultSymbol, 5000);
        io.hasStartedPolling = true;
    }

    socket.on('subscribe', symbol => {
        console.log(`Client ${socket.id} wants to subscribe to ${symbol}`);
    });

    socket.on('disconnect', () => {
        console.log(`Client disconnected [id=${socket.id}]`);
    });
});

// start server and connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => {
        const PORT = process.env.PORT || 4000;
        server.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));
    })
    .catch(err => console.error('MongoDB error', err));
