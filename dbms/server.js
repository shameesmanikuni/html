require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');       // <-- Added for password hashing
const jwt = require('jsonwebtoken');    // <-- Added for session tokens

const app = express();
app.use(cors());
app.use(express.json());

// Create the connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// ==========================================
// --- AUTHENTICATION ROUTES ---
// ==========================================

// 1. SIGNUP ROUTE
app.post('/api/signup', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        // Check if the email is already in use
        const [existingUsers] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ error: "Email is already registered" });
        }

        // Hash the password for security
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        // Insert the new user into the database
        const [result] = await pool.query(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            [username, email, password_hash]
        );

        res.status(201).json({ message: "Account created successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error during signup" });
    }
});

// 2. LOGIN ROUTE
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Find the user by email
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(400).json({ error: "Invalid email or password" });
        }

        const user = users[0];

        // --- CHANGE 1: THE DEACTIVATION CHECK ---
        if (!user.is_active) {
            return res.status(403).json({ error: "This account has been deactivated. Please contact support." });
        }

        // Compare the provided password...
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ error: "Invalid email or password" });
        }

        // Generate a JWT token for session management
        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET || 'fallback_secret_key',
            { expiresIn: '2h' }
        );

        // Send back the token and user details
        res.json({
            message: "Login successful",
            token: token,
            user: { id: user.id, username: user.username, email: user.email }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error during login" });
    }
});


// ==========================================
// --- USER PROFILE ROUTES ---
// ==========================================

// GET USER DETAILS
app.get('/api/users/:id', async (req, res) => {
    try {
        const [users] = await pool.query('SELECT username, email FROM users WHERE id = ?', [req.params.id]);
        if (users.length === 0) return res.status(404).json({ error: "User not found" });
        res.json(users[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE USER DETAILS (AND PASSWORD)
app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { username, email, currentPassword, newPassword } = req.body;

    try {
        // Fetch current user
        const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
        if (users.length === 0) return res.status(404).json({ error: "User not found" });

        const user = users[0];

        // If user is trying to update their password
        if (currentPassword && newPassword) {
            // Verify old password
            const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
            if (!isMatch) {
                return res.status(400).json({ error: "Incorrect current password" });
            }

            // Hash the new password
            const hashedNewPassword = await bcrypt.hash(newPassword, 10);

            // Update everything including password
            await pool.query(
                'UPDATE users SET username = ?, email = ?, password_hash = ? WHERE id = ?',
                [username, email, hashedNewPassword, id]
            );
        } else {
            // Just update username and email (no password change)
            await pool.query(
                'UPDATE users SET username = ?, email = ? WHERE id = ?',
                [username, email, id]
            );
        }
        res.json({ message: "Profile updated successfully!" });
    } catch (err) {
        // Handle unique constraint errors for email/username
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: "Username or email is already taken by another user." });
        }
        res.status(500).json({ error: err.message });
    }
});


// DELETE USER ACCOUNT
// --- CHANGE 2: THE SOFT DELETE ROUTE ---
// DEACTIVATE USER ACCOUNT (Soft Delete)
app.delete('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query('UPDATE users SET is_active = FALSE WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ message: "Account deactivated successfully." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to deactivate account" });
    }
});


// ==========================================
// --- TRANSACTION & CATEGORY ROUTES ---
// ==========================================

// 1. GET ALL TRANSACTIONS
app.get('/api/transactions', async (req, res) => {
    // We now look for the user_id in the query string, 
    // falling back to 1 if it's not provided (for safety/testing).
    const userId = req.query.user_id || 1;

    try {
        const [rows] = await pool.query(`
            SELECT t.*, c.name as category_name 
            FROM transactions t 
            LEFT JOIN categories c ON t.category_id = c.id 
            WHERE t.user_id = ? AND t.deleted_at IS NULL 
            ORDER BY t.transaction_date DESC
        `, [userId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. ADD A NEW TRANSACTION
app.post('/api/transactions', async (req, res) => {
    const { user_id, category_id, transaction_type, name, amount, transaction_date, description } = req.body;
    try {
        const [result] = await pool.query(
            `INSERT INTO transactions (user_id, category_id, transaction_type, name, amount, transaction_date, description) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [user_id, category_id, transaction_type, name, amount, transaction_date, description]
        );
        res.status(201).json({ id: result.insertId, message: "Transaction recorded successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. MODIFY A TRANSACTION (Update)
app.put('/api/transactions/:id', async (req, res) => {
    const { id } = req.params;
    const { category_id, transaction_type, name, amount, transaction_date, description } = req.body;
    try {
        await pool.query(
            `UPDATE transactions 
             SET category_id = ?, transaction_type = ?, name = ?, amount = ?, transaction_date = ?, description = ? 
             WHERE id = ?`,
            [category_id, transaction_type, name, amount, transaction_date, description, id]
        );
        res.json({ message: "Transaction updated successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. SOFT DELETE A TRANSACTION
app.delete('/api/transactions/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE transactions SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
        res.json({ message: "Transaction moved to trash" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. GET CATEGORIES
app.get('/api/categories', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, name FROM categories ORDER BY name ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`The Ledger API is live on http://localhost:${PORT}`);
});