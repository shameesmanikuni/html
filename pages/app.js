// ==========================================
// --- 0. DYNAMIC PATH CALCULATION ---
// ==========================================
// Check if we are currently inside the 'pages' directory
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

// If no token exists, kick the user out to the login page immediately
if (!token || !userString) {
    window.location.replace(LOGIN_PAGE_URL);
} else {
    // Parse the real user data from the database
    currentUser = JSON.parse(userString);
    CURRENT_USER_ID = currentUser.id; // <-- The Magic Line!
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
// --- 3. INITIALIZATION ON LOAD ---
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Only proceed with DOM manipulation if we are authenticated
    if (!currentUser) return;

    // --- UI PERSONALIZATION ---
    // Find the elements that say "Architect Prime" and replace with real username
    const profileNames = document.querySelectorAll('.text-sm.font-bold.text-on-surface');
    profileNames.forEach(nameEl => {
        if (nameEl.innerText === 'Architect Prime') {
            nameEl.innerText = currentUser.username;
        }
    });

    // Wire up all "Sign Out" buttons dynamically
    const logoutLinks = document.querySelectorAll('a:has(.material-symbols-outlined)');
    logoutLinks.forEach(link => {
        if (link.innerText.includes('Sign Out')) {
            link.addEventListener('click', logoutUser);
        }
    });

    // --- INITIALIZE DATA ---
    loadCategories();
    setupFormHandler();

    // Load transactions only if the list container exists on the current page
    loadTransactions();
});


// ==========================================
// --- 4. API & DATA FUNCTIONS ---
// ==========================================

// Fetch categories from your MySQL database
async function loadCategories() {
    try {
        const response = await fetch(`${API_URL}/categories`);
        const categories = await response.json();

        const categorySelect = document.getElementById('tx-category');
        if (!categorySelect) return; // Guard clause if we aren't on the dashboard

        // Clear the "Loading..." text
        categorySelect.innerHTML = '<option value="" disabled selected>Select a category</option>';

        // Populate with real DB data
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            categorySelect.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load categories:', error);
        const categorySelect = document.getElementById('tx-category');
        if (categorySelect) {
            categorySelect.innerHTML = '<option value="" disabled>API Offline</option>';
        }
    }
}

// Handle the "Record Transaction" Form Submission
function setupFormHandler() {
    const form = document.getElementById('entry-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault(); // Stop the page from reloading!

        // Let's add a quick loading state to the button
        const submitBtn = document.getElementById('btn-record');
        const originalText = submitBtn.innerText;
        submitBtn.innerText = 'RECORDING...';
        submitBtn.disabled = true;

        // 1. Grab all the values from your HTML inputs
        const amountVal = parseFloat(document.getElementById('tx-amount').value);
        const name = document.getElementById('tx-name').value;
        const categoryId = document.getElementById('tx-category').value;
        const description = document.getElementById('tx-desc').value || null;

        // Date to TODAY, and type from the hidden input.
        const transactionDate = new Date().toISOString().split('T')[0];
        const transactionType = document.getElementById('tx-type').value;

        // 2. Validate
        if (!categoryId) {
            alert('Please select a category.');
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
            return;
        }

        // 3. Package the data for the server
        const payload = {
            user_id: CURRENT_USER_ID, // Our secure, logged-in user ID!
            category_id: categoryId,
            transaction_type: transactionType,
            name: name,
            amount: amountVal,
            transaction_date: transactionDate,
            description: description
        };

        // 4. Send to the database
        try {
            const response = await fetch(`${API_URL}/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                // Success! Clear the form.
                form.reset();
                document.getElementById('tx-category').value = "";

                // If we are on the dashboard, instantly reload the transaction list
                if (typeof loadTransactions === 'function') {
                    loadTransactions();
                }
            } else {
                const errorData = await response.json();
                alert(`Error saving to database: ${errorData.error}`);
            }
        } catch (error) {
            console.error('Failed to save transaction:', error);
            alert('Cannot reach the server.');
        } finally {
            // Restore the button
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        }
    });
}

// Render the Transaction List
async function loadTransactions() {
    try {
        const response = await fetch(`${API_URL}/transactions?user_id=${CURRENT_USER_ID}`);
        const transactions = await response.json();

        updateDashboardStats(transactions);

        // NOTE: Make sure you have a <div id="transaction-list"></div> in your HTML where you want these to show up!
        const list = document.getElementById('transaction-list');

        if (!list) return; // Skip if element isn't on this page

        if (transactions.length === 0) {
            list.innerHTML = '<p class="text-center text-on-surface-variant p-4">No transactions found.</p>';
            return;
        }

        list.innerHTML = transactions.map(t => {
            const isExpense = t.transaction_type === 'expense';
            const colorClass = isExpense ? 'text-error' : 'text-primary';
            const sign = isExpense ? '-' : '+';
            const icon = isExpense ? 'shopping_cart' : 'payments';

            const descHtml = t.description ? `<span class="opacity-75"> • ${t.description}</span>` : '';

            // Formatting the date nicely
            const dateObj = new Date(t.transaction_date);
            const formattedDate = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

            return `
                <div class="flex items-center justify-between p-3 rounded-lg hover:bg-surface-container-high transition-colors">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full bg-secondary-container/20 flex items-center justify-center text-secondary">
                            <span class="material-symbols-outlined">${icon}</span>
                        </div>
                        <div>
                            <p class="font-bold text-sm">${t.name}</p>
                            <p class="text-xs text-on-surface-variant">
                                ${t.category_name} ${descHtml} • ${formattedDate}
                            </p>
                        </div>
                    </div>
                    <p class="font-bold ${colorClass}">${sign}₹${parseFloat(t.amount).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error("Error loading transactions:", err);
    }
}

// --- TOGGLE LOGIC ---
function setTxType(type) {
    const expenseBtn = document.getElementById('type-expense');
    const incomeBtn = document.getElementById('type-income');
    const typeInput = document.getElementById('tx-type');

    typeInput.value = type;

    if (type === 'expense') {
        expenseBtn.className = "flex-1 py-2 text-xs font-bold rounded-lg transition-all bg-secondary text-on-secondary shadow-lg";
        incomeBtn.className = "flex-1 py-2 text-xs font-bold rounded-lg transition-all text-on-surface-variant hover:text-on-surface";
    } else {
        incomeBtn.className = "flex-1 py-2 text-xs font-bold rounded-lg transition-all bg-primary text-on-primary shadow-lg";
        expenseBtn.className = "flex-1 py-2 text-xs font-bold rounded-lg transition-all text-on-surface-variant hover:text-on-surface";
    }
}

// --- DASHBOARD MATH LOGIC ---
// --- DASHBOARD MATH LOGIC ---
function updateDashboardStats(transactions) {
    let totalIncome = 0;
    let totalExpense = 0;
    let totalAssets = 0;
    let totalInvestments = 0;

    // 1. Loop through and sum everything up
    transactions.forEach(t => {
        const amount = parseFloat(t.amount);

        // Core Income/Expense
        if (t.transaction_type === 'income') {
            totalIncome += amount;
        } else if (t.transaction_type === 'expense') {
            totalExpense += amount;
        }

        // Specific Categories (Assets & Investments)
        // Specific Categories (Assets & Investments)
        if (t.category_name === 'Asset') {
            if (t.transaction_type === 'expense') {
                totalAssets += amount; // Buying an asset INCREASES your asset total
            } else if (t.transaction_type === 'income') {
                totalAssets -= amount; // Selling an asset DECREASES your asset total
            }
        } else if (t.category_name === 'Investment') {
            if (t.transaction_type === 'expense') {
                totalInvestments += amount; // Buying an investment INCREASES your investment total
            } else if (t.transaction_type === 'income') {
                totalInvestments -= amount; // Selling an investment DECREASES your investment total
            }
        }
    });

    const netBalance = totalIncome - totalExpense;

    // 2. PERCENTAGE LOGIC (Compared to state before the last transaction)
    let percentageText = "0.0%";
    let isPositive = true;

    if (transactions.length > 0) {
        // Because of your SQL ORDER BY date DESC, index 0 is the most recent
        const latestTx = transactions[0]; 
        const latestAmount = parseFloat(latestTx.amount);
        
        // Did the last transaction add to or subtract from our net?
        const impact = latestTx.transaction_type === 'income' ? latestAmount : -latestAmount;
        
        // What was our balance before this transaction?
        const previousBalance = netBalance - impact;

        if (previousBalance !== 0) {
            // Calculate percentage change
            const percentChange = (impact / Math.abs(previousBalance)) * 100;
            isPositive = percentChange >= 0;
            percentageText = (isPositive ? '+' : '') + percentChange.toFixed(1) + '%';
        } else {
            // Edge case: If previous balance was 0, it's technically a 100% gain/loss
            isPositive = impact >= 0;
            percentageText = (isPositive ? '+' : '') + '100.0%';
        }
    }

    // 3. Formatting
    const formatCash = (num) => '₹' + num.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});

    // 4. Update the DOM
    const elNet = document.getElementById('stat-net');
    const elIncome = document.getElementById('stat-income');
    const elExpense = document.getElementById('stat-expense');
    const elAssets = document.getElementById('stat-assets');
    const elInvestments = document.getElementById('stat-investments');
    const elPercentage = document.getElementById('stat-percentage');

    if (elNet) elNet.innerText = formatCash(netBalance);
    if (elIncome) elIncome.innerText = formatCash(totalIncome);
    if (elExpense) elExpense.innerText = formatCash(totalExpense);
    if (elAssets) elAssets.innerText = formatCash(totalAssets);
    if (elInvestments) elInvestments.innerText = formatCash(totalInvestments);
    
    // Dynamically color the percentage badge (Green for +, Red for -)
    if (elPercentage) {
        elPercentage.innerText = percentageText;
        if (isPositive) {
            elPercentage.className = "text-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded";
        } else {
            elPercentage.className = "text-sm font-bold text-error bg-error/10 px-2 py-0.5 rounded"; // Uses your Tailwind red color
        }
    }
}