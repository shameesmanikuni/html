// ==========================================
// --- 0. DYNAMIC PATH CALCULATION ---
// ==========================================
const isInPagesFolder = window.location.pathname.includes('/pages/');
const LOGIN_PAGE_URL = isInPagesFolder ? 'login.html' : 'pages/login.html';
const API_URL = 'http://localhost:3000/api';

// ==========================================
// --- 1. AUTHENTICATION & SECURITY CHECK ---
// ==========================================
const token = localStorage.getItem('ledger_token');
const userString = localStorage.getItem('ledger_user');

let currentUser = null;
let CURRENT_USER_ID = null;
let allTransactions = []; // Global variable for instant search

if (!token || !userString) {
    window.location.replace(LOGIN_PAGE_URL);
} else {
    currentUser = JSON.parse(userString);
    CURRENT_USER_ID = currentUser.id;
}

// ==========================================
// --- 2. GLOBAL LOGOUT FUNCTION ---
// ==========================================
function logoutUser(event) {
    if (event) event.preventDefault();
    localStorage.removeItem('ledger_token');
    localStorage.removeItem('ledger_user');
    window.location.replace(LOGIN_PAGE_URL);
}

// ==========================================
// --- 3. INITIALIZATION (Runs on Load & Page Swap) ---
// ==========================================
function initApp() {
    if (!currentUser) return;

    // 1. Personalize Profile
    document.querySelectorAll('.text-sm.font-bold.text-on-surface').forEach(nameEl => {
        if (nameEl.innerText === 'Architect Prime') {
            nameEl.innerText = currentUser.username;
        }
    });

    // 2. Wire up Sign Out
    document.querySelectorAll('a:has(.material-symbols-outlined)').forEach(link => {
        if (link.innerText.includes('Sign Out')) {
            link.addEventListener('click', logoutUser);
        }
    });

    // 3. Wire up Modal Triggers
    document.getElementById('sidebar-add-btn')?.addEventListener('click', openModal);
    document.getElementById('content-add-btn')?.addEventListener('click', openModal);

    document.getElementById('btn-open-filter')?.addEventListener('click', openFilterModal);
    document.getElementById('filter-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'filter-modal') closeFilterModal();
    });

    // 4. Close modal logic (Backdrop click)
    document.getElementById('transaction-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'transaction-modal') closeModal();
    });

    // 5. Data Setup
    loadCategories('tx-category');
    loadCategories('modal-tx-category');
    loadCategories('filter-category', true);
    setupFormHandler('entry-form');
    setupFormHandler('modal-entry-form');

    // Load the transactions (this also runs the dashboard math and renders the lists)
    loadTransactions();

    // 6. Initialize Search & Navigation
    setupSearch();
    setupNavigation();
    setupFilterHandler();
}

// Run setup when the page first loads
document.addEventListener('DOMContentLoaded', initApp);

// Handle the browser "Back" button smoothly
window.addEventListener('popstate', () => {
    navigateTo(window.location.pathname);
});

// ESCAPE Key Global Listener to close modal
document.addEventListener('keydown', (event) => {
    if (event.key === "Escape") closeModal();
});


// ==========================================
// --- 4. DATA & API FUNCTIONS ---
// ==========================================
// Replace your existing loadCategories with this slightly updated one:
async function loadCategories(selectId, isFilter = false) {
    const categorySelect = document.getElementById(selectId);
    if (!categorySelect) return;

    try {
        const response = await fetch(`${API_URL}/categories`);
        const categories = await response.json();
        
        // If it's the filter, keep the "All Categories" option. Otherwise, make it a disabled placeholder.
        categorySelect.innerHTML = isFilter 
            ? '<option value="all" selected>All Categories</option>' 
            : '<option value="" disabled selected>Select a category</option>';

        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name; 
            categorySelect.appendChild(option);
        });
    } catch (error) {
        categorySelect.innerHTML = '<option value="" disabled>API Offline</option>';
    }
}

function setupFormHandler(formId) {
    const form = document.getElementById(formId);
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const prefix = formId.includes('modal') ? 'modal-' : '';
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerText;

        submitBtn.innerText = 'RECORDING...';
        submitBtn.disabled = true;

        const payload = {
            user_id: CURRENT_USER_ID,
            category_id: document.getElementById(`${prefix}tx-category`).value,
            transaction_type: document.getElementById(`${prefix}tx-type`).value,
            name: document.getElementById(`${prefix}tx-name`).value,
            amount: parseFloat(document.getElementById(`${prefix}tx-amount`).value),
            transaction_date: new Date().toISOString().split('T')[0],
            description: document.getElementById(`${prefix}tx-desc`).value || null
        };

        try {
            const response = await fetch(`${API_URL}/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                form.reset();
                if (prefix === 'modal-') closeModal();
                loadTransactions();
            } else {
                alert('Error recording transaction');
            }
        } catch (error) {
            alert('Cannot reach server');
        } finally {
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        }
    });
}

async function loadTransactions() {
    try {
        const response = await fetch(`${API_URL}/transactions?user_id=${CURRENT_USER_ID}`);
        let transactions = await response.json();

        // SORT DESCENDING (Newest First)
        transactions.sort((a, b) => new Date(b.created_at || b.transaction_date) - new Date(a.created_at || a.transaction_date));

        // Save to our global array for instant searching
        allTransactions = transactions;

        // Calculate math for dashboard/header stats
        updateDashboardStats(allTransactions);

        // Draw the full list to the screen
        renderTransactionList(allTransactions);

    } catch (err) {
        console.error("Error loading transactions:", err);
    }
}

function renderTransactionList(transactionsToRender) {
    const list = document.getElementById('transaction-list');
    if (!list) return;

    if (transactionsToRender.length === 0) {
        list.innerHTML = '<p class="text-center text-on-surface-variant p-8 font-bold">No transactions found.</p>';
        return;
    }

    list.innerHTML = transactionsToRender.map(t => {
        const isExpense = t.transaction_type === 'expense';
        const colorClass = isExpense ? 'text-error' : 'text-primary';
        const sign = isExpense ? '-' : '+';
        const style = getCategoryIcon(t.category_name);
        const descHtml = t.description ? `<span class="opacity-75"> • ${t.description}</span>` : '';

        const dateObj = new Date(t.created_at || t.transaction_date);
        const formattedDate = dateObj.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
        const formattedTime = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        const formattedAmount = parseFloat(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        return `
            <div class="group flex items-center justify-between p-4 md:p-6 bg-surface-container-low hover:bg-surface-container-high rounded-2xl transition-all duration-300 border border-transparent hover:border-outline-variant/15">
                <div class="flex items-center gap-5">
                    <div class="w-12 h-12 rounded-xl ${style.color} flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                        <span class="material-symbols-outlined">${style.icon}</span>
                    </div>
                    <div>
                        <p class="text-on-surface text-lg font-bold">${t.name}</p>
                        <p class="text-on-surface-variant text-sm">${t.category_name} ${descHtml} • ${formattedDate} at ${formattedTime}</p>
                    </div>
                </div>
                <div class="text-right flex flex-col justify-center h-full">
                    <p class="text-xl font-bold ${colorClass}">${sign}₹${formattedAmount}</p>
                </div>
            </div>
        `;
    }).join('');
}

// 3. THE INSTANT SEARCH FUNCTION
function setupSearch() {
    const searchInput = document.getElementById('tx-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();

        const filteredData = allTransactions.filter(t => {
            // Safely handle descriptions that might be null/empty
            const safeDesc = t.description ? t.description.toLowerCase() : "";

            return t.name.toLowerCase().includes(searchTerm) ||
                t.category_name.toLowerCase().includes(searchTerm) ||
                t.amount.toString().includes(searchTerm) ||
                safeDesc.includes(searchTerm); // <-- Now it searches descriptions safely!
        });

        renderTransactionList(filteredData);
    });
}

// ==========================================
// --- 5. DASHBOARD UI LOGIC ---
// ==========================================
function updateDashboardStats(transactions) {
    let totalIncome = 0, totalExpense = 0, totalAssets = 0, totalInvestments = 0;

    transactions.forEach(t => {
        const amount = parseFloat(t.amount);
        if (t.transaction_type === 'income') totalIncome += amount;
        else totalExpense += amount;

        if (t.category_name === 'Asset') {
            totalAssets += (t.transaction_type === 'expense' ? amount : -amount);
        } else if (t.category_name === 'Investment') {
            totalInvestments += (t.transaction_type === 'expense' ? amount : -amount);
        }
    });

    const netBalance = totalIncome - totalExpense;

    let percentageText = "0.0%", isPositiveChange = true;
    if (transactions.length > 0) {
        const latestTx = transactions[0];
        const impact = latestTx.transaction_type === 'income' ? parseFloat(latestTx.amount) : -parseFloat(latestTx.amount);
        const previousBalance = netBalance - impact;
        if (previousBalance !== 0) {
            const percent = (impact / Math.abs(previousBalance)) * 100;
            isPositiveChange = percent >= 0;
            percentageText = (isPositiveChange ? '+' : '') + percent.toFixed(1) + '%';
        }
    }

    const format = (num) => '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };

    setEl('stat-net', format(netBalance));
    setEl('stat-income', format(totalIncome));
    setEl('stat-expense', format(totalExpense));
    setEl('stat-assets', format(totalAssets));
    setEl('stat-investments', format(totalInvestments));

    const elPct = document.getElementById('stat-percentage');
    if (elPct) {
        elPct.innerText = percentageText;
        elPct.className = `text-sm font-bold px-2 py-0.5 rounded ${isPositiveChange ? 'text-primary bg-primary/10' : 'text-error bg-error/10'}`;
    }

    const elHealth = document.getElementById('health-status');
    if (elHealth) {
        elHealth.innerText = netBalance >= 0 ? "Optimized" : "Critical Risk";
        elHealth.className = netBalance >= 0 ? "text-primary font-bold" : "text-error font-bold animate-pulse";
    }

    renderRecentFlux(transactions);
    renderStructuralBreakdown(netBalance, totalAssets, totalInvestments);
}

function getCategoryIcon(name) {
    const map = {
        'Food & Dining': { icon: 'restaurant', color: 'text-tertiary bg-tertiary/20' },
        'Transportation': { icon: 'directions_car', color: 'text-on-surface bg-surface-bright' },
        'Shopping': { icon: 'shopping_bag', color: 'text-primary bg-primary/20' },
        'Utilities': { icon: 'bolt', color: 'text-secondary bg-secondary/20' },
        'Rent': { icon: 'home', color: 'text-error bg-error/20' },
        'Salary': { icon: 'payments', color: 'text-primary bg-primary/20' },
        'Entertainment': { icon: 'movie', color: 'text-secondary bg-secondary/20' },
        'Investment': { icon: 'trending_up', color: 'text-primary bg-primary/20' },
        'Asset': { icon: 'real_estate_agent', color: 'text-secondary bg-secondary/20' }
    };
    return map[name] || { icon: 'category', color: 'text-on-surface bg-surface-bright' };
}

function renderRecentFlux(transactions) {
    const container = document.getElementById('recent-flux-list');
    if (!container) return;

    const recent = transactions.slice(0, 4);
    if (recent.length === 0) {
        container.innerHTML = '<p class="text-sm text-center text-on-surface-variant p-4">Clean slate.</p>';
        return;
    }

    container.innerHTML = recent.map(t => {
        const s = getCategoryIcon(t.category_name);
        const isExp = t.transaction_type === 'expense';
        return `
            <div class="flex items-center justify-between p-3 rounded-lg hover:bg-surface-container-high transition-colors">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-full ${s.color} flex items-center justify-center"><span class="material-symbols-outlined">${s.icon}</span></div>
                    <div><p class="font-bold text-sm truncate w-40">${t.name}</p><p class="text-xs text-on-surface-variant">${t.category_name}</p></div>
                </div>
                <p class="font-bold ${isExp ? 'text-error' : 'text-primary'}">${isExp ? '-' : '+'}₹${parseFloat(t.amount).toLocaleString('en-IN')}</p>
            </div>`;
    }).join('');
}

function renderStructuralBreakdown(cash, assets, investments) {
    const elDonut = document.getElementById('donut-chart');
    if (!elDonut) return;

    const sC = Math.max(0, cash), sA = Math.max(0, assets), sI = Math.max(0, investments);
    const total = sC + sA + sI;

    if (total === 0) {
        elDonut.style.background = 'conic-gradient(#222a3d 0% 100%)';
        return;
    }

    const pA = (sA / total) * 100, pI = (sI / total) * 100;
    const setPct = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = Math.round(val) + '%'; };

    setPct('pct-assets', pA); setPct('pct-investments', pI); setPct('pct-cash', (sC / total) * 100);
    setPct('donut-center-text', pA + pI);

    elDonut.style.background = `conic-gradient(#58e7aa 0% ${pA}%, #d0bcff ${pA}% ${pA + pI}%, #31394d ${pA + pI}% 100%)`;
}

// ==========================================
// --- 6. MODAL CONTROL ---
// ==========================================
function openModal() { document.getElementById('transaction-modal')?.classList.remove('hidden'); }
function closeModal() { document.getElementById('transaction-modal')?.classList.add('hidden'); }

function setTxType(type, isModal = false) {
    const prefix = isModal ? 'modal-' : '';
    document.getElementById(`${prefix}tx-type`).value = type;
    const isExp = type === 'expense';

    document.getElementById(`${prefix}type-expense`).className = isExp ? "flex-1 py-2 text-xs font-bold rounded-lg transition-all bg-secondary text-on-secondary shadow-lg" : "flex-1 py-2 text-xs font-bold rounded-lg transition-all text-on-surface-variant hover:text-on-surface";
    document.getElementById(`${prefix}type-income`).className = !isExp ? "flex-1 py-2 text-xs font-bold rounded-lg transition-all bg-primary text-on-primary shadow-lg" : "flex-1 py-2 text-xs font-bold rounded-lg transition-all text-on-surface-variant hover:text-on-surface";
}

// ==========================================
// --- 7. SPA ROUTER (Smooth Page Swapping) ---
// ==========================================
async function navigateTo(url) {
    NProgress.start();

    try {
        const response = await fetch(url);
        const html = await response.text();

        const parser = new DOMParser();
        const newDoc = parser.parseFromString(html, 'text/html');
        const newMain = newDoc.querySelector('main').innerHTML;

        document.querySelector('main').innerHTML = newMain;
        window.history.pushState({}, '', url);

        initApp(); // Re-wire everything!

    } catch (error) {
        console.error("Navigation failed:", error);
        window.location.href = url;
    }

    NProgress.done();
}

function setupNavigation() {
    document.querySelectorAll('aside nav a, aside .flex-1 a').forEach(link => {
        // Remove old listeners to prevent duplicates during SPA navigation
        const newLink = link.cloneNode(true);
        link.parentNode.replaceChild(newLink, link);

        newLink.addEventListener('click', (e) => {
            const url = newLink.getAttribute('href');
            if (url && url !== '#' && !url.includes('logout')) {
                e.preventDefault();
                navigateTo(url);
            }
        });
    });
}

// ==========================================
// --- FILTER LOGIC ---
// ==========================================
function openFilterModal() { document.getElementById('filter-modal')?.classList.remove('hidden'); }
function closeFilterModal() { document.getElementById('filter-modal')?.classList.add('hidden'); }

// Add this ESC key listener to your existing one so it closes the filter too
document.addEventListener('keydown', (event) => {
    if (event.key === "Escape") {
        closeModal();
        closeFilterModal();
    }
});

function setupFilterHandler() {
    const form = document.getElementById('filter-form');
    if (!form) return;

    // Apply Filters
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const categoryId = document.getElementById('filter-category').value;
        const minAmount = parseFloat(document.getElementById('filter-min-amount').value);
        const maxAmount = parseFloat(document.getElementById('filter-max-amount').value);
        const startDate = document.getElementById('filter-date-start').value;
        const endDate = document.getElementById('filter-date-end').value;

        // Loop through all transactions and keep only the ones that pass all the tests
        const filteredData = allTransactions.filter(t => {
            let isMatch = true;

            // Test 1: Category
            if (categoryId !== 'all' && t.category_id != categoryId) isMatch = false;

            // Test 2: Min Amount
            if (!isNaN(minAmount) && parseFloat(t.amount) < minAmount) isMatch = false;

            // Test 3: Max Amount
            if (!isNaN(maxAmount) && parseFloat(t.amount) > maxAmount) isMatch = false;

            // Test 4: Dates
            // We use transaction_date for accurate calendar filtering
            const txDate = new Date(t.transaction_date);
            if (startDate && txDate < new Date(startDate)) isMatch = false;
            
            // For the end date, we add one day to include transactions made ON that day
            if (endDate) {
                const end = new Date(endDate);
                end.setDate(end.getDate() + 1); 
                if (txDate >= end) isMatch = false;
            }

            return isMatch;
        });

        // Draw the filtered list and close modal
        renderTransactionList(filteredData);
        closeFilterModal();
    });

    // Clear Filters
    document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
        form.reset(); // Blanks out all the form inputs
        renderTransactionList(allTransactions); // Redraws everything
        closeFilterModal();
    });
}