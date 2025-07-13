// ─── NAVIGATION HELPERS ──────────────────────────────────────────────────

// hide section tags under main, then show only the one matching window.location.hash.
function showSection() {
    let current = window.location.hash.substring(1); // e.g. "#watchlist" → "watchlist"
    if (!current) {
        current = 'dashboard';
        history.replaceState(null, '', '#dashboard');
    }

    // hides all sections and only shows the one == current
    document.querySelectorAll('main section').forEach(sec => {
        sec.style.display = sec.id === current ? 'block' : 'none';
    });

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

    // keep topbar nav links active
    document.querySelectorAll('.navbar-nav .nav-link').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === '#' + current);
    });
}

// sets window.location.hash and immediately shows the correct section.
function navigate(sectionId) {
    window.location.hash = sectionId;
    showSection();
}

// called by logout
function logoutAndRedirect() {
    localStorage.removeItem('jwt');
    window.location.href = 'index.html';
}



const token = localStorage.getItem('jwt');
if (!token) {
    window.location.href = '/';
    throw new Error('No auth token, redirecting to login');
}

window.currentHoldings = [];

const livePrices = {};

// logout button
const logoutBtn = document.getElementById('logoutBtn');
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('jwt');
    window.location.href = '/';
});

// setup chart.js
const ctx = document.getElementById('priceChart').getContext('2d');
const priceChart = new Chart(ctx, {
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
// chart display helper
let chartSymbol = null;
let chartRange = '1d';

async function showChartFor(symbol) {
    chartSymbol = symbol;
    document.getElementById('chart-title').textContent = `Price Chart: ${symbol}`;
    document.getElementById('chart-container').style.display = 'block';

    // clear old data/labels
    priceChart.data.datasets[0].data = [];
    priceChart.data.labels = [];

    // fetch raw bars
    let bars = [];
    try {
        const res = await fetch(
            `/api/history?symbol=${encodeURIComponent(symbol)}&range=${chartRange}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        bars = await res.json();
        console.log('🕰 raw bars:', bars.length);
    } catch (err) {
        console.error('❌ history fetch:', err);
        return;
    }

    // for multi-day ranges, drop weekend points
    if (chartRange !== '1d') {
        bars = bars.filter(b => {
            const wd = new Date(b.t).getUTCDay();  // 0=Sun,6=Sat
            return wd >= 1 && wd <= 5;
        });
        console.log('🕰 bars after weekend filter:', bars.length);
    }


    // if not daily build categorical axis otherwise idk how to get rid of weekend bar
    if (chartRange !== '1d') {
        const labels = bars.map(b =>
            new Date(b.t).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            })
        );
        const data = bars.map(b => b.c);

        priceChart.options.scales.x = {
            type: 'category',
            title: { display: true, text: 'Date' },
            ticks: { autoSkip: true, maxTicksLimit: 12 }
        };

        priceChart.data.labels = labels;
        priceChart.data.datasets[0].data = data;
        priceChart.update();
        return;
    }

    // daily
    priceChart.options.scales.x = {
        type: 'time',
        time: {
            unit: 'minute',
            displayFormats: { minute: 'HH:mm' }
        },
        title: { display: true, text: 'Time (HH:mm)' }
    };

    priceChart.data.datasets[0].data = bars.map(b => ({
        x: new Date(b.t),
        y: b.c
    }));

    priceChart.update();
}




// range‐button handler
document.getElementById('rangeBtns').addEventListener('click', e => {
    const r = e.target.dataset.range;
    if (!r || !chartSymbol) return;
    chartRange = r;
    showChartFor(chartSymbol);
});

// watchlist “view chart” handler
document.getElementById('watch-cards').addEventListener('click', e => {
    const btn = e.target.closest('button[data-action="view-chart"]');
    if (!btn) return;
    showChartFor(btn.dataset.symbol);
});


// live mapping
const socket = io({ auth: { token } });

socket.on('connect', () => {
    console.log('🔗 Connected to price feed, socket id:', socket.id);
});

function updateDashboardMetrics() {
    let totalValue = 0;
    let totalCost = 0;
    let totalPnL = 0;
    let totalUnrealPL = 0;

    window.currentHoldings.forEach(({ ticker, quantity, price: costBasis }) => {
        const currPrice = livePrices[ticker];
        const currentVal = (typeof currPrice === 'number')
            ? (quantity * currPrice)
            : (quantity * costBasis);

        const costVal = quantity * costBasis;
        const pnl = currentVal - costVal;

        totalValue += currentVal;
        totalCost += costVal;
        totalPnL += pnl;
        totalUnrealPL += pnl;
    });

    // need to add this 
    const cashAvailable = 0.00;

    // update dom
    document.getElementById('total-value').textContent = `$${totalValue.toFixed(2)}`;

    // p&l
    const todaysPnLEl = document.getElementById('todays-pnl');
    const tnSign = totalPnL >= 0 ? '+' : '-';
    todaysPnLEl.textContent = `${tnSign}$${Math.abs(totalPnL).toFixed(2)}`;
    todaysPnLEl.className = totalPnL >= 0
        ? 'fs-3 text-success fw-bold'
        : 'fs-3 text-danger fw-bold';

    // urlz 
    const unrealPnLEl = document.getElementById('unrealized-pnl');
    const unSign = totalUnrealPL >= 0 ? '+' : '-';
    unrealPnLEl.textContent = `${unSign}$${Math.abs(totalUnrealPL).toFixed(2)}`;
    unrealPnLEl.className = totalUnrealPL >= 0
        ? 'fs-3 text-success fw-bold'
        : 'fs-3 text-danger fw-bold';

    // cash avail
    document.getElementById('cash-available').textContent = `$${cashAvailable.toFixed(2)}`;
}

socket.on('priceUpdate', ({ symbol, price, timestamp, change, changePercent }) => {
    livePrices[symbol] = price;

    const priceEl = document.getElementById(`price-${symbol}`);
    if (priceEl) priceEl.textContent = `$${price.toFixed(2)}`;

    const changeEl = document.getElementById(`change-${symbol}`);
    if (changeEl) {
        const sign = changePercent >= 0 ? '+' : '';
        changeEl.textContent = `${sign}${changePercent.toFixed(2)}%`;
        changeEl.className = changePercent >= 0 ? 'text-success' : 'text-danger';
    }

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
    updateDashboardMetrics();

    if (symbol === chartSymbol) {
        priceChart.data.datasets[0].data.push({
            x: new Date(timestamp || Date.now()),
            y: price
        });
        if (priceChart.data.datasets[0].data.length > 200) {
            priceChart.data.datasets[0].data.shift();
        }
        priceChart.update('none');
    }
});



// track button
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

    container.insertAdjacentHTML('beforeend', `
        <div class="col" id="card-${symbol}">
          <div class="card shadow-sm h-100">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h6 class="mb-0">${symbol}</h6>
              <div>
                <button 
                  class="btn btn-sm btn-outline-primary me-2" 
                  data-action="view-chart" 
                  data-symbol="${symbol}">
                  <i class="fas fa-chart-line"></i>
                </button>
                <button 
                  class="btn btn-sm btn-outline-danger" 
                  data-action="remove-card" 
                  data-symbol="${symbol}">
                  &times;
                </button>
              </div>
            </div>
            <div class="card-body text-center">
              <p id="price-${symbol}" class="fs-3">$0.00</p>
              <p id="change-${symbol}" class="text-muted small">–</p>
            </div>
          </div>
        </div>
      `);

});

window.removeCard = function (symbol) {
    const el = document.getElementById(`card-${symbol}`);
    if (el) el.remove();

    const watchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
    const updated = watchlist.filter(s => s !== symbol);
    localStorage.setItem('watchlist', JSON.stringify(updated));
};

// remove-card handler
document.getElementById('watch-cards').addEventListener('click', e => {
    const btn = e.target.closest('button[data-action="remove-card"]');
    if (!btn) return;
    const sym = btn.dataset.symbol;
    document.getElementById(`card-${sym}`)?.remove();
});

// view-chart handler
document.getElementById('watch-cards').addEventListener('click', e => {
    const btn = e.target.closest('button[data-action="view-chart"]');
    if (!btn) return;
    const sym = btn.dataset.symbol;
    showChartFor(sym);
});




// price alert function

// load saved alerts
let alerts = JSON.parse(localStorage.getItem('priceAlerts') || '[]');

// render alert table
function renderAlerts() {
    const tbody = document.getElementById('alerts-list');
    tbody.innerHTML = '';
    alerts.forEach((a, i) => {
        tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td>${a.symbol}</td>
        <td>$${a.price.toFixed(2)}</td>
        <td>${a.condition}</td>
        <td>
          <button class="btn btn-sm btn-danger" data-index="${i}">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `);
    });
}
renderAlerts();

// add alert
document.getElementById('alerts-form').addEventListener('submit', e => {
    e.preventDefault();
    const sym = document.getElementById('alertSymbol').value.trim().toUpperCase();
    const price = parseFloat(document.getElementById('alertPrice').value);
    const cond = document.getElementById('alertCondition').value;

    alerts.push({ symbol: sym, price, condition: cond });
    localStorage.setItem('priceAlerts', JSON.stringify(alerts));
    renderAlerts();
    e.target.reset();
});

// remove alert
document.getElementById('alerts-list').addEventListener('click', e => {
    if (!e.target.closest('button[data-index]')) return;
    const i = parseInt(e.target.closest('button').dataset.index);
    alerts.splice(i, 1);
    localStorage.setItem('priceAlerts', JSON.stringify(alerts));
    renderAlerts();
});

// when priceupdate, check alert
socket.on('priceUpdate', ({ symbol, price }) => {
    alerts.forEach((a, i) => {
        if (a.symbol !== symbol) return;
        const triggered =
            (a.condition === 'above' && price >= a.price) ||
            (a.condition === 'below' && price <= a.price);
        if (triggered) {
            if (Notification.permission === 'granted') {
                new Notification(`Alert: ${symbol} is ${a.condition} $${a.price}`, {
                    body: `Current price: $${price.toFixed(2)}`,
                    icon: '/favicon.ico'
                });
            }
            alerts.splice(i, 1);
            localStorage.setItem('priceAlerts', JSON.stringify(alerts));
            renderAlerts();
        }
    });
});

// req notification permission
if (Notification && Notification.permission !== 'granted') {
    Notification.requestPermission();
}


window.addEventListener('DOMContentLoaded', () => {
    // rehydrate saved watchlist cards
    const saved = JSON.parse(localStorage.getItem('watchlist') || '[]');
    saved.forEach(sym => {
        document.getElementById('stockSymbol').value = sym;
        document.getElementById('trackBtn').click();
    });

    // add holding and remove row handler
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

        // reinsert each saved row and store in window.currentHoldings
        window.currentHoldings = []; // reset
        data.forEach(({ ticker, quantity, price }) => {
            const row = document.createElement('tr');
            row.innerHTML = `
        <td><input type="text" class="form-control" name="ticker" value="${ticker}" required></td>
        <td><input type="number" class="form-control" name="quantity" value="${quantity}" min="0" required></td>
        <td><input type="number" class="form-control" name="price" value="${price}" min="0" step="0.01" required></td>
        <td><button type="button" class="btn btn-danger btn-sm remove-row"><i class="fas fa-trash"></i></button></td>
      `;
            body.appendChild(row);

            window.currentHoldings.push({
                ticker: ticker.toUpperCase(),
                quantity: quantity,
                price: price
            });
        });


        // fetch current price for each holding
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
                });
        });

        // calculate table and cards after all quotes are fetched
        Promise.all(quotePromises).then(() => {
            calculateAndDisplayHoldings();
            updateDashboardMetrics();
        });
    })
    .catch(err => {
        console.error('Error loading holdings:', err);
    });

// —— ML Predictions tab loader ——  
async function loadPredictions() {
    const cards = document.getElementById('prediction-cards');
    cards.innerHTML = '';

    // 2a) Use a separate ML‐symbols list, default to empty
    const mlSymbols = JSON.parse(localStorage.getItem('mlSymbols') || '[]');
    if (mlSymbols.length === 0) {
        cards.innerHTML = '<p>No symbols added. Use the input above.</p>';
        return;
    }

    cards.innerHTML = '<p>Loading predictions…</p>';

    // 2b) Fetch predictions in parallel
    const results = await Promise.allSettled(
        mlSymbols.map(sym =>
            fetch(`/api/predict?symbol=${sym}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
                .then(r => {
                    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
                    return r.json();
                })
                .then(data => ({ sym, data }))
        )
    );

    // 2c) Render cards with a remove-button
    cards.innerHTML = '';
    results.forEach(r => {
        if (r.status === 'fulfilled' && !r.value.data.error) {
            const { sym, data: { next_day_close } } = r.value;

            cards.insertAdjacentHTML('beforeend', `
        <div class="col">
          <div class="card shadow-sm h-100 text-center">
            <div class="card-body position-relative">
              <!-- ← PART A: Remove button -->
              <button 
                class="btn-close position-absolute top-0 end-0 remove-pred-symbol" 
                data-symbol="${sym}"
                aria-label="Remove">
              </button>

              <h6 class="card-title">${sym}</h6>
              <p class="fs-3">$${next_day_close.toFixed(2)}</p>
            </div>
          </div>
        </div>
      `);
        } else {
            const sym = r.status === 'fulfilled' ? r.value.sym : '???';
            cards.insertAdjacentHTML('beforeend', `
        <div class="col">
          <div class="card border-danger text-center">
            <div class="card-body">
              Error loading ${sym}
            </div>
          </div>
        </div>
      `);
        }
    });
}


// 3) Show the tab and load on hash
window.addEventListener('hashchange', () => {
    if (window.location.hash === '#predictions') loadPredictions();
});
if (window.location.hash === '#predictions') loadPredictions();

// 4) Add‐symbol handler
document.getElementById('addPredSymbol').addEventListener('click', () => {
    const inp = document.getElementById('predSymbolInput');
    const sym = inp.value.trim().toUpperCase();
    if (!sym) return;
    let mlSymbols = JSON.parse(localStorage.getItem('mlSymbols') || '[]');
    if (!mlSymbols.includes(sym)) {
        mlSymbols.push(sym);
        localStorage.setItem('mlSymbols', JSON.stringify(mlSymbols));
        loadPredictions();
    }
    inp.value = '';
});

// 5) Remove‐symbol handler (event-delegation)
document.getElementById('prediction-cards').addEventListener('click', e => {
    const btn = e.target.closest('.remove-pred-symbol');
    if (!btn) return;
    const sym = btn.dataset.symbol;
    let mlSymbols = JSON.parse(localStorage.getItem('mlSymbols') || '[]');
    mlSymbols = mlSymbols.filter(s => s !== sym);
    localStorage.setItem('mlSymbols', JSON.stringify(mlSymbols));
    loadPredictions();
});





// calculate and display holding helper
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

    // saves edits in case user makes changes before calcualting
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


// logic to group same stock and recalculate avg price
const holdingsForm = document.getElementById('holdings-form');
if (holdingsForm) {
    holdingsForm.addEventListener('submit', e => {
        e.preventDefault();

        const rows = Array.from(document.querySelectorAll('#holdings-body tr'));
        const grouped = {};

        rows.forEach(r => {
            const t = r.querySelector('input[name="ticker"]').value.trim().toUpperCase();
            const q = parseFloat(r.querySelector('input[name="quantity"]').value);
            const p = parseFloat(r.querySelector('input[name="price"]').value);
            if (!t || isNaN(q) || isNaN(p)) return;

            if (!grouped[t]) {
                grouped[t] = { totalQty: q, totalCost: q * p };
            } else {
                grouped[t].totalQty += q;
                grouped[t].totalCost += q * p;
            }
        });

        const tbody = document.getElementById('holdings-body');
        tbody.innerHTML = '';
        Object.entries(grouped).forEach(([ticker, { totalQty, totalCost }]) => {
            const avg = totalCost / totalQty;
            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td><input type="text"   class="form-control" name="ticker"  value="${ticker}" required></td>
        <td><input type="number" class="form-control" name="quantity" value="${totalQty}" min="0" required></td>
        <td><input type="number" class="form-control" name="price"    value="${avg.toFixed(2)}" min="0" step="0.01" required></td>
        <td>
          <button type="button" class="btn btn-danger btn-sm remove-row">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;
            tbody.appendChild(tr);
        });

        calculateAndDisplayHoldings();
    });
}

