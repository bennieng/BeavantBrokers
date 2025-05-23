setInterval(() => {
    const rows = document.querySelectorAll('table tbody tr');
    const i = Math.floor(Math.random() * rows.length);
    const cell = rows[i].children[1];
    const price = parseFloat(cell.textContent.slice(1)) * (1 + (Math.random() - 0.5) / 100);
    cell.textContent = '$' + price.toFixed(2);
}, 2000);
