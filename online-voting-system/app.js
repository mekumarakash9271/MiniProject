const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure database directory exists
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir);
}

// Connect to SQLite database
const dbFile = path.join(dbDir, 'voting.db');
const db = new sqlite3.Database(dbFile, (err) => {
    if (err) {
        console.error('Database connection failed:', err.message);
    } else {
        console.log('Connected to the SQLite database successfully.');
    }
});

// Initialize Tables and Sample Data
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS voters (
        id TEXT PRIMARY KEY,
        name TEXT,
        has_voted INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS candidates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        votes INTEGER DEFAULT 0
    )`);

    // Insert mock candidates if table is empty
    db.get("SELECT COUNT(*) as count FROM candidates", (err, row) => {
        if (row.count === 0) {
            db.run("INSERT INTO candidates (name, votes) VALUES ('Candidate A', 0)");
            db.run("INSERT INTO candidates (name, votes) VALUES ('Candidate B', 0)");
        }
    });

    // Insert mock registered voters if table is empty
    db.get("SELECT COUNT(*) as count FROM voters", (err, row) => {
        if (row.count === 0) {
            db.run("INSERT INTO voters (id, name, has_voted) VALUES ('VOTER01', 'Alice', 0)");
            db.run("INSERT INTO voters (id, name, has_voted) VALUES ('VOTER02', 'Bob', 0)");
        }
    });
});

// API Route: Get all candidates
app.get('/candidates', (req, res) => {
    db.all("SELECT * FROM candidates", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// API Route: Handle vote submission securely
app.post('/vote', (req, res) => {
    const { voterId, candidateId } = req.body;

    if (!voterId || !candidateId) {
        return res.status(400).json({ message: "Voter ID and Candidate selection are required." });
    }

    db.get("SELECT has_voted FROM voters WHERE id = ?", [voterId], (err, voter) => {
        if (err) return res.status(500).json({ message: "Database query error." });
        if (!voter) return res.status(404).json({ message: "Invalid Voter ID. You are not registered." });
        if (voter.has_voted === 1) return res.status(400).json({ message: "Access Denied: You have already voted!" });

        // Update database atomically
        db.serialize(() => {
            db.run("UPDATE candidates SET votes = votes + 1 WHERE id = ?", [candidateId]);
            db.run("UPDATE voters SET has_voted = 1 WHERE id = ?", [voterId], (updateErr) => {
                if (updateErr) return res.status(500).json({ message: "Failed to record vote." });
                res.status(200).json({ message: "Vote successfully cast!" });
            });
        });
    });
});

// API Route: Get live voting results for admin panel
app.get('/results', (req, res) => {
    db.all("SELECT * FROM candidates", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});