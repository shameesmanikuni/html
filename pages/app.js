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
    const profileNames = document.querySelectorAll('.user-name-label');
    profileNames.forEach(nameEl => {
        if (nameEl.innerText === 'Architect Prime' || nameEl.innerText === 'User') {
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

    document.getElementById('edit-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'edit-modal') closeEditModal();
    });

    // 4. Close modal logic (Backdrop click)
    document.getElementById('transaction-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'transaction-modal') closeModal();
    });

    // 5. Data Setup
    loadCategories('tx-category');
    loadCategories('modal-tx-category');
    loadCategories('filter-category', true);
    loadCategories('edit-tx-category');
    setupFormHandler('entry-form');
    setupFormHandler('modal-entry-form');
    setupEditFormHandler();

    // Load the transactions
    loadTransactions();

    // 5.5 Settings Page Setup
    if (window.location.pathname.includes('settings.html')) {
        loadSettings();
        setupProfileForm();
        setupDeleteAccount();
    }

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
    if (event.key === "Escape") {
        closeModal();
        closeFilterModal();
        closeEditModal();
    }
});


// ==========================================
// --- 4. DATA & API FUNCTIONS ---
// ==========================================
async function loadCategories(selectId, isFilter = false) {
    const categorySelect = document.getElementById(selectId);
    if (!categorySelect) return;

    try {
        const response = await fetch(`${API_URL}/categories`);
        const categories = await response.json();

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

    // SPA protection: clone form to remove old listeners
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const prefix = formId.includes('modal') ? 'modal-' : '';
        const submitBtn = newForm.querySelector('button[type="submit"]') || document.querySelector(`button[form="${formId}"]`);
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
                newForm.reset();
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

        transactions.sort((a, b) => new Date(b.created_at || b.transaction_date) - new Date(a.created_at || a.transaction_date));
        allTransactions = transactions;

        updateDashboardStats(allTransactions);
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
                <div class="flex items-center gap-4">
                    <div class="text-right flex flex-col justify-center h-full">
                        <p class="text-xl font-bold ${colorClass}">${sign}₹${formattedAmount}</p>
                    </div>
                    <div class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center bg-surface-container-highest rounded-lg p-1 border border-outline-variant/20">
                        <button onclick="openEditModal(${t.id})" title="Edit" class="p-1.5 rounded-md hover:bg-surface-bright text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center">
                            <span class="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                        <button onclick="deleteTransaction(${t.id})" title="Delete" class="p-1.5 rounded-md hover:bg-surface-bright text-on-surface-variant hover:text-error transition-colors flex items-center justify-center">
                            <span class="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function setupSearch() {
    const searchInput = document.getElementById('tx-search');
    if (!searchInput) return;

    const newSearchInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);

    newSearchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredData = allTransactions.filter(t => {
            const safeDesc = t.description ? t.description.toLowerCase() : "";
            return t.name.toLowerCase().includes(searchTerm) ||
                t.category_name.toLowerCase().includes(searchTerm) ||
                t.amount.toString().includes(searchTerm) ||
                safeDesc.includes(searchTerm);
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
        elHealth.innerText = netBalance >= 0 ? "Optimized" : "Unhealthy";
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
    if (typeof NProgress !== 'undefined') NProgress.start();

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Page not found");

        const html = await response.text();
        const parser = new DOMParser();
        const newDoc = parser.parseFromString(html, 'text/html');

        // Swap out content
        document.querySelector('main').innerHTML = newDoc.querySelector('main').innerHTML;
        document.querySelector('aside').innerHTML = newDoc.querySelector('aside').innerHTML;

        window.history.pushState({}, '', url);
        initApp();

    } catch (error) {
        console.error("Navigation failed:", error);
        window.location.href = url;
    }

    if (typeof NProgress !== 'undefined') NProgress.done();
}

function setupNavigation() {
    document.querySelectorAll('aside nav a, aside .flex-1 a').forEach(link => {
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
// --- 8. FILTER LOGIC ---
// ==========================================
function openFilterModal() { document.getElementById('filter-modal')?.classList.remove('hidden'); }
function closeFilterModal() { document.getElementById('filter-modal')?.classList.add('hidden'); }

function setupFilterHandler() {
    const form = document.getElementById('filter-form');
    if (!form) return;

    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    newForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const categoryId = document.getElementById('filter-category').value;
        const minAmount = parseFloat(document.getElementById('filter-min-amount').value);
        const maxAmount = parseFloat(document.getElementById('filter-max-amount').value);
        const startDate = document.getElementById('filter-date-start').value;
        const endDate = document.getElementById('filter-date-end').value;

        const filteredData = allTransactions.filter(t => {
            let isMatch = true;
            if (categoryId !== 'all' && t.category_id != categoryId) isMatch = false;
            if (!isNaN(minAmount) && parseFloat(t.amount) < minAmount) isMatch = false;
            if (!isNaN(maxAmount) && parseFloat(t.amount) > maxAmount) isMatch = false;
            
            const txDate = new Date(t.transaction_date);
            if (startDate && txDate < new Date(startDate)) isMatch = false;
            if (endDate) {
                const end = new Date(endDate);
                end.setDate(end.getDate() + 1);
                if (txDate >= end) isMatch = false;
            }
            return isMatch;
        });

        renderTransactionList(filteredData);
        closeFilterModal();
    });

    document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
        newForm.reset(); 
        renderTransactionList(allTransactions); 
        closeFilterModal();
    });
}

// ==========================================
// --- 9. SETTINGS & PROFILE LOGIC ---
// ==========================================
function loadSettings() {
    const nameInput = document.getElementById('profile-name');
    const emailInput = document.getElementById('profile-email');

    if (nameInput && currentUser) nameInput.value = currentUser.username;
    if (emailInput && currentUser) emailInput.value = currentUser.email;
}

function setupProfileForm() {
    const form = document.getElementById('profile-form');
    if (!form) return;

    // SPA protection to prevent duplicate listeners
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = document.getElementById('btn-save-profile');
        const originalText = btn.innerText;
        btn.innerText = 'SAVING...';
        btn.disabled = true;

        const payload = {
            username: document.getElementById('profile-name').value,
            email: document.getElementById('profile-email').value,
            currentPassword: document.getElementById('profile-current-password').value,
            newPassword: document.getElementById('profile-new-password').value
        };

        if ((payload.currentPassword && !payload.newPassword) || (!payload.currentPassword && payload.newPassword)) {
            alert("To change your password, you must provide both your current and new password.");
            btn.innerText = originalText;
            btn.disabled = false;
            return;
        }

        try {
            const response = await fetch(`${API_URL}/users/${CURRENT_USER_ID}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok) {
                alert('Profile updated successfully!');
                currentUser.username = payload.username;
                currentUser.email = payload.email;
                localStorage.setItem('ledger_user', JSON.stringify(currentUser));
                document.querySelectorAll('.user-name-label').forEach(el => el.innerText = currentUser.username);
                
                document.getElementById('profile-current-password').value = '';
                document.getElementById('profile-new-password').value = '';
            } else {
                alert(result.error || 'Failed to update profile');
            }
        } catch (error) {
            alert('Cannot reach server');
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
}

function setupDeleteAccount() {
    const deleteBtn = document.getElementById('btn-delete-account');
    
    // Debugging safety net
    if (!deleteBtn) {
        console.warn("Delete button not found! Make sure your button in settings.html has exactly id='btn-delete-account'");
        return;
    }

    // SPA Protection: prevent multiple events piling up
    const newBtn = deleteBtn.cloneNode(true);
    deleteBtn.parentNode.replaceChild(newBtn, deleteBtn);

    newBtn.addEventListener('click', async () => {
        if (!confirm("Are you sure you want to deactivate your account?")) return;
        if (!confirm("Final warning: You will be logged out immediately. Proceed?")) return;

        try {
            const response = await fetch(`${API_URL}/users/${CURRENT_USER_ID}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                alert("Account deactivated.");
                logoutUser(); 
            } else {
                const result = await response.json();
                alert(result.error || "Failed to deactivate account");
            }
        } catch (error) {
            console.error("Delete Error:", error);
            alert("Error: " + error.message);
        }
    });
}


// ==========================================
// --- 8. EDIT & DELETE LOGIC ---
// ==========================================

function closeEditModal() { 
    document.getElementById('edit-modal')?.classList.add('hidden'); 
}

function setEditTxType(type) {
    document.getElementById('edit-tx-type').value = type;
    const isExp = type === 'expense';
    document.getElementById('edit-type-expense').className = isExp ? "flex-1 py-2 text-xs font-bold rounded-lg transition-all bg-secondary text-on-secondary shadow-lg" : "flex-1 py-2 text-xs font-bold rounded-lg transition-all text-on-surface-variant hover:text-on-surface";
    document.getElementById('edit-type-income').className = !isExp ? "flex-1 py-2 text-xs font-bold rounded-lg transition-all bg-primary text-on-primary shadow-lg" : "flex-1 py-2 text-xs font-bold rounded-lg transition-all text-on-surface-variant hover:text-on-surface";
}

function openEditModal(txId) {
    // 1. Find the transaction in our global array
    const tx = allTransactions.find(t => t.id === txId);
    if (!tx) return;

    // 2. Pre-fill the form
    document.getElementById('edit-tx-id').value = tx.id;
    document.getElementById('edit-tx-amount').value = tx.amount;
    document.getElementById('edit-tx-name').value = tx.name;
    document.getElementById('edit-tx-category').value = tx.category_id;
    document.getElementById('edit-tx-desc').value = tx.description || '';
    
    // 3. Set the type buttons
    setEditTxType(tx.transaction_type);

    // 4. Show the modal
    document.getElementById('edit-modal').classList.remove('hidden');
}

async function deleteTransaction(txId) {
    if (!confirm("Are you sure you want to delete this transaction? This cannot be undone.")) return;
    
    try {
        const response = await fetch(`${API_URL}/transactions/${txId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadTransactions(); // Reload list
        } else {
            alert("Failed to delete transaction.");
        }
    } catch (error) {
        alert("Cannot reach server.");
    }
}

function setupEditFormHandler() {
    const form = document.getElementById('edit-entry-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const txId = document.getElementById('edit-tx-id').value;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerText;

        submitBtn.innerText = 'SAVING...';
        submitBtn.disabled = true;

        // Fetch original transaction to preserve its date
        const originalTx = allTransactions.find(t => t.id == txId);
        // Format date for MySQL (YYYY-MM-DD)
        const formattedDate = new Date(originalTx.transaction_date).toISOString().split('T')[0];

        const payload = {
            category_id: document.getElementById('edit-tx-category').value,
            transaction_type: document.getElementById('edit-tx-type').value,
            name: document.getElementById('edit-tx-name').value,
            amount: parseFloat(document.getElementById('edit-tx-amount').value),
            transaction_date: formattedDate,
            description: document.getElementById('edit-tx-desc').value || null
        };

        try {
            const response = await fetch(`${API_URL}/transactions/${txId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                closeEditModal();
                loadTransactions(); // Redraw with new data
            } else {
                alert('Error updating transaction');
            }
        } catch (error) {
            alert('Cannot reach server');
        } finally {
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        }
    });
}