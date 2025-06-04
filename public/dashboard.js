// ─── NAVIGATION HELPERS ──────────────────────────────────────────────────

// 1) Hide all <section> tags under <main>, then show only the one matching window.location.hash.
//    Also update the .btn-group so that the active button is btn-primary and others are btn-secondary.
function showSection() {
    let current = window.location.hash.substring(1); // e.g. "#watchlist" → "watchlist"
    if (!current) {
        current = 'dashboard';
        history.replaceState(null, '', '#dashboard');
    }

    // Hide every section; show the one with id === current
    document.querySelectorAll('main section').forEach(sec => {
        sec.style.display = sec.id === current ? 'block' : 'none';
    });

    // In .btn-group, highlight #btn-<current> as .btn-primary; others (except logout) as .btn-secondary
    document.querySelectorAll('.btn-group button').forEach(btn => {
        const btnId = btn.id; // e.g. "btn-dashboard"
        if (btnId === 'btn-' + current) {
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-primary');
        } else if (btnId !== 'btn-logout') {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-secondary');
        }
    });

    // (Optional) Keep top navbar links highlighted in sync
    document.querySelectorAll('.navbar-nav .nav-link').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === '#' + current);
    });
}

// 2) Called by <button onclick="navigate('dashboard')"> etc.
//    Sets window.location.hash and immediately shows the correct section.
function navigate(sectionId) {
    window.location.hash = sectionId;
    showSection();
}

// 3) Called by <button onclick="logoutAndRedirect()"> (the red “Log Out” button)
function logoutAndRedirect() {
    localStorage.removeItem('jwt');
    window.location.href = 'index.html'; // or "/" if that’s your login route
}

// ─────────────────────────────────────────────────────────────────────────────


// ─── dashboard.js (Version: “immediately fetch current price, then calc”) ───

const token = localStorage.getItem('jwt');
if (!token) {
    window.location.href = '/';
    throw new Error('No auth token, redirecting to login');
}

// ─── NEW GLOBALS (Step 1) ───────────────────────────────────────────────

// “currentHoldings” will hold the array of { ticker, quantity, price } once we load them.
// We’ll use it later to recalc the Dashboard cards on every new tick.
window.currentHoldings = [];

// “livePrices” will be a map from ticker → latest real‐time price.
const livePrices = {};

// ------------------- 1) Logout Button (unchanged) -------------------
const logoutBtn = document.getElementById('logoutBtn');
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('jwt');
    window.location.href = '/';
});

// ------------------- 2) Chart.js Setup (unchanged) -------------------
const ctx = document.getElementById('priceChart').getContext('2d');
window.chart = new Chart(ctx, {
    type: 'line',
    data: {
        datasets: [
            {
                label: 'Live Price',
                data: [],
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.2,
            },
        ],
    },
    options: {
        scales: {
            x: {
                type: 'time',
                time: {
                    unit: 'minute',
                    displayFormats: { minute: 'HH:mm' },
                },
                title: { display: true, text: 'Time (HH:mm)' },
            },
            y: {
                beginAtZero: false,
                title: { display: true, text: 'Price (USD)' },
            },
        },
        plugins: {
            legend: { display: true }
        },
        animation: { duration: 0 }
    }
});


// ------------------- 3) Socket.IO & livePrices map -------------------
const socket = io({ auth: { token } });

// Whenever a real-time update arrives, stash it in livePrices & update any visible cards
socket.on('connect', () => {
    console.log('🔗 Connected to price feed, socket id:', socket.id);
});

/**
 * Recompute the four Dashboard cards:
 *  - Total Value
 *  - Today's P/L
 *  - Unrealized G/L
 *  - Cash Available
 *
 * It uses:
 *    window.currentHoldings  → array of { ticker, quantity, price: costBasis }
 *    livePrices[...]         → the latest real‐time price for each symbol
 *
 * If livePrices[ticker] is undefined, we simply assume its “current” equals cost basis,
 * so P/L = 0 and Value = costBasis * quantity.
 */
function updateDashboardMetrics() {
    let totalValue = 0;
    let totalCost = 0;
    let totalPnL = 0;
    let totalUnrealPL = 0;

    window.currentHoldings.forEach(({ ticker, quantity, price: costBasis }) => {
        const currPrice = livePrices[ticker];
        // If we haven’t yet received a live price, treat currentPrice = costBasis → no P/L
        const currentVal = (typeof currPrice === 'number')
            ? (quantity * currPrice)
            : (quantity * costBasis);

        const costVal = quantity * costBasis;
        const pnl = currentVal - costVal;

        totalValue += currentVal;
        totalCost += costVal;
        totalPnL += pnl;
        totalUnrealPL += pnl;  // here we treat “Unrealized G/L” = same as total P/L from cost basis

        // Optionally, if you want a separate “Today’s P/L” vs. “Unrealized”, adapt here.
    });

    // Cash Available: if you store cash in your API, you could fetch it; for now we default to 0
    const cashAvailable = 0.00;

    // Update the DOM:
    document.getElementById('total-value').textContent = `$${totalValue.toFixed(2)}`;

    // “Today’s P/L”: display sign + color
    const todaysPnLEl = document.getElementById('todays-pnl');
    const tnSign = totalPnL >= 0 ? '+' : '-';
    todaysPnLEl.textContent = `${tnSign}$${Math.abs(totalPnL).toFixed(2)}`;
    todaysPnLEl.className = totalPnL >= 0
        ? 'fs-3 text-success fw-bold'
        : 'fs-3 text-danger fw-bold';

    // “Unrealized G/L”: same logic; if you want a diffearent formula, adjust here
    const unrealPnLEl = document.getElementById('unrealized-pnl');
    const unSign = totalUnrealPL >= 0 ? '+' : '-';
    unrealPnLEl.textContent = `${unSign}$${Math.abs(totalUnrealPL).toFixed(2)}`;
    unrealPnLEl.className = totalUnrealPL >= 0
        ? 'fs-3 text-success fw-bold'
        : 'fs-3 text-danger fw-bold';

    // “Cash Available” card
    document.getElementById('cash-available').textContent = `$${cashAvailable.toFixed(2)}`;
}

socket.on('priceUpdate', ({ symbol, price, timestamp, change, changePercent }) => {
    livePrices[symbol] = price;

    // 1) Update watchlist card‐text (as before)
    const priceEl = document.getElementById(`price-${symbol}`);
    if (priceEl) priceEl.textContent = `$${price.toFixed(2)}`;

    const changeEl = document.getElementById(`change-${symbol}`);
    if (changeEl) {
        const sign = changePercent >= 0 ? '+' : '';
        changeEl.textContent = `${sign}${changePercent.toFixed(2)}%`;
        changeEl.className = changePercent >= 0 ? 'text-success' : 'text-danger';
    }

    // 2) Update the chart if this is the “latestTracked” symbol
    if (window.latestTracked === symbol && window.chart) {
        window.chart.data.datasets[0].data.push({
            x: new Date(timestamp),
            y: price
        });
        if (window.chart.data.datasets[0].data.length > 60) {
            window.chart.data.datasets[0].data.shift();
        }
        window.chart.update('none');
    }

    // ←── HERE: Recompute the Dashboard cards
    updateDashboardMetrics();
});



// ------------------- 4) Watchlist “Track” Button (unchanged) -------------------
const trackBtn = document.getElementById('trackBtn');
trackBtn.addEventListener('click', () => {
    const symbolInput = document.getElementById('stockSymbol');
    const symbol = symbolInput.value.trim().toUpperCase();
    if (!symbol) return;

    const watchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
    if (!watchlist.includes(symbol)) {
        watchlist.push(symbol);
        localStorage.setItem('watchlist', JSON.stringify(watchlist));
    }

    socket.emit('subscribe', symbol);
    window.latestTracked = symbol;

    const container = document.getElementById('watch-cards');
    if (document.getElementById(`card-${symbol}`)) return;

    container.insertAdjacentHTML(
        'beforeend',
        `
    <div class="col" id="card-${symbol}">
      <div class="card shadow-sm h-100">
        <div class="card-header bg-transparent d-flex justify-content-between align-items-center">
          <h6 class="mb-0">${symbol}</h6>
          <button class="btn btn-sm btn-outline-danger" onclick="removeCard('${symbol}')">&times;</button>
        </div>
        <div class="card-body text-center">
          <p class="fs-3" id="price-${symbol}">$0.00</p>
          <p id="change-${symbol}" class="text-muted">Waiting...</p>
        </div>
      </div>
    </div>`
    );
});

window.removeCard = function (symbol) {
    const el = document.getElementById(`card-${symbol}`);
    if (el) el.remove();

    const watchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
    const updated = watchlist.filter(s => s !== symbol);
    localStorage.setItem('watchlist', JSON.stringify(updated));
};

window.addEventListener('DOMContentLoaded', () => {
    // Rehydrate saved watchlist cards
    const saved = JSON.parse(localStorage.getItem('watchlist') || '[]');
    saved.forEach(sym => {
        document.getElementById('stockSymbol').value = sym;
        document.getElementById('trackBtn').click();
    });

    // Profile: “Add Holding” & “Remove Row” logic
    document.getElementById('add-row').addEventListener('click', () => {
        const body = document.getElementById('holdings-body');
        const templateRow = body.querySelector('tr');
        let newRow;

        if (templateRow) {
            newRow = templateRow.cloneNode(true);
            newRow.querySelectorAll('input').forEach(input => {
                input.value = input.name === 'ticker' ? '' : 0;
            });
        } else {
            newRow = document.createElement('tr');
            newRow.innerHTML = `
      <td><input type="text" class="form-control" name="ticker" required></td>
      <td><input type="number" class="form-control" name="quantity" value="0" min="0" required></td>
      <td><input type="number" class="form-control" name="price" value="0" min="0" step="0.01" required></td>
      <td><button type="button" class="btn btn-danger btn-sm remove-row"><i class="fas fa-trash"></i></button></td>
      `;
        }
        body.appendChild(newRow);
    });

    document.getElementById('holdings-body').addEventListener('click', e => {
        if (e.target.closest('.remove-row')) {
            e.target.closest('tr').remove();
        }
    });
});


fetch('/api/loadHoldings', {
    headers: { Authorization: `Bearer ${token}` }
})
    .then(res => res.json())
    .then(data => {
        const body = document.getElementById('holdings-body');
        body.innerHTML = ''; // clear initial row

        // 1) Re‐insert each saved row AND store it in window.currentHoldings
        window.currentHoldings = []; // reset
        data.forEach(({ ticker, quantity, price }) => {
            // a) build the <tr> in the “Profile” form
            const row = document.createElement('tr');
            row.innerHTML = `
        <td><input type="text" class="form-control" name="ticker" value="${ticker}" required></td>
        <td><input type="number" class="form-control" name="quantity" value="${quantity}" min="0" required></td>
        <td><input type="number" class="form-control" name="price" value="${price}" min="0" step="0.01" required></td>
        <td><button type="button" class="btn btn-danger btn-sm remove-row"><i class="fas fa-trash"></i></button></td>
      `;
            body.appendChild(row);

            // b) store into currentHoldings array:
            window.currentHoldings.push({
                ticker: ticker.toUpperCase(),
                quantity: quantity,
                price: price
            });
        });


        // 2) Fetch “current price” for each ticker in parallel, so we can update livePrices[...]
        const quotePromises = window.currentHoldings.map(h => {
            return fetch(`/api/quote?symbol=${encodeURIComponent(h.ticker)}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
                .then(r => {
                    if (!r.ok) throw new Error(`${h.ticker} not found`);
                    return r.json();
                })
                .then(({ symbol, price }) => {
                    livePrices[symbol] = price;
                })
                .catch(err => {
                    console.warn(`[Quote Fetch] Could not fetch ${h.ticker}:`, err.message);
                    // If we can’t fetch a price, simply skip and treat livePrices[ticker] as undefined.
                });
        });

        // 3) Only after ALL quote calls finish do we calculate the Profile P/L table AND the Dashboard cards:
        Promise.all(quotePromises).then(() => {
            calculateAndDisplayHoldings(); // your existing P/L‐under‐“Profile” logic
            updateDashboardMetrics();      // our new helper to refresh Dashboard cards
        });
    })
    .catch(err => {
        console.error('Error loading holdings:', err);
    });



// ------------------- 6) calculateAndDisplayHoldings helper (unchanged) -------------------
function calculateAndDisplayHoldings() {
    let total = 0;
    let html = '<table class="table"><thead><tr><th>Ticker</th><th>Value</th><th>P/L</th></tr></thead><tbody>';

    const holdingsToSave = [];
    document.querySelectorAll('#holdings-body tr').forEach(r => {
        const t = r.querySelector('input[name="ticker"]').value.trim().toUpperCase();
        const q = parseFloat(r.querySelector('input[name="quantity"]').value);
        const p = parseFloat(r.querySelector('input[name="price"]').value);
        const curr = livePrices[t];
        const cost = q * p;
        const currentVal = (typeof curr === 'number') ? (q * curr) : cost;
        const pl = (typeof curr === 'number') ? (currentVal - cost) : 0;
        total += currentVal;

        // Build the array we’ll send back to /api/saveHoldings:
        holdingsToSave.push({ ticker: t, quantity: q, price: p });

        const plSign = pl > 0 ? '+' : pl < 0 ? '-' : '';
        const plFormatted = `${plSign}$${Math.abs(pl).toFixed(2)}`;
        const plClass = pl >= 0 ? 'text-success' : 'text-danger';

        html += `
      <tr>
        <td>${t}</td>
        <td>$${currentVal.toFixed(2)}</td>
        <td class="${plClass}">${plFormatted}</td>
      </tr>`;
    });

    html += `</tbody></table><h4>Total Assets: $${total.toFixed(2)}</h4>`;
    document.getElementById('holdings-result').innerHTML = html;
    document.getElementById('total-value').textContent = '$' + total.toFixed(2);

    // 6a) Save back any edits (optional, in case user changed input fields before “Calculate”)
    fetch('/api/saveHoldings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(holdingsToSave)
    })
        .then(res => {
            if (!res.ok) console.error('Failed to save holdings on recalc.');
        })
        .catch(err => console.error('Error saving holdings on recalc:', err));
}


// ------------------- 7) Form submit → recalc & save (unchanged) -------------------
const holdingsForm = document.getElementById('holdings-form');
if (holdingsForm) {
    holdingsForm.addEventListener('submit', e => {
        e.preventDefault();
        calculateAndDisplayHoldings();
    });
}
