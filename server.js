const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));

// Database setup
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

// Initialize database tables
function initializeDatabase() {
    db.serialize(() => {
        // Create tables
        db.run(`CREATE TABLE IF NOT EXISTS produk (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode_produk TEXT UNIQUE NOT NULL,
      nama_produk TEXT NOT NULL,
      harga REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

        db.run(`CREATE TABLE IF NOT EXISTS stock_produk (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      produk_id INTEGER NOT NULL,
      jumlah_stock INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (produk_id) REFERENCES produk(id)
    )`);

        db.run(`CREATE TABLE IF NOT EXISTS pembelian (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nomor_pembelian TEXT UNIQUE NOT NULL,
      produk_id INTEGER NOT NULL,
      jumlah INTEGER NOT NULL,
      total_harga REAL NOT NULL,
      status TEXT DEFAULT 'active',
      tanggal_pembelian DATETIME DEFAULT CURRENT_TIMESTAMP,
      cancelled_at DATETIME,
      FOREIGN KEY (produk_id) REFERENCES produk(id)
    )`);

        // Check if products exist
        db.get('SELECT COUNT(*) as count FROM produk', (err, row) => {
            if (row.count === 0) {
                insertDefaultProducts();
            }
        });
    });
}

// Insert default products
function insertDefaultProducts() {
    const products = [
        { kode: 'PRD001', nama: 'Laptop ASUS ROG', harga: 15000000, stock: 10 },
        { kode: 'PRD002', nama: 'Mouse Logitech G502', harga: 750000, stock: 50 },
        { kode: 'PRD003', nama: 'Keyboard Mechanical', harga: 1200000, stock: 30 },
        { kode: 'PRD004', nama: 'Monitor LG 24"', harga: 2500000, stock: 15 },
        { kode: 'PRD005', nama: 'Headset Gaming', harga: 850000, stock: 40 },
        { kode: 'PRD006', nama: 'Webcam HD', harga: 650000, stock: 25 },
        { kode: 'PRD007', nama: 'SSD 1TB', harga: 1500000, stock: 35 },
        { kode: 'PRD008', nama: 'RAM 16GB DDR4', harga: 900000, stock: 45 },
        { kode: 'PRD009', nama: 'USB Hub 7 Port', harga: 250000, stock: 60 },
        { kode: 'PRD010', nama: 'External HDD 2TB', harga: 1100000, stock: 20 }
    ];

    products.forEach(p => {
        db.run(
            'INSERT INTO produk (kode_produk, nama_produk, harga) VALUES (?, ?, ?)',
            [p.kode, p.nama, p.harga],
            function (err) {
                if (!err) {
                    db.run('INSERT INTO stock_produk (produk_id, jumlah_stock) VALUES (?, ?)',
                        [this.lastID, p.stock]);
                }
            }
        );
    });

    console.log('Default products inserted');
}

// Routes
app.get('/', (req, res) => {
    db.all(`
    SELECT 
      COUNT(DISTINCT p.id) as total_produk,
      COALESCE(SUM(s.jumlah_stock), 0) as total_stock,
      (SELECT COUNT(*) FROM pembelian WHERE status = 'active') as total_pembelian_aktif,
      (SELECT COUNT(*) FROM pembelian WHERE status = 'cancelled') as total_pembelian_batal
    FROM produk p
    LEFT JOIN stock_produk s ON p.id = s.produk_id
  `, (err, rows) => {
        const stats = rows[0] || { total_produk: 0, total_stock: 0, total_pembelian_aktif: 0, total_pembelian_batal: 0 };
        res.render('index', { stats });
    });
});

app.get('/produk', (req, res) => {
    res.render('produk');
});

app.get('/pembelian', (req, res) => {
    res.render('pembelian');
});

// API: Get all products with stock
app.get('/api/produk', (req, res) => {
    db.all(`
    SELECT p.*, COALESCE(s.jumlah_stock, 0) as stock
    FROM produk p
    LEFT JOIN stock_produk s ON p.id = s.produk_id
    ORDER BY p.nama_produk
  `, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// API: Get all purchases
app.get('/api/pembelian', (req, res) => {
    db.all(`
    SELECT pb.*, p.nama_produk, p.kode_produk
    FROM pembelian pb
    JOIN produk p ON pb.produk_id = p.id
    ORDER BY pb.tanggal_pembelian DESC
  `, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// API: Create purchase
app.post('/api/pembelian', (req, res) => {
    const { produk_id, jumlah } = req.body;

    // Validate input
    if (!produk_id || !jumlah || jumlah <= 0) {
        return res.status(400).json({ error: 'Data tidak valid' });
    }

    // Check stock
    db.get('SELECT jumlah_stock FROM stock_produk WHERE produk_id = ?', [produk_id], (err, stock) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (!stock || stock.jumlah_stock < jumlah) {
            return res.status(400).json({ error: 'Stok tidak mencukupi' });
        }

        // Get product price
        db.get('SELECT harga FROM produk WHERE id = ?', [produk_id], (err, produk) => {
            if (err || !produk) {
                return res.status(500).json({ error: 'Produk tidak ditemukan' });
            }

            const total_harga = produk.harga * jumlah;
            const nomor_pembelian = 'PB' + Date.now();

            // Insert purchase
            db.run(
                'INSERT INTO pembelian (nomor_pembelian, produk_id, jumlah, total_harga) VALUES (?, ?, ?, ?)',
                [nomor_pembelian, produk_id, jumlah, total_harga],
                function (err) {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }

                    // Update stock
                    db.run(
                        'UPDATE stock_produk SET jumlah_stock = jumlah_stock - ?, updated_at = CURRENT_TIMESTAMP WHERE produk_id = ?',
                        [jumlah, produk_id],
                        (err) => {
                            if (err) {
                                return res.status(500).json({ error: err.message });
                            }
                            res.json({
                                message: 'Pembelian berhasil dibuat',
                                id: this.lastID,
                                nomor_pembelian
                            });
                        }
                    );
                }
            );
        });
    });
});

// API: Cancel purchase
app.put('/api/pembelian/:id/cancel', (req, res) => {
    const { id } = req.params;

    // Get purchase details
    db.get('SELECT * FROM pembelian WHERE id = ? AND status = "active"', [id], (err, pembelian) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (!pembelian) {
            return res.status(404).json({ error: 'Pembelian tidak ditemukan atau sudah dibatalkan' });
        }

        // Update purchase status
        db.run(
            'UPDATE pembelian SET status = "cancelled", cancelled_at = CURRENT_TIMESTAMP WHERE id = ?',
            [id],
            (err) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                // Return stock
                db.run(
                    'UPDATE stock_produk SET jumlah_stock = jumlah_stock + ?, updated_at = CURRENT_TIMESTAMP WHERE produk_id = ?',
                    [pembelian.jumlah, pembelian.produk_id],
                    (err) => {
                        if (err) {
                            return res.status(500).json({ error: err.message });
                        }
                        res.json({ message: 'Pembelian berhasil dibatalkan' });
                    }
                );
            }
        );
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});