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



// ─── App & Server Setup ───────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: '*' } });

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());

// Serve ALL of /public (login.html, dashboard.html, CSS, JS, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// 2) Protect dashboard.html (i think this prevents us from loading dashboard.html without logging in but i dont think it works?)

// ─── MongoDB Connection & User Model ──────────────────────────────────────────
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

// ─── Auth Helpers ─────────────────────────────────────────────────────────────
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

// ─── Auth Routes ──────────────────────────────────────────────────────────────
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
    const holdings = req.body; // expect an array: [ { ticker, quantity, price }, … ]

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

// New: Return current market price for a single ticker
app.get('/api/quote', authenticateToken, async (req, res) => {
    const symbol = (req.query.symbol || '').trim().toUpperCase();
    if (!symbol) {
        return res.status(400).json({ error: 'Missing symbol parameter' });
    }

    try {
        // yahooFinance.quote(...) returns an object; we only need regularMarketPrice
        const quote = await yahooFinance.quote(symbol);
        // If for some reason Yahoo has no data for that symbol, send 404
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

        // Polygon aggregates: 1-minute bars for intra-day, daily for longer
        let timespan, multiplier;
        if (range === '1d' || range === '1w') {
            timespan = 'minute';  // 1 min bars → ~390 bars/day × 5 days = ~1 950 points
            multiplier = 1;
        } else if (range === '1m') {
            timespan = 'minute';  // 5 min bars → ~78 bars/day × 21 days = ~1 638 points
            multiplier = 5;
        } else {  // '1y'
            timespan = 'hour';    // 1 hour bars → ~6.5 bars/day × 252 days = ~1 638 points
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

        // On free/dev tier you’ll often get status='DELAYED' for recent bars;
        // treat that exactly like 'OK' as long as we have `results`.
        if (!Array.isArray(polyJson.results)) {
            // only bail if there truly are no results or a real error
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

// ─── WebSocket Feed & Socket.IO Auth ──────────────────────────────────────────
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

// Market open check (U.S. market: 9:30am–4pm ET, which is 13:30–20:00 UTC)
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
        // Optional: you can stop polling if no users are connected to a symbol
    });
});

io.on('connection', socket => {
    console.log(`👤 ${socket.user.email} connected to Socket.IO`);
    // … your real-time handlers …
});

// ─── Connect to external price stream and broadcast updates ─────────────
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
    // Broadcast to ALL connected browsers
    io.emit('priceUpdate', tick);
});
priceWs.on('error', err =>
    console.error('Price stream error:', err)
);

// ─── Function to poll a single symbol and broadcast it ───────────────────────
function startYahooPolling(symbol, intervalMs = 5000) {
    // Every intervalMs milliseconds, fetch the quote and emit it
    setInterval(async () => {
        yahooFinance.suppressNotices(['yahooSurvey']);
        try {
            // Request the “quoteSummary” or “quote” endpoint; here we use simple quote
            const quote = await yahooFinance.quote(symbol);
            // quote will look like:
            // { symbol: 'AAPL', regularMarketPrice: 172.25, regularMarketTime: 1691601234, … }
            io.emit('stockData', {
                symbol: quote.symbol,
                price: quote.regularMarketPrice,
                timestamp: quote.regularMarketTime * 1000, // convert to ms
                change: quote.regularMarketChange,
                changePercent: quote.regularMarketChangePercent,
                // you can add more fields as desired (e.g. bid, ask, dayHigh/dayLow, etc.)
            });
        } catch (err) {
            console.error(`[YahooPolling] Error fetching ${symbol}:`, err.message);
        }
    }, intervalMs);
}

// ─── Whenever a client connects, start polling (or you can start once) ───────
io.on('connection', socket => {
    console.log(`Client connected [id=${socket.id}]`);

    // Option A: Start polling for one or more fixed symbols (e.g., 'AAPL', 'GOOG').
    //           If you have multiple clients and multiple symbols, you might want a shared poller.
    //           Here’s a quick example for a single‐symbol poll:
    const defaultSymbol = 'AAPL';
    if (!io.hasStartedPolling) {
        startYahooPolling(defaultSymbol, 5000);
        io.hasStartedPolling = true;
    }

    // Option B: Listen for the client to request a symbol (e.g. via socket.emit("subscribe", "TSLA")).
    socket.on('subscribe', symbol => {
        // If you want per‐symbol pollers, you'd store a map { symbol → intervalId },
        // and only poll that symbol if not already polling. For brevity, we’ll assume
        // just one poller for a single hard-coded symbol in this demo.
        console.log(`Client ${socket.id} wants to subscribe to ${symbol}`);
        // … you could call startYahooPolling(symbol) here if not already started …
    });

    socket.on('disconnect', () => {
        console.log(`Client disconnected [id=${socket.id}]`);
        // You could clearInterval(...) if you keep track of intervals per‐symbol and no one is listening.
    });
});

// ─── Start server & DB connect (your existing code) ─────────────────────────
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => {
        const PORT = process.env.PORT || 4000;
        server.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));
    })
    .catch(err => console.error('MongoDB error', err));
