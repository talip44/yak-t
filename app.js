/**
 * app.js - Uygulama Mantığı ve UI Kontrolü
 * Akaryakıt Takip Sistemi - Güncellenmiş Tam Sürüm
 */

// Global Değişkenler
var currentEditId = null;
var charts = {};

// Giriş Bilgileri (Kullanıcı Talebi)
var ADMIN_USER = '4358156';
var ADMIN_PASS = 'Ankara15+';

// ========================
// OTURUM YÖNETİMİ
// ========================
async function checkAuth() {
    console.log("checkAuth() çağrıldı...");
    try {
        var session = sessionStorage.getItem('akaryakit_auth');
        if (session === 'true') {
            document.getElementById('loginPage').classList.remove('active');
            document.getElementById('mainApp').classList.add('active');
            await initApp();
        } else {
            document.getElementById('loginPage').classList.add('active');
            document.getElementById('mainApp').classList.remove('active');
        }
    } catch (e) {
        console.error("checkAuth hatası:", e);
    }
}

function doLogin() {
    var user = document.getElementById('loginUser').value;
    var pass = document.getElementById('loginPass').value;
    var errorMsg = document.getElementById('loginError');

    if (user === ADMIN_USER && pass === ADMIN_PASS) {
        sessionStorage.setItem('akaryakit_auth', 'true');
        errorMsg.classList.add('hidden');
        checkAuth();
        showToast('Başarıyla giriş yapıldı.', 'success');
    } else {
        errorMsg.classList.remove('hidden');
        showToast('Giriş başarısız!', 'error');
    }
}

function doLogout() {
    if (confirm('Çıkış yapmak istediğinize emin misiniz?')) {
        sessionStorage.removeItem('akaryakit_auth');
        checkAuth();
    }
}

function togglePass() {
    var passInput = document.getElementById('loginPass');
    var eyeIcon = document.getElementById('eyeIcon');
    if (passInput.type === 'password') {
        passInput.type = 'text';
        eyeIcon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        passInput.type = 'password';
        eyeIcon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

// ========================
// NAVİGASYON
// ========================
async function showSection(sectionId) {
    console.log("Seksiyon değişiyor: ", sectionId);
    document.querySelectorAll('.menu-item').forEach(function (item) {
        item.classList.remove('active');
        var clickAttr = item.getAttribute('onclick') || '';
        if (clickAttr.includes("'" + sectionId + "'")) {
            item.classList.add('active');
        }
    });

    document.querySelectorAll('.content-section').forEach(function (sec) { sec.classList.remove('active'); });
    var targetSec = document.getElementById('sec-' + sectionId);
    if (targetSec) targetSec.classList.add('active');

    var titles = {
        'kayit': 'Yeni Kayıt',
        'defterler': 'Kayıt Defteri',
        'sorgula': 'Sorgulama',
        'raporlar': 'Aylık Raporlar',
        'istatistik': 'İstatistikler',
        'indir': 'Excel İndir'
    };
    document.getElementById('pageTitle').innerText = titles[sectionId] || 'Panel';

    try {
        if (sectionId === 'defterler') await renderDefter();
        if (sectionId === 'raporlar') await renderRaporlar();
        if (sectionId === 'istatistik') await renderIstatistikler();
        if (sectionId === 'kayit') await renderRecent();
    } catch (e) {
        console.error("Seksiyon yükleme hatası:", e);
    }

    if (window.innerWidth <= 768) {
        var sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('mobile-open');
    }
}

function toggleSidebar() {
    var sidebar = document.getElementById('sidebar');
    var mainContent = document.getElementById('mainContent');
    if (!sidebar || !mainContent) return;

    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('mobile-open');
        sidebar.classList.remove('collapsed');
    } else {
        sidebar.classList.toggle('collapsed');
        sidebar.classList.remove('mobile-open');

        if (sidebar.classList.contains('collapsed')) {
            mainContent.style.marginLeft = '0';
        } else {
            mainContent.style.marginLeft = 'var(--sidebar-w)';
        }
    }
}

// ========================
// VERİ GİRİŞİ (KAYIT)
// ========================
async function kayitEkle() {
    if (typeof DB === 'undefined') { showToast('Hata: Veritabanı modülü yüklenemedi!', 'error'); return; }

    var data = {
        tarih: document.getElementById('f_tarih').value,
        birim: document.getElementById('f_birim').value,
        plaka: document.getElementById('f_plaka').value.toUpperCase(),
        marka: document.getElementById('f_marka').value,
        km: document.getElementById('f_km').value,
        benzin: parseFloat(document.getElementById('f_benzin').value || 0),
        motorin: parseFloat(document.getElementById('f_motorin').value || 0),
        adsoyad: document.getElementById('f_adsoyad').value,
        pbik: document.getElementById('f_pbik').value.trim().toUpperCase()
    };

    if (!data.tarih || !data.plaka || (!data.benzin && !data.motorin)) {
        showToast('Lütfen tarih, plaka ve yakıt miktarını doldurun!', 'error');
        return;
    }

    try {
        var success = await DB.add(data);
        if (success) {
            showToast('Kayıt başarıyla eklendi.', 'success');
            formTemizle();
        } else {
            showToast('Kayıt yerel olarak eklendi fakat bulut senkronizasyonu başarısız!', 'warning');
            formTemizle();
        }
        await renderRecent();
        await updateBadges();
        await updateDatalists();
    } catch (e) {
        console.error("Kayit ekleme hatası:", e);
        showToast('Kayıt eklenirken hata oluştu!', 'error');
    }
}

function formTemizle() {
    var inputs = ['f_birim', 'f_plaka', 'f_marka', 'f_km', 'f_benzin', 'f_motorin', 'f_adsoyad', 'f_pbik'];
    inputs.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });

    var dateInput = document.getElementById('f_tarih');
    if (dateInput) {
        var now = new Date();
        var year = now.getFullYear();
        var month = String(now.getMonth() + 1).padStart(2, '0');
        var day = String(now.getDate()).padStart(2, '0');
        dateInput.value = year + "-" + month + "-" + day;
    }
}

async function renderRecent() {
    if (typeof DB === 'undefined') return;
    try {
        var all = await DB.getAll();
        var sortedAll = (all || []).sort((a, b) => new Date(b.tarih) - new Date(a.tarih));
        var kayitlar = sortedAll.slice(0, 5);
        
        var tbody = document.getElementById('recentBody');
        if (!tbody) return;
        tbody.innerHTML = kayitlar.map(function (k) {
            return '<tr>' +
                '<td>' + formatDate(k.tarih) + '</td>' +
                '<td>' + (k.birim || '') + '</td>' +
                '<td><strong>' + (k.plaka || '') + '</strong></td>' +
                '<td>' + (k.marka || '') + '</td>' +
                '<td>' + (k.km || '') + '</td>' +
                '<td style="color:var(--amber)">' + (k.benzin || '0') + '</td>' +
                '<td style="color:var(--green)">' + (k.motorin || '0') + '</td>' +
                '<td>' + (k.adsoyad || '') + '</td>' +
                '<td>' + (k.pbik || '') + '</td>' +
                '</tr>';
        }).join('');
    } catch (e) {
        console.error("renderRecent hatası:", e);
    }
}

// ========================
// KAYIT DEFTERİ (LİSTELEME)
// ========================
async function renderDefter() {
    if (typeof DB === 'undefined') return;
    try {
        var kayitlar = await DB.getAll();
        kayitlar.sort((a, b) => new Date(b.tarih) - new Date(a.tarih));

        var fStart = document.getElementById('filterStart').value;
        var fEnd = document.getElementById('filterEnd').value;
        var fBirim = document.getElementById('filterBirim').value.toLowerCase();
        var fYakit = document.getElementById('filterYakit').value;

        if (fStart) kayitlar = kayitlar.filter(function (k) { return k.tarih >= fStart; });
        if (fEnd) kayitlar = kayitlar.filter(function (k) { return k.tarih <= fEnd; });
        if (fBirim) kayitlar = kayitlar.filter(function (k) { return (k.birim || '').toLowerCase().includes(fBirim); });
        if (fYakit === 'benzin') kayitlar = kayitlar.filter(function (k) { return parseFloat(k.benzin) > 0; });
        if (fYakit === 'motorin') kayitlar = kayitlar.filter(function (k) { return parseFloat(k.motorin) > 0; });

        var tbody = document.getElementById('defterBody');
        var noRec = document.getElementById('noRecord');
        if (!tbody) return;

        if (kayitlar.length === 0) {
            tbody.innerHTML = '';
            if (noRec) noRec.classList.remove('hidden');
        } else {
            if (noRec) noRec.classList.add('hidden');
            tbody.innerHTML = kayitlar.map(function (k, i) {
                return '<tr>' +
                    '<td>' + (i + 1) + '</td>' +
                    '<td>' + formatDate(k.tarih) + '</td>' +
                    '<td>' + (k.birim || '') + '</td>' +
                    '<td><strong>' + (k.plaka || '') + '</strong></td>' +
                    '<td>' + (k.marka || '') + '</td>' +
                    '<td>' + (k.km || '') + '</td>' +
                    '<td style="color:var(--amber)">' + (k.benzin || '0') + '</td>' +
                    '<td style="color:var(--green)">' + (k.motorin || '0') + '</td>' +
                    '<td>' + (k.adsoyad || '') + '</td>' +
                    '<td>' + (k.pbik || '') + '</td>' +
                    '<td>' +
                    '<button class="btn-edit" onclick="openEditModal(\'' + k.id + '\')"><i class="fas fa-edit"></i></button>' +
                    '<button class="btn-del" onclick="silKayit(\'' + k.id + '\')"><i class="fas fa-trash"></i></button>' +
                    '</td>' +
                    '</tr>';
            }).join('');
        }

        var stats = DB.summary(kayitlar);
        document.getElementById('totalBenzin').innerText = stats.benzin.toFixed(2);
        document.getElementById('totalMotorin').innerText = stats.motorin.toFixed(2);
        document.getElementById('totalCount').innerText = stats.count;
    } catch (e) {
        console.error("renderDefter hatası:", e);
    }
}

function clearFilters() {
    document.getElementById('filterStart').value = '';
    document.getElementById('filterEnd').value = '';
    document.getElementById('filterBirim').value = '';
    document.getElementById('filterYakit').value = '';
    renderDefter();
}

// ========================
// SORGULAMA
// ========================
function switchQueryTab(tab, el) {
    document.querySelectorAll('.qtab').forEach(function (t) { t.classList.remove('active'); });
    el.classList.add('active');
    document.getElementById('queryPlaka').classList.toggle('hidden', tab !== 'plaka');
    document.getElementById('queryBirim').classList.toggle('hidden', tab !== 'birlik');
}

async function sorgulaPlaka() {
    if (typeof DB === 'undefined') return;
    var plaka = document.getElementById('qPlaka').value;
    if (!plaka) return;
    var sonuclar = await DB.filterByPlaka(plaka);
    var resultDiv = document.getElementById('plakaResult');

    if (sonuclar.length === 0) {
        resultDiv.innerHTML = '<p class="no-record">Plaka bulunamadı.</p>';
        return;
    }

    var s = DB.summary(sonuclar);
    resultDiv.innerHTML = '<div class="query-result-card">' +
        '<div class="result-header">' +
        '<div class="result-plaka-badge">' + plaka.toUpperCase() + '</div>' +
        '<div><strong>' + (sonuclar[0].marka || '') + '</strong></div>' +
        '</div>' +
        '<div class="result-stats">' +
        '<div class="rstat"><div class="rstat-label">Toplam Benzin</div><div class="rstat-val benzin">' + s.benzin.toFixed(2) + ' Lt</div></div>' +
        '<div class="rstat"><div class="rstat-label">Toplam Motorin</div><div class="rstat-val motorin">' + s.motorin.toFixed(2) + ' Lt</div></div>' +
        '<div class="rstat"><div class="rstat-label">Kayıt Sayısı</div><div class="rstat-val">' + s.count + '</div></div>' +
        '</div>' +
        '<div class="table-wrapper">' +
        '<table class="data-table">' +
        '<thead><tr><th>Tarih</th><th>Birim</th><th>KM</th><th>Benzin</th><th>Motorin</th></tr></thead>' +
        '<tbody>' + sonuclar.map(function (k) { return '<tr><td>' + formatDate(k.tarih) + '</td><td>' + k.birim + '</td><td>' + k.km + '</td><td>' + k.benzin + '</td><td>' + k.motorin + '</td></tr>'; }).join('') + '</tbody>' +
        '</table>' +
        '</div>' +
        '</div>';
}

async function sorgulaBirim() {
    if (typeof DB === 'undefined') return;
    var birim = document.getElementById('qBirim').value;
    if (!birim) return;
    var sonuclar = await DB.filterByBirim(birim);
    var resultDiv = document.getElementById('birlikResult');

    if (sonuclar.length === 0) {
        resultDiv.innerHTML = '<p class="no-record">Birim bulunamadı.</p>';
        return;
    }

    var s = DB.summary(sonuclar);
    resultDiv.innerHTML = '<div class="query-result-card">' +
        '<div class="result-header"><h3>' + birim.toUpperCase() + ' Raporu</h3></div>' +
        '<div class="result-stats">' +
        '<div class="rstat"><div class="rstat-label">Toplam Benzin</div><div class="rstat-val benzin">' + s.benzin.toFixed(2) + ' Lt</div></div>' +
        '<div class="rstat"><div class="rstat-label">Toplam Motorin</div><div class="rstat-val motorin">' + s.motorin.toFixed(2) + ' Lt</div></div>' +
        '<div class="rstat"><div class="rstat-label">Araç Sayısı</div><div class="rstat-val">' + new Set(sonuclar.map(function (x) { return x.plaka; })).size + '</div></div>' +
        '</div>' +
        '<div class="table-wrapper">' +
        '<table class="data-table">' +
        '<thead><tr><th>Tarih</th><th>Plaka</th><th>Benzin</th><th>Motorin</th><th>Ad Soyad</th></tr></thead>' +
        '<tbody>' + sonuclar.map(function (k) { return '<tr><td>' + formatDate(k.tarih) + '</td><td>' + k.plaka + '</td><td>' + k.benzin + '</td><td>' + k.motorin + '</td><td>' + k.adsoyad + '</td></tr>'; }).join('') + '</tbody>' +
        '</table>' +
        '</div>' +
        '</div>';
}

// ========================
// RAPORLAR & İSTATİSTİK
// ========================
async function renderRaporlar() {
    if (typeof DB === 'undefined') return;
    var yil = document.getElementById('raporYil').value;
    var ay = document.getElementById('raporAy').value;
    var kayitlar = await DB.filterByMonth(yil, ay);
    var birimBazli = DB.groupByBirim(kayitlar);

    var cardsDiv = document.getElementById('raporCards');
    var s = DB.summary(kayitlar);

    cardsDiv.innerHTML = '<div class="rapor-card">' +
        '<div class="rapor-card-icon" style="color:var(--amber)"><i class="fas fa-fire"></i></div>' +
        '<div class="rapor-card-title">Toplam Benzin</div>' +
        '<div class="rapor-card-val">' + s.benzin.toFixed(2) + '</div>' +
        '<div class="rapor-card-sub">Litre</div>' +
        '</div>' +
        '<div class="rapor-card">' +
        '<div class="rapor-card-icon" style="color:var(--green)"><i class="fas fa-oil-can"></i></div>' +
        '<div class="rapor-card-title">Toplam Motorin</div>' +
        '<div class="rapor-card-val">' + s.motorin.toFixed(2) + '</div>' +
        '<div class="rapor-card-sub">Litre</div>' +
        '</div>' +
        '<div class="rapor-card">' +
        '<div class="rapor-card-icon" style="color:var(--accent)"><i class="fas fa-car-side"></i></div>' +
        '<div class="rapor-card-title">Top. Araç Sayısı</div>' +
        '<div class="rapor-card-val">' + new Set(kayitlar.map(function (k) { return k.plaka; })).size + '</div>' +
        '<div class="rapor-card-sub">Ay İçinde</div>' +
        '</div>';

    var tbody = document.getElementById('raporBody');
    tbody.innerHTML = birimBazli.map(function (b) {
        return '<tr>' +
            '<td><strong>' + b.birim + '</strong></td>' +
            '<td>' + b.benzin.toFixed(2) + '</td>' +
            '<td>' + b.motorin.toFixed(2) + '</td>' +
            '<td><strong>' + (b.benzin + b.motorin).toFixed(2) + '</strong></td>' +
            '<td>' + b.count + '</td>' +
            '</tr>';
    }).join('');
}

async function renderIstatistikler() {
    if (typeof DB === 'undefined' || typeof Chart === 'undefined') return;
    var kayitlar = await DB.getAll();
    var ayBazli = DB.groupByMonth(kayitlar).slice(-6);
    var birimBazli = DB.groupByBirim(kayitlar).slice(0, 5);

    if (charts.aylik) charts.aylik.destroy();
    if (charts.birim) charts.birim.destroy();
    if (charts.karsilastirma) charts.karsilastirma.destroy();

    var ctxAylik = document.getElementById('chartAylik');
    if (ctxAylik) {
        charts.aylik = new Chart(ctxAylik, {
            type: 'line',
            data: {
                labels: ayBazli.map(function (a) { return a.ay; }),
                datasets: [
                    { label: 'Benzin', data: ayBazli.map(function (a) { return a.benzin; }), borderColor: '#f59e0b', tension: 0.3 },
                    { label: 'Motorin', data: ayBazli.map(function (a) { return a.motorin; }), borderColor: '#10b981', tension: 0.3 }
                ]
            },
            options: { responsive: true, plugins: { legend: { labels: { color: '#94a3b8' } } } }
        });
    }

    var ctxBirim = document.getElementById('chartBirim');
    if (ctxBirim) {
        charts.birim = new Chart(ctxBirim, {
            type: 'bar',
            data: {
                labels: birimBazli.map(function (b) { return b.birim; }),
                datasets: [{
                    label: 'Toplam Yakıt (Lt)',
                    data: birimBazli.map(function (b) { return b.benzin + b.motorin; }),
                    backgroundColor: '#6366f1'
                }]
            },
            options: { responsive: true }
        });
    }

    var ctxKars = document.getElementById('chartKarsilastirma');
    if (ctxKars) {
        charts.karsilastirma = new Chart(ctxKars, {
            type: 'doughnut',
            data: {
                labels: ['Benzin', 'Motorin'],
                datasets: [{
                    data: [DB.summary(kayitlar).benzin, DB.summary(kayitlar).motorin],
                    backgroundColor: ['#f59e0b', '#10b981'],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

// ========================
// EXCEL İŞLEMLERİ
// ========================
async function excelTumKayitlar() {
    if (typeof DB === 'undefined' || typeof XLSX === 'undefined') return;
    var data = await DB.getAll();
    var ws = XLSX.utils.json_to_sheet(data);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tüm Kayıtlar");
    XLSX.writeFile(wb, "akaryakit_tum_kayitlar.xlsx");
}

async function excelAyaBore() {
    if (typeof DB === 'undefined' || typeof XLSX === 'undefined') return;
    var yil = document.getElementById('dlYil').value;
    var ay = document.getElementById('dlAy').value;
    var data = await DB.filterByMonth(yil, ay);
    var ws = XLSX.utils.json_to_sheet(data);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, ay + "-" + yil);
    XLSX.writeFile(wb, "akaryakit_rapor_" + ay + "_" + yil + ".xlsx");
}

async function excelBirimBazli() {
    if (typeof DB === 'undefined' || typeof XLSX === 'undefined') return;
    var kayitlar = await DB.getAll();
    var wb = XLSX.utils.book_new();
    var birimler = Array.from(new Set(kayitlar.map(function (k) { return k.birim; })));

    birimler.forEach(function (b) {
        var bData = kayitlar.filter(function (k) { return k.birim === b; });
        var ws = XLSX.utils.json_to_sheet(bData);
        XLSX.utils.book_append_sheet(wb, ws, String(b).substring(0, 30));
    });

    XLSX.writeFile(wb, "akaryakit_birim_bazli.xlsx");
}

async function exportRaporExcel() {
    if (typeof DB === 'undefined' || typeof XLSX === 'undefined') return;
    var yil = document.getElementById('raporYil').value;
    var ay = document.getElementById('raporAy').value;
    var kayitlar = await DB.filterByMonth(yil, ay);
    var birimBazli = DB.groupByBirim(kayitlar);

    var ws = XLSX.utils.json_to_sheet(birimBazli);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Aylık Rapor");
    XLSX.writeFile(wb, "akaryakit_rapor_" + ay + "_" + yil + ".xlsx");
}

async function excelOzet() {
    if (typeof DB === 'undefined' || typeof XLSX === 'undefined') return;
    var data = DB.groupByBirim(await DB.getAll());
    var ws = XLSX.utils.json_to_sheet(data);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Özet Rapor");
    XLSX.writeFile(wb, "akaryakit_ozet_rapor.xlsx");
}

function handleImport(input) {
    if (typeof DB === 'undefined') return;
    var file = input.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function (e) {
        var content = e.target.result;
        if (DB.importBackup(content)) {
            showToast('Veriler başarıyla geri yüklendi.', 'success');
            setTimeout(function () { location.reload(); }, 1500);
        } else {
            showToast('Geçersiz yedek dosyası!', 'error');
        }
    };
    reader.readAsText(file);
}

// ========================
// MODAL & EDİT
// ========================
async function openEditModal(id) {
    if (typeof DB === 'undefined') return;
    try {
        var k = await DB.getById(id);
        if (!k) return;
        currentEditId = id;
        document.getElementById('e_tarih').value = k.tarih || '';
        document.getElementById('e_birim').value = k.birim || '';
        document.getElementById('e_plaka').value = k.plaka || '';
        document.getElementById('e_marka').value = k.marka || '';
        document.getElementById('e_km').value = k.km || '';
        document.getElementById('e_benzin').value = k.benzin || '';
        document.getElementById('e_motorin').value = k.motorin || '';
        document.getElementById('e_adsoyad').value = k.adsoyad || '';
        document.getElementById('e_pbik').value = k.pbik || '';
        document.getElementById('editModal').classList.remove('hidden');
    } catch (e) { console.error("Modal açma hatası:", e); }
}

function closeModal() {
    var modal = document.getElementById('editModal');
    if (modal) modal.classList.add('hidden');
    currentEditId = null;
}

async function kayitGuncelle() {
    if (typeof DB === 'undefined') return;
    var data = {
        tarih: document.getElementById('e_tarih').value,
        birim: document.getElementById('e_birim').value,
        plaka: document.getElementById('e_plaka').value.toUpperCase(),
        marka: document.getElementById('e_marka').value,
        km: document.getElementById('e_km').value,
        benzin: document.getElementById('e_benzin').value,
        motorin: document.getElementById('e_motorin').value,
        adsoyad: document.getElementById('e_adsoyad').value,
        pbik: document.getElementById('e_pbik').value
    };

    try {
        if (await DB.update(currentEditId, data)) {
            showToast('Kayıt güncellendi.', 'success');
            closeModal();
            await renderDefter();
        }
    } catch (e) {
        console.error("Güncelleme hatası:", e);
        showToast('Güncelleme sırasında hata oluştu!', 'error');
    }
}

async function silKayit(id) {
    if (typeof DB === 'undefined') return;
    if (confirm('Bu kaydı silmek istediğinize emin misiniz?')) {
        try {
            await DB.delete(id);
            showToast('Kayıt silindi.', 'info');
            await renderDefter();
            await updateBadges();
        } catch (e) { console.error("Silme hatası:", e); }
    }
}

// ========================
// YARDIMCI FOKSİYONLAR
// ========================
function showToast(msg, type) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = msg;
    toast.className = "toast " + (type || 'info');
    toast.classList.remove('hidden');
    setTimeout(function () { toast.classList.add('hidden'); }, 3000);
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return String(d.getDate()).padStart(2, '0') + "." + String(d.getMonth() + 1).padStart(2, '0') + "." + d.getFullYear();
}

async function updateBadges() {
    if (typeof DB === 'undefined') return;
    try {
        var all = await DB.getAll();
        var badge = document.getElementById('totalRecordsBadge');
        if (badge) badge.innerText = (all || []).length + " Kayıt";
    } catch (e) { console.error("Badge güncelleme hatası:", e); }
}

async function updateDatalists() {
    if (typeof DB === 'undefined') return;
    try {
        var kayitlar = await DB.getAll();
        var plakalar = Array.from(new Set(kayitlar.map(function (k) { return k.plaka; }).filter(function (p) { return p; })));
        var pbikler = Array.from(new Set(kayitlar.map(function (k) { return k.pbik; }).filter(function (p) { return p; })));

        var pl = document.getElementById('plakaList');
        var pb = document.getElementById('pbikList');
        if (pl) pl.innerHTML = plakalar.map(function (p) { return '<option value="' + p + '">'; }).join('');
        if (pb) pb.innerHTML = pbikler.map(function (p) { return '<option value="' + p + '">'; }).join('');
    } catch (e) { console.error("Datalist güncelleme hatası:", e); }
}

/**
 * Plaka veya PBiK yazıldığında Araç bilgilerini otomatik getiren fonksiyon
 */
async function checkAutofill(type) {
    if (typeof DB === 'undefined') return;
    var inputId = type === 'plaka' ? 'f_plaka' : 'f_pbik';
    var val = document.getElementById(inputId).value.trim().toUpperCase();
    if (val.length < 2) return;

    try {
        var kayitlar = await DB.getAll();
        var match = [...kayitlar].reverse().find(function (k) {
            var target = (type === 'plaka' ? k.plaka : k.pbik);
            return target && target.toUpperCase().includes(val);
        });

        if (match) {
            if (match.birim) document.getElementById('f_birim').value = match.birim;
            if (match.marka) document.getElementById('f_marka').value = match.marka;
            if (match.adsoyad) document.getElementById('f_adsoyad').value = match.adsoyad;

            var otherId = type === 'plaka' ? 'f_pbik' : 'f_plaka';
            var otherVal = type === 'plaka' ? match.pbik : match.plaka;
            if (otherVal) document.getElementById(otherId).value = otherVal;

            if (match.km) {
                var kmInput = document.getElementById('f_km');
                if (kmInput) kmInput.placeholder = "Son KM: " + match.km;
            }

            ['f_birim', 'f_marka', 'f_adsoyad', (type === 'plaka' ? 'f_pbik' : 'f_plaka')].forEach(function (id) {
                var el = document.getElementById(id);
                if (el) {
                    el.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                    el.style.borderColor = 'var(--green)';
                    setTimeout(function () { el.style.backgroundColor = ''; el.style.borderColor = ''; }, 2000);
                }
            });
            showToast('Araç bilgileri otomatik dolduruldu.', 'success');
        }
    } catch (e) { console.error("Autofill hatası:", e); }
}

/**
 * Ad Soyad yazıldığında PBiK numarasını otomatik getiren fonksiyon
 */
async function autofillPbikByName() {
    if (typeof DB === 'undefined') return;
    const nameInput = document.getElementById('f_adsoyad').value.trim().toLowerCase();
    const pbikInput = document.getElementById('f_pbik');

    if (nameInput.length < 3) return;

    try {
        const kayitlar = await DB.getAll();
        const match = [...kayitlar].reverse().find(item => 
            item.adsoyad && item.adsoyad.toLowerCase() === nameInput
        );

        if (match && match.pbik) {
            pbikInput.value = match.pbik;
            pbikInput.style.backgroundColor = "#10b98133"; 
            setTimeout(() => pbikInput.style.backgroundColor = "", 800);
        }
    } catch (e) { console.error("Name autofill hatası:", e); }
}

async function initApp() {
    console.log("initApp() başlatılıyor...");
    if (typeof initSupabase === 'function') {
        initSupabase();
    } else {
        console.error("initSupabase bulunamadı!");
    }

    formTemizle(); 

    try {
        await updateBadges();
        await renderRecent();
        await updateDatalists();

        var years = await DB.getYears();
        ['raporYil', 'dlYil'].forEach(function (id) {
            var sel = document.getElementById(id);
            if (sel) sel.innerHTML = years.map(function (y) { return '<option value="' + y + '">' + y + '</option>'; }).join('');
        });
        console.log("App başarıyla başlatıldı.");
    } catch (e) {
        console.error("initApp sırasında hata:", e);
    }
}

// Oturum kontrolü ile başlat
document.addEventListener('DOMContentLoaded', function () {
    console.log("DOM yüklendi, Auth kontrol ediliyor...");
    checkAuth();

    var loginPass = document.getElementById('loginPass');
    if (loginPass) {
        loginPass.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') doLogin();
        });
    }

    // Ad Soyad inputuna event listener ekle
    var nameField = document.getElementById('f_adsoyad');
    if (nameField) {
        nameField.addEventListener('blur', autofillPbikByName);
    }
});
