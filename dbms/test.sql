-- Insert a dummy user
INSERT INTO users (username, email, password_hash) 
VALUES ('TestUser', 'test@example.com', 'dummy_hash_123');

-- Verify the ID (it will likely be 1)
SELECT id, username FROM users;