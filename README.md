# 🪙 The Ledger | Modern Expense Tracker

A sleek, dark-themed financial tracking application designed to help users manage transactions, monitor balances, and visualize financial health with a modern and responsive interface.

---

### 🗄️ Database Setup

This project uses **MySQL** as its database.

- Open your MySQL terminal or a GUI tool (e.g., MySQL Workbench).
- Run the `main.sql` script located in the root directory.
- This will:
  - Create the database: `expense_tracker_pro`
  - Initialize all required tables
  - Insert default categories such as:
    - Food & Dining
    - Transportation
    - Salary

---

### ⚙️ Environment Configuration

The backend requires environment variables for configuration.

- Locate the `.env` file in the root directory.
- Update the database credentials according to your local setup.

#### Default Configuration:

```env
DB_NAME=expense_tracker_pro
PORT=3000
JWT_SECRET="your_secret_key: -->edit this
```

> ⚠️ Ensure your MySQL service is running before starting the backend.

---

### 🖥️ Start the Backend Server

Navigate to the backend directory and start the server:

```bash
cd dbms
npm install
node server.js
```

✅ Expected Output:
```
The Ledger API is live on http://localhost:3000
```

---

### 🌐 4. Launch the Frontend

This project uses a **Single Page Application (SPA)** approach.

- Open the following file in your browser:

```
index.html
```

> ⚠️ Important: Make sure the backend server is running before opening the frontend.

---
