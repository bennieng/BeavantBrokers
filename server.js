require('dotenv').config();
const path = require('path');
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { WebSocket } = require('ws');
const socketIO = require('socket.io');

// ─── App & Server Setup ───────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: '*' } });

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());

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
    passwordHash: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

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

app.get('/me', authenticateToken, (req, res) => {
    res.json({ message: 'You are logged in', user: req.user });
});

// Serve ALL of /public (login.html, dashboard.html, CSS, JS, etc.)
app.use(express.static(path.join(__dirname, 'public')));

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

// ─── Database connect & server start ────────────────────────────────────
mongoose.connect(process.env.MONGO_URI).then(() => {
    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));
});
