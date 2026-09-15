// ===================== DATA & STORAGE =====================
const STORAGE_KEYS = {
  products: 'kb_products',
  currentSales: 'kb_current_sales',
  archived: 'kb_archived_sales',
  cash: 'kb_cash'
};

function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || null;
  } catch {
    return null;
  }
}

function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatRp(num) {
  return 'Rp ' + (num || 0).toLocaleString('id-ID');
}

function getCurrentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(ym) {
  if (!ym) return '-';
  const [y, m] = ym.split('-');
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return `${bulan[parseInt(m) - 1]} ${y}`;
}

// ===================== STATE =====================
let products = load(STORAGE_KEYS.products) || [];
let currentSales = load(STORAGE_KEYS.currentSales) || { yearMonth: getCurrentYearMonth(), entries: [] };
let archived = load(STORAGE_KEYS.archived) || {};
let cash = load(STORAGE_KEYS.cash) || [];

let selectedProductForSale = null;
let productToDelete = null;

// Auto archive if month changed
function checkMonthChange() {
  const nowYM = getCurrentYearMonth();
  if (currentSales.yearMonth !== nowYM) {
    if (currentSales.entries.length > 0) {
      archived[currentSales.yearMonth] = {
        entries: [...currentSales.entries],
        totals: calculateMonthTotals(currentSales.entries)
      };
      save(STORAGE_KEYS.archived, archived);
    }
    currentSales = { yearMonth: nowYM, entries: [] };
    save(STORAGE_KEYS.currentSales, currentSales);
  }
}

function calculateMonthTotals(entries) {
  let kotor = 0, modal = 0, profit = 0, qty = 0, potongan = 0;
  entries.forEach(e => {
    kotor += e.totalJual;
    modal += e.totalHPP;
    profit += e.totalProfit;
    qty += e.qty;
    potongan += (e.potongan || 0) * (e.qty || 1);
  });
  return { kotor, modal, profit, qty, potongan };
}

function getAllSalesTotals() {
  const allMonths = { ...archived };
  if (currentSales.entries.length > 0) {
    allMonths[currentSales.yearMonth] = {
      entries: currentSales.entries,
      totals: calculateMonthTotals(currentSales.entries)
    };
  }

  let totalModal = 0, totalProfit = 0, totalPotongan = 0, totalKotor = 0;
  Object.values(allMonths).forEach(m => {
    totalModal += m.totals.modal || 0;
    totalProfit += m.totals.profit || 0;
    totalPotongan += m.totals.potongan || 0;
    totalKotor += m.totals.kotor || 0;
  });
  return { totalModal, totalProfit, totalPotongan, totalKotor };
}

function calculateCash() {
  let masuk = 0, keluar = 0;
  cash.forEach(c => {
    if (c.type === 'masuk') masuk += c.amount;
    else keluar += c.amount;
  });
  return { masuk, keluar, saldo: masuk - keluar };
}

// ===================== TOAST =====================
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ===================== NAVIGATION =====================
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.menu-section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('menu-' + btn.dataset.menu).classList.add('active');

    if (btn.dataset.menu === 'komponen') renderProdukList();
    if (btn.dataset.menu === 'penjualan') {
      checkMonthChange();
      renderPenjualan();
    }
    if (btn.dataset.menu === 'rekap-penjualan') renderRekapPenjualan();
    if (btn.dataset.menu === 'profit-modal') renderProfitModal();
    if (btn.dataset.menu === 'keuangan') renderKeuangan();
  });
});

// Tabs in Komponen
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'daftar-produk') renderProdukList();
  });
});

// ===================== MENU 1: KOMPONEN =====================
const bahanListEl = document.getElementById('bahan-list');

function addBahanRow(nama = '', harga = '', qty = '') {
  const row = document.createElement('div');
  row.className = 'bahan-row';
  row.innerHTML = `
    <input type="text" class="bahan-nama" placeholder="Nama bahan" value="${nama}" required />
    <input type="number" class="bahan-harga" placeholder="Harga" min="0" value="${harga}" required />
    <input type="number" class="bahan-qty" placeholder="QTY" min="0" step="0.01" value="${qty}" required />
    <button type="button" class="btn-remove-bahan" title="Hapus">×</button>
  `;
  row.querySelector('.btn-remove-bahan').addEventListener('click', () => {
    row.remove();
    updatePreviewHarga();
  });
  row.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', updatePreviewHarga);
  });
  bahanListEl.appendChild(row);
  updatePreviewHarga();
}

document.getElementById('btn-tambah-bahan').addEventListener('click', () => addBahanRow());

function updatePreviewHarga() {
  let totalHPP = 0;
  document.querySelectorAll('.bahan-row').forEach(row => {
    const harga = parseFloat(row.querySelector('.bahan-harga').value) || 0;
    const qty = parseFloat(row.querySelector('.bahan-qty').value) || 0;
    totalHPP += harga * qty;
  });

  const markupInput = document.getElementById('markup-persen');
  const markup = markupInput ? (parseFloat(markupInput.value) || 0) : 100;
  const hargaJual = totalHPP * (1 + markup / 100);

  document.getElementById('preview-hpp').textContent = formatRp(totalHPP);
  document.getElementById('preview-jual').textContent = formatRp(hargaJual);
}

const markupEl = document.getElementById('markup-persen');
if (markupEl) {
  markupEl.addEventListener('input', updatePreviewHarga);
}

addBahanRow();

document.getElementById('form-produk').addEventListener('submit', (e) => {
  e.preventDefault();
  const nama = document.getElementById('nama-produk').value.trim();
  const sku = document.getElementById('sku-produk').value.trim().toUpperCase();

  if (!nama || !sku) {
    showToast('Nama dan SKU wajib diisi', true);
    return;
  }

  if (products.some(p => p.sku === sku)) {
    showToast('SKU sudah digunakan', true);
    return;
  }

  const bahan = [];
  let totalHPP = 0;
  let valid = true;

  document.querySelectorAll('.bahan-row').forEach(row => {
    const n = row.querySelector('.bahan-nama').value.trim();
    const h = parseFloat(row.querySelector('.bahan-harga').value) || 0;
    const q = parseFloat(row.querySelector('.bahan-qty').value) || 0;
    if (!n || h < 0 || q <= 0) {
      valid = false;
    } else {
      bahan.push({ nama: n, harga: h, qty: q });
      totalHPP += h * q;
    }
  });

  if (!valid || bahan.length === 0) {
    showToast('Isi bahan baku dengan lengkap (nama, harga, qty > 0)', true);
    return;
  }

  const markup = parseFloat(document.getElementById('markup-persen').value) || 0;
  const hargaJual = totalHPP * (1 + markup / 100);

  if (hargaJual <= 0) {
    showToast('Harga jual harus lebih dari 0', true);
    return;
  }

  const product = {
    id: generateId(),
    nama,
    sku,
    bahan,
    hpp: totalHPP,
    markup: markup,
    hargaJual: hargaJual,
    createdAt: new Date().toISOString()
  };

  products.push(product);
  save(STORAGE_KEYS.products, products);
  showToast('Produk berhasil disimpan!');
  resetFormProduk();
});

function resetFormProduk() {
  document.getElementById('form-produk').reset();
  bahanListEl.innerHTML = '';
  addBahanRow();
  const markupInput = document.getElementById('markup-persen');
  if (markupInput) markupInput.value = 100;
  updatePreviewHarga();
}

document.getElementById('btn-reset-form').addEventListener('click', resetFormProduk);

function renderProdukList(filter = '') {
  const container = document.getElementById('produk-list');
  const q = filter.toLowerCase().trim();
  const filtered = products.filter(p =>
    p.nama.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
  );

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>${products.length === 0 ? 'Belum ada produk. Tambah dulu di tab "Tambah Produk".' : 'Tidak ditemukan.'}</p></div>`;
    return;
  }

  container.innerHTML = filtered.map(p => `
    <div class="produk-item">
      <div class="produk-info">
        <h4>${p.nama}</h4>
        <div class="sku">SKU: ${p.sku}</div>
        <div class="bahan-preview">
          Bahan: ${p.bahan.map(b => `${b.nama} (${b.qty}×${formatRp(b.harga)})`).join(', ')}
        </div>
        <div class="bahan-preview" style="margin-top:4px">
          Markup: ${p.markup !== undefined ? p.markup + '%' : '-'}
        </div>
      </div>
      <div class="produk-harga">
        <div class="hpp">HPP: ${formatRp(p.hpp)}</div>
        <div class="jual">${formatRp(p.hargaJual)}</div>
      </div>
      <div class="produk-actions">
        <button class="btn btn-sm btn-danger" onclick="openHapusModal('${p.id}')">Hapus</button>
      </div>
    </div>
  `).join('');
}

document.getElementById('search-produk').addEventListener('input', (e) => {
  renderProdukList(e.target.value);
});

function openHapusModal(id) {
  productToDelete = products.find(p => p.id === id);
  if (!productToDelete) return;
  document.getElementById('hapus-nama-produk').textContent = productToDelete.nama + ' (' + productToDelete.sku + ')';
  document.getElementById('modal-hapus').classList.add('show');
}

document.getElementById('btn-confirm-hapus').addEventListener('click', () => {
  if (!productToDelete) return;
  products = products.filter(p => p.id !== productToDelete.id);
  save(STORAGE_KEYS.products, products);
  productToDelete = null;
  document.getElementById('modal-hapus').classList.remove('show');
  renderProdukList(document.getElementById('search-produk').value);
  showToast('Produk berhasil dihapus');
});

document.getElementById('btn-batal-hapus').addEventListener('click', () => {
  productToDelete = null;
  document.getElementById('modal-hapus').classList.remove('show');
});

// ===================== MENU 2: PENJUALAN =====================
function renderPenjualan() {
  checkMonthChange();

  document.getElementById('label-bulan').textContent = getMonthLabel(currentSales.yearMonth);

  const totals = calculateMonthTotals(currentSales.entries);
  document.getElementById('total-kotor-bulan').textContent = formatRp(totals.kotor);
  document.getElementById('total-qty-bulan').textContent = totals.qty;

  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('tanggal-jual').value = today;

  const list = document.getElementById('riwayat-penjualan');
  if (currentSales.entries.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>Belum ada penjualan bulan ini.</p></div>';
    return;
  }

  const sorted = [...currentSales.entries].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  list.innerHTML = sorted.map(e => `
    <div class="riwayat-item">
      <div class="left">
        <span class="tanggal">${e.date}</span>
        <span class="nama">${e.nama} <small style="color:var(--text-muted)">(${e.sku})</small></span>
        <small style="color:var(--text-muted)">
          Harga Akhir: ${formatRp(e.hargaAkhir || e.hargaJual)}
          ${e.potongan > 0 ? ` | Potongan: ${formatRp(e.potongan)}` : ''}
        </small>
      </div>
      <div class="right" style="display:flex; align-items:center; gap:8px;">
        <div>
          <div class="qty">${e.qty} pcs</div>
          <div class="total">${formatRp(e.totalJual)}</div>
        </div>
        <button class="btn-hapus-item" onclick="hapusPenjualan('${e.id}')">Hapus</button>
      </div>
    </div>
  `).join('');
}

function hapusPenjualan(id) {
  if (!confirm('Yakin ingin menghapus transaksi ini?')) return;

  currentSales.entries = currentSales.entries.filter(e => e.id !== id);
  save(STORAGE_KEYS.currentSales, currentSales);
  showToast('Transaksi berhasil dihapus');
  renderPenjualan();
}

function hitungPotongan() {
  if (!selectedProductForSale) return;

  const hargaJual = selectedProductForSale.hargaJual;
  const hargaAkhir = parseFloat(document.getElementById('harga-akhir').value) || 0;
  const potongan = Math.max(0, hargaJual - hargaAkhir);

  document.getElementById('potongan').value = formatRp(potongan);
}

document.getElementById('harga-akhir')?.addEventListener('input', hitungPotongan);

const cariInput = document.getElementById('cari-produk-jual');
const hasilCari = document.getElementById('hasil-cari-produk');

cariInput.addEventListener('input', () => {
  const q = cariInput.value.toLowerCase().trim();
  if (q.length < 1) {
    hasilCari.classList.remove('show');
    return;
  }
  const found = products.filter(p =>
    p.nama.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
  ).slice(0, 8);

  if (found.length === 0) {
    hasilCari.innerHTML = '<div class="dropdown-item">Tidak ditemukan</div>';
  } else {
    hasilCari.innerHTML = found.map(p => `
      <div class="dropdown-item" data-id="${p.id}">
        <strong>${p.nama}</strong> <small>(${p.sku})</small><br>
        <small>Jual: ${formatRp(p.hargaJual)} | HPP: ${formatRp(p.hpp)}</small>
      </div>
    `).join('');
  }
  hasilCari.classList.add('show');
});

hasilCari.addEventListener('click', (e) => {
  const item = e.target.closest('.dropdown-item');
  if (!item || !item.dataset.id) return;
  const p = products.find(x => x.id === item.dataset.id);
  if (!p) return;

  selectedProductForSale = p;

  document.getElementById('produk-terpilih').style.display = 'flex';
  document.getElementById('pilih-nama').textContent = p.nama;
  document.getElementById('pilih-sku').textContent = 'SKU: ' + p.sku;
  document.getElementById('pilih-jual').textContent = formatRp(p.hargaJual);
  document.getElementById('pilih-hpp').textContent = formatRp(p.hpp);

  document.getElementById('harga-akhir-section').style.display = 'block';
  document.getElementById('harga-akhir').value = p.hargaJual;
  document.getElementById('potongan').value = formatRp(0);

  document.getElementById('btn-simpan-jual').disabled = false;
  cariInput.value = p.nama;
  hasilCari.classList.remove('show');

  hitungPotongan();
});

document.addEventListener('click', (e) => {
  if (!cariInput.contains(e.target) && !hasilCari.contains(e.target)) {
    hasilCari.classList.remove('show');
  }
});

document.getElementById('form-penjualan').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!selectedProductForSale) {
    showToast('Pilih produk dulu', true);
    return;
  }

  const tanggal = document.getElementById('tanggal-jual').value;
  const qty = parseInt(document.getElementById('qty-jual').value) || 0;
  const hargaAkhir = parseFloat(document.getElementById('harga-akhir').value) || 0;

  if (!tanggal || qty < 1) {
    showToast('Tanggal dan qty wajib diisi', true);
    return;
  }

  if (hargaAkhir <= 0) {
    showToast('Harga akhir harus diisi', true);
    return;
  }

  const entryYM = tanggal.slice(0, 7);
  if (entryYM !== currentSales.yearMonth) {
    showToast('Tanggal harus dalam bulan berjalan (' + getMonthLabel(currentSales.yearMonth) + ')', true);
    return;
  }

  const potongan = selectedProductForSale.hargaJual - hargaAkhir;

  const entry = {
    id: generateId(),
    date: tanggal,
    productId: selectedProductForSale.id,
    nama: selectedProductForSale.nama,
    sku: selectedProductForSale.sku,
    qty,
    hargaJual: selectedProductForSale.hargaJual,
    hargaAkhir: hargaAkhir,
    potongan: potongan,
    hpp: selectedProductForSale.hpp,
    totalJual: hargaAkhir * qty,
    totalHPP: selectedProductForSale.hpp * qty,
    totalProfit: (hargaAkhir - selectedProductForSale.hpp) * qty
  };

  currentSales.entries.push(entry);
  save(STORAGE_KEYS.currentSales, currentSales);

  selectedProductForSale = null;
  document.getElementById('produk-terpilih').style.display = 'none';
  document.getElementById('harga-akhir-section').style.display = 'none';
  document.getElementById('cari-produk-jual').value = '';
  document.getElementById('qty-jual').value = 1;
  document.getElementById('harga-akhir').value = '';
  document.getElementById('potongan').value = '';
  document.getElementById('btn-simpan-jual').disabled = true;

  showToast('Penjualan berhasil dicatat!');
  renderPenjualan();
});

// ===================== MENU 3: REKAP PENJUALAN =====================
function renderRekapPenjualan() {
  checkMonthChange();

  const select = document.getElementById('select-bulan-rekap');
  const months = Object.keys(archived).sort().reverse();

  if (currentSales.entries.length > 0 && !months.includes(currentSales.yearMonth)) {
    months.unshift(currentSales.yearMonth);
  }

  select.innerHTML = '<option value="">-- Pilih Bulan --</option>' +
    months.map(m => `<option value="${m}">${getMonthLabel(m)}</option>`).join('');

  document.getElementById('detail-rekap-bulan').style.display = 'none';
  document.getElementById('empty-rekap').style.display = months.length === 0 ? 'block' : 'none';

  select.onchange = () => {
    const ym = select.value;
    if (!ym) {
      document.getElementById('detail-rekap-bulan').style.display = 'none';
      return;
    }

    let data;
    if (ym === currentSales.yearMonth) {
      data = {
        entries: currentSales.entries,
        totals: calculateMonthTotals(currentSales.entries)
      };
    } else {
      data = archived[ym];
    }

    if (!data) return;

    document.getElementById('rekap-kotor').textContent = formatRp(data.totals.kotor);
    document.getElementById('rekap-modal').textContent = formatRp(data.totals.modal);
    document.getElementById('rekap-profit').textContent = formatRp(data.totals.profit);

    const table = document.getElementById('detail-transaksi-rekap');
    if (data.entries.length === 0) {
      table.innerHTML = '<p class="empty-state">Tidak ada transaksi.</p>';
    } else {
      const sorted = [...data.entries].sort((a, b) => a.date.localeCompare(b.date));
      table.innerHTML = `
        <table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Produk</th>
              <th>Qty</th>
              <th>Harga Akhir</th>
              <th>Penjualan</th>
              <th>Modal (HPP)</th>
              <th>Profit</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map(e => `
              <tr>
                <td>${e.date}</td>
                <td>${e.nama}<br><small style="color:var(--text-muted)">${e.sku}</small></td>
                <td>${e.qty}</td>
                <td>${formatRp(e.hargaAkhir || e.hargaJual)}</td>
                <td>${formatRp(e.totalJual)}</td>
                <td>${formatRp(e.totalHPP)}</td>
                <td><strong>${formatRp(e.totalProfit)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    document.getElementById('detail-rekap-bulan').style.display = 'block';
    document.getElementById('empty-rekap').style.display = 'none';
  };
}

document.getElementById('btn-hapus-bulan')?.addEventListener('click', () => {
  const select = document.getElementById('select-bulan-rekap');
  const ym = select.value;
  if (!ym) {
    showToast('Pilih bulan dulu', true);
    return;
  }

  if (!confirm(`Yakin ingin menghapus SEMUA data penjualan bulan ${getMonthLabel(ym)}?\nTindakan ini tidak bisa dibatalkan.`)) return;

  if (ym === currentSales.yearMonth) {
    currentSales.entries = [];
    save(STORAGE_KEYS.currentSales, currentSales);
  } else {
    delete archived[ym];
    save(STORAGE_KEYS.archived, archived);
  }

  showToast('Data bulan berhasil dihapus');
  renderRekapPenjualan();
  renderProfitModal();
});

// ===================== MENU 4: PROFIT & MODAL =====================
function renderProfitModal() {
  checkMonthChange();

  const { totalModal, totalProfit } = getAllSalesTotals();

  document.getElementById('total-modal-aman').textContent = formatRp(totalModal);
  document.getElementById('total-keuntungan').textContent = formatRp(totalProfit);

  const allMonths = { ...archived };
  if (currentSales.entries.length > 0) {
    allMonths[currentSales.yearMonth] = {
      entries: currentSales.entries,
      totals: calculateMonthTotals(currentSales.entries)
    };
  }

  const rows = Object.keys(allMonths).sort().reverse().map(ym => {
    const t = allMonths[ym].totals;
    return `
      <tr>
        <td>${getMonthLabel(ym)}</td>
        <td>${formatRp(t.kotor)}</td>
        <td>${formatRp(t.modal)}</td>
        <td><strong>${formatRp(t.profit)}</strong></td>
      </tr>
    `;
  });

  const table = document.getElementById('tabel-profit-modal');
  if (rows.length === 0) {
    table.innerHTML = '<div class="empty-state"><p>Belum ada data penjualan.</p></div>';
  } else {
    table.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Bulan</th>
            <th>Penjualan Kotor</th>
            <th>Modal (HPP)</th>
            <th>Keuntungan</th>
          </tr>
        </thead>
        <tbody>
          ${rows.join('')}
          <tr style="border-top: 2px solid var(--border);">
            <td><strong>TOTAL</strong></td>
            <td><strong>${formatRp(totalModal + totalProfit)}</strong></td>
            <td><strong style="color:var(--blue)">${formatRp(totalModal)}</strong></td>
            <td><strong style="color:var(--orange)">${formatRp(totalProfit)}</strong></td>
          </tr>
        </tbody>
      </table>
    `;
  }
}

document.getElementById('btn-reset-semua')?.addEventListener('click', () => {
  if (!confirm('PERINGATAN!\n\nIni akan menghapus SEMUA data penjualan (semua bulan).\nData produk dan kas tidak akan terhapus.\n\nYakin ingin melanjutkan?')) return;

  currentSales = { yearMonth: getCurrentYearMonth(), entries: [] };
  archived = {};
  save(STORAGE_KEYS.currentSales, currentSales);
  save(STORAGE_KEYS.archived, archived);

  showToast('Semua data penjualan berhasil direset');
  renderPenjualan();
  renderRekapPenjualan();
  renderProfitModal();
  renderKeuangan();
});

// ===================== MENU 5: KEUANGAN SAAT INI =====================
function renderKeuangan() {
  const { masuk, keluar, saldo } = calculateCash();
  const { totalModal, totalProfit, totalPotongan } = getAllSalesTotals();

  document.getElementById('saldo-saat-ini').textContent = formatRp(saldo);
  document.getElementById('total-masuk').textContent = formatRp(masuk);
  document.getElementById('total-keluar').textContent = formatRp(keluar);

  document.getElementById('fin-total-modal').textContent = formatRp(totalModal);
  document.getElementById('fin-total-profit').textContent = formatRp(totalProfit);
  document.getElementById('fin-total-potongan').textContent = formatRp(totalPotongan);
  document.getElementById('fin-saldo-aktual').textContent = formatRp(saldo);

  // Set default date
  document.getElementById('tanggal-kas').value = new Date().toISOString().slice(0, 10);

  // Render riwayat kas
  const list = document.getElementById('riwayat-kas');
  if (cash.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>Belum ada catatan kas.</p></div>';
    return;
  }

  const sorted = [...cash].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  list.innerHTML = sorted.map(c => `
    <div class="riwayat-item">
      <div class="left">
        <span class="tanggal">${c.date}</span>
        <span class="nama">${c.keterangan}</span>
        <small style="color:${c.type === 'masuk' ? 'var(--green)' : 'var(--orange)'}">
          ${c.type === 'masuk' ? 'Uang Masuk' : 'Uang Keluar'}
        </small>
      </div>
      <div class="right" style="display:flex; align-items:center; gap:8px;">
        <div class="total" style="color:${c.type === 'masuk' ? 'var(--green)' : 'var(--orange)'}">
          ${c.type === 'masuk' ? '+' : '-'} ${formatRp(c.amount)}
        </div>
        <button class="btn-hapus-item" onclick="hapusKas('${c.id}')">Hapus</button>
      </div>
    </div>
  `).join('');
}

function hapusKas(id) {
  if (!confirm('Yakin ingin menghapus catatan kas ini?')) return;
  cash = cash.filter(c => c.id !== id);
  save(STORAGE_KEYS.cash, cash);
  showToast('Catatan kas berhasil dihapus');
  renderKeuangan();
}

document.getElementById('form-kas')?.addEventListener('submit', (e) => {
  e.preventDefault();

  const tanggal = document.getElementById('tanggal-kas').value;
  const tipe = document.getElementById('tipe-kas').value;
  const keterangan = document.getElementById('keterangan-kas').value.trim();
  const nominal = parseFloat(document.getElementById('nominal-kas').value) || 0;

  if (!tanggal || !keterangan || nominal <= 0) {
    showToast('Lengkapi semua data', true);
    return;
  }

  cash.push({
    id: generateId(),
    date: tanggal,
    type: tipe,
    keterangan,
    amount: nominal
  });

  save(STORAGE_KEYS.cash, cash);
  showToast('Catatan kas berhasil disimpan');

  document.getElementById('form-kas').reset();
  document.getElementById('tanggal-kas').value = new Date().toISOString().slice(0, 10);
  renderKeuangan();
});

// ===================== INIT =====================
checkMonthChange();
renderProdukList();
renderPenjualan();
renderRekapPenjualan();
renderProfitModal();
renderKeuangan();
