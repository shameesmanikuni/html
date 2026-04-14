const API_URL = 'http://localhost:3000/api';
// Your SQL schema requires a user_id. We will hardcode ID 1 for now until you build a login system.
const CURRENT_USER_ID = 1; 

document.addEventListener('DOMContentLoaded', () => {
    loadCategories();
    setupFormHandler();
    // Load transactions immediately if the list container exists on the current page
    if (document.getElementById('transaction-list')) {
        loadTransactions();
    }
});

// pages/app.js

const DUMMY_USER_ID = 1; // Match the ID from your database
const API_BASE_URL = 'http://localhost:3000/api';

// Example: Function to record a transaction
async function recordTransaction(event) {
    event.preventDefault();

    const transactionData = {
        user_id: DUMMY_USER_ID, // Use the dummy ID here
        category_id: document.getElementById('tx-category').value,
        transaction_type: 'expense', // Hardcoded for now
        name: document.getElementById('tx-name').value,
        amount: document.getElementById('tx-amount').value,
        transaction_date: new Date().toISOString().split('T')[0], // Today's date
        description: document.getElementById('tx-desc').value
    };

    try {
        const response = await fetch(`${API_BASE_URL}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transactionData)
        });
        
        const result = await response.json();
        alert(result.message);
    } catch (err) {
        console.error("Failed to record:", err);
    }
}

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
function setupFormHandler() {
    const form = document.getElementById('entry-form');
    if (!form) return; // Guard clause if form doesn't exist on the page
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        
        const amount = document.getElementById('tx-amount').value;
        const name = document.getElementById('tx-name').value;
        const categoryId = document.getElementById('tx-category').value;
        const description = document.getElementById('tx-desc').value;
        
        // Grab the new fields added to your HTML
        const typeField = document.getElementById('tx-type');
        const dateField = document.getElementById('tx-date');
        
        // Fallbacks just in case the HTML fields aren't found
        const transactionType = typeField ? typeField.value : 'expense';
        const transactionDate = (dateField && dateField.value) ? dateField.value : new Date().toISOString().split('T')[0];

        // Validation: Ensure a category is selected
        if (!categoryId) {
            alert('Please select a category.');
            return;
        }

        const payload = {
            user_id: CURRENT_USER_ID,
            category_id: categoryId,
            transaction_type: transactionType, 
            name: name,
            amount: parseFloat(amount),
            transaction_date: transactionDate,
            description: description
        };

        try {
            const response = await fetch(`${API_URL}/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                alert('Transaction logged successfully!');
                form.reset(); 
                // Set category dropdown back to default state
                document.getElementById('tx-category').value = ""; 
                loadTransactions(); // Refresh the list automatically
            } else {
                const errorData = await response.json();
                alert(`Database Error: ${errorData.error}`);
            }
        } catch (error) {
            console.error('Failed to save transaction:', error);
            alert('Cannot reach the server.');
        }
    });
}

// 3. Render the Transaction List
async function loadTransactions() {
    try {
        const response = await fetch(`${API_URL}/transactions`);
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