"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const pg_1 = require("pg");
const app = (0, express_1.default)();
const PORT = 5001;
// PostgreSQL connection pool
const pool = new pg_1.Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'Vendor_Management',
    password: 'Postgres0607@',
    port: 5432,
});
// Middleware
app.use((0, cors_1.default)());
app.use(body_parser_1.default.json());
// In-memory "database" (keeping your existing implementation)
let messages = [
    { id: 1, text: 'Hello from the server!' }
];
let nextId = 2;
// Existing message routes
app.get('/api/messages', (req, res) => {
    res.json(messages);
});
app.post('/api/messages', (req, res) => {
    const { text } = req.body;
    if (!text) {
        return res.status(400).json({ error: 'Text is required' });
    }
    const newMessage = { id: nextId++, text };
    messages.push(newMessage);
    res.status(201).json(newMessage);
});
// New PostgreSQL route for Alchemy_Routing
app.get('/Alchemy_Routing', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM "Alchemy_Routing"');
        res.json(rows);
    } catch (err) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : 'Database error occurred';
        res.status(500).json({ error: 'Server error', details: errorMessage });
    }
});
// Test database connection on startup
pool.query('SELECT NOW()')
    .then(() => console.log('Database connected successfully'))
    .catch(err => console.error('Database connection error:', err));
// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});