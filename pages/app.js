const API_URL = 'http://localhost:3000/api';

// ==========================================
// --- 1. AUTHENTICATION & SECURITY CHECK ---
// ==========================================
const token = localStorage.getItem('ledger_token');
const userString = localStorage.getItem('ledger_user');

// If no token exists, kick the user out to the login page immediately
if (!token || !userString) {
    // We use window.location.origin to handle relative folder paths safely
    window.location.href = window.location.origin + '/login.html'; 
}

// Parse the real user data from the database
const currentUser = JSON.parse(userString);
const CURRENT_USER_ID = currentUser.id; // <-- The Magic Line!

// ==========================================
// --- 2. GLOBAL LOGOUT FUNCTION ---
// ==========================================
function logoutUser(event) {
    if (event) event.preventDefault();
    localStorage.removeItem('ledger_token');
    localStorage.removeItem('ledger_user');
    window.location.href = window.location.origin + '/login.html';
}

document.addEventListener('DOMContentLoaded', () => {
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
    if (document.getElementById('transaction-list')) {
        loadTransactions();
    }
});

// pages/app.js
const API_BASE_URL = 'http://localhost:3000/api';

// Example: Function to record a transaction
// async function recordTransaction(event) {
//     event.preventDefault();

//     const transactionData = {
//         user_id: CURRENT_USER_ID,
//         category_id: document.getElementById('tx-category').value,
//         transaction_type: 'expense', // Hardcoded for now
//         name: document.getElementById('tx-name').value,
//         amount: document.getElementById('tx-amount').value,
//         transaction_date: new Date().toISOString().split('T')[0], // Today's date
//         description: document.getElementById('tx-desc').value
//     };

//     try {
//         const response = await fetch(`${API_BASE_URL}/transactions`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify(transactionData)
//         });
        
//         const result = await response.json();
//         alert(result.message);
//     } catch (err) {
//         console.error("Failed to record:", err);
//     }
// }

// Attach to the button
document.getElementById('btn-record').addEventListener('click', recordTransaction);

// 1. Fetch categories from your MySQL database
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

// 2. Handle the "Record Transaction" button
// --- 2. HANDLE NEW TRANSACTIONS ---
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
        
        // Your current HTML form doesn't have a date or type selector, 
        // so we will automatically set the date to TODAY, and type to 'expense'.
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

// 3. Render the Transaction List
async function loadTransactions() {
    try {
        const response = await fetch(`${API_URL}/transactions?user_id=${CURRENT_USER_ID}`);
        const transactions = await response.json();
        
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
                    <p class="font-bold ${colorClass}">${sign}$${parseFloat(t.amount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
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