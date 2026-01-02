
### Project 1: Admin Page - Sistem Pembelian

# Masuk ke folder project
cd admin-pembelian

# Install dependencies
npm install

# Jalankan aplikasi
npm start

# Akses di browser
# http://localhost:3000
```

**Fitur:**
- ✅ Input data pembelian
- ✅ Cancel pembelian oleh admin
- ✅ Database Produk (10 produk default)
- ✅ Database Stock Produk
- ✅ Database Pembelian
- ✅ Stack: Node.js, Express.js, EJS, SQLite

### Admin Page - Sistem Pembelian

1. **Dashboard**: Lihat statistik total produk, stock, dan pembelian
2. **Produk**: Lihat daftar produk dengan informasi stock
3. **Pembelian**: 
   - Klik "Buat Pembelian Baru"
   - Pilih produk dari dropdown
   - Masukkan jumlah
   - Sistem akan otomatis validasi stock
   - Klik "Simpan Pembelian"
4. **Cancel Pembelian**:
   - Di halaman pembelian, klik tombol "Cancel"
   - Stock akan otomatis dikembalikan
