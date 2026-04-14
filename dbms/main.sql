-- Create the database
CREATE DATABASE IF NOT EXISTS expense_tracker_pro;
USE expense_tracker_pro;

-- ==========================================
-- 1. USERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE, -- Allows you to ban or deactivate users
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ==========================================
-- 2. CATEGORIES TABLE (Global + Custom)
-- ==========================================
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT NULL, -- NULL means it's a default system category. INT means a user created it.
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- If a user is deleted, delete their custom categories
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Prevents the same user from creating duplicate categories, 
    -- but allows two different users to both create a "Gaming" category
    UNIQUE KEY unique_user_category (user_id, name)
);

-- ==========================================
-- 3. TRANSACTIONS TABLE (The Ledger)
-- ==========================================
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    category_id INT,
    transaction_type ENUM('expense', 'income') NOT NULL DEFAULT 'expense',
    name VARCHAR(100) NOT NULL,  -- ADD THIS LINE
    amount DECIMAL(12, 2) NOT NULL,
    transaction_date DATE NOT NULL,
    description VARCHAR(255),
    
    -- Timestamps for Auditing
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL, -- SOFT DELETE: Keeps the record, but marks it as deleted
    
    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    
    -- Indexes for drastically faster querying by user and date
    INDEX idx_user_date (user_id, transaction_date),
    INDEX idx_user_category (user_id, category_id)
);

-- ==========================================
-- 4. INSERT DEFAULT SYSTEM CATEGORIES
-- ==========================================
-- Notice user_id is missing (it defaults to NULL), making these available to everyone
INSERT IGNORE INTO categories (name) VALUES 
('Food & Dining'), 
('Transportation'), 
('Shopping'), 
('Utilities'), 
('Rent'),
('Salary'), 
('Entertainment'),
('Investment'),
('Asset'),
('Miscellaneous');