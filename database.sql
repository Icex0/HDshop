-- Create database if it doesn't exist
SELECT 'CREATE DATABASE vulnerable_app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'vulnerable_app')\gexec

-- Connect to the database
\c vulnerable_app;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    profile_image VARCHAR(255)
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    total_amount DECIMAL(10,2) NOT NULL,
    items JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert test users if they don't exist
INSERT INTO users (username, email, password, role)
SELECT 'admin', 'admin@example.com', 'admin', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');

INSERT INTO users (username, email, password, role)
SELECT 'user', 'user@example.com', 'password', 'user'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'user1');