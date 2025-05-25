// ─── 1) Grab the JWT you stored on login ──────────────────────────────
const token = localStorage.getItem('jwt');
if (!token) {
    // not logged in — send back to the login page
    window.location.href = '/';
    throw new Error('No auth token, redirecting to login');
}

// 0) Log Out handler
const logoutBtn = document.getElementById('logoutBtn');
logoutBtn.addEventListener('click', () => {
    // Clear stored token
    localStorage.removeItem('jwt');
    // Redirect back to login page
    window.location.href = '/';
});


// —————————————————————————————————————————————————————
// 2) Socket.IO connection for real-time price updates
// —————————————————————————————————————————————————————
const socket = io({ auth: { token } });

socket.on('connect', () => {
    console.log('🔗 Connected to price feed, socket id:', socket.id);
});

socket.on('priceUpdate', ({ symbol, price, timestamp }) => {
    // 1) Update the watchlist card
    const el = document.getElementById(`price-${symbol}`);
    if (el) el.textContent = `$${price.toFixed(2)}`;

    // 2) Push into your Chart.js line chart
    chart.data.datasets[0].data.push({ x: new Date(timestamp), y: price });
    chart.update();
});

// —————————————————————————————————————————————————————
// 3) Fetch protected profile info (/me) to populate user data
// —————————————————————————————————————————————————————
fetch('/me', {
    headers: { 'Authorization': 'Bearer ' + token }
})
    .then(res => {
        if (!res.ok) throw new Error('Failed to load profile');
        return res.json();
    })
    .then(({ user }) => {
        // e.g. show their email in the header
        document.getElementById('userEmail').textContent = user.email;
    })
    .catch(err => {
        console.error(err);
        // invalid token? kick them back to login
        localStorage.removeItem('jwt');
        window.location.href = '/';
    });

// ─── 2) Initialize Chart.js for live price history ────────────────
const ctx = document.getElementById('priceChart').getContext('2d');
const chart = new Chart(ctx, {
    type: 'line',
    data: { datasets: [{ label: 'Live Price', data: [] }] },
    options: {
        scales: {
            x: { type: 'time', time: { unit: 'minute' } },
            y: { beginAtZero: false }
        }
    }
});

// ─── 3) Fetch your holdings and build the watchlist + overview ───────
fetch('/holdings', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(res => res.json())
    .then(({ stocks, cash }) => {
        const container = document.getElementById('watch-cards');
        container.innerHTML = '';
        stocks.forEach(h => {
            container.insertAdjacentHTML('beforeend', `
        <div class="col">
          <div class="card">
            <h4>${h.symbol}</h4>
            <p id="price-${h.symbol}">$${h.lastPrice.toFixed(2)}</p>
            <small class="${h.change >= 0 ? 'text-success' : 'text-danger'}">
              ${h.change.toFixed(2)}%
            </small>
          </div>
        </div>
      `);
        });
        updateOverview({ stocks, cash });
    });

// ─── 4) Calculate & display Dashboard metrics ───────────────────────
function updateOverview({ stocks, cash }) {
    let total = 0, cost = 0, todayPnL = 0;
    stocks.forEach(h => {
        total += h.quantity * h.lastPrice;
        cost += h.quantity * h.avgCost;
        todayPnL += h.quantity * (h.lastPrice - h.openPrice);
    });
    document.getElementById('total-value').textContent = `$${total.toFixed(2)}`;
    document.getElementById('unrealized-pnl').textContent = `$${(total - cost).toFixed(2)}`;
    document.getElementById('todays-pnl').textContent = `$${todayPnL.toFixed(2)}`;
    document.getElementById('cash-available').textContent = `$${cash.toFixed(2)}`;
}

// ─── 5) Handle real-time ticks from your server ────────────────────
socket.on('priceUpdate', ({ symbol, price, timestamp }) => {
    // update the card
    const el = document.getElementById(`price-${symbol}`);
    if (el) el.textContent = `$${price.toFixed(2)}`;

    // push into the Chart.js line chart
    chart.data.datasets[0].data.push({ x: new Date(timestamp), y: price });
    chart.update();
});