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

socket.on('priceUpdate', tick => {
    // TODO: replace with your UI-update logic
    console.log(`📈 ${tick.symbol}: ${tick.price}`);
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

setInterval(() => {
    const rows = document.querySelectorAll('table tbody tr');
    const i = Math.floor(Math.random() * rows.length);
    const cell = rows[i].children[1];
    const price = parseFloat(cell.textContent.slice(1)) * (1 + (Math.random() - 0.5) / 100);
    cell.textContent = '$' + price.toFixed(2);
}, 2000);
