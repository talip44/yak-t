/**
 * db.js - Supabase & LocalStorage veritabanı
 */

(function (window) {
    console.log("db.js yükleniyor...");

    var DB_KEY = 'akaryakit_kayitlar';
    var SUPA_URL = 'https://rcwywcipxnyoqvxhrvnk.supabase.co';
    var SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjd3l3Y2lweG55b3F2eGhydm5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NDQ4OTAsImV4cCI6MjA4NzQyMDg5MH0.kgcuKs7qX-RwjIPwE9X1nrE0aneniXEt2TdKRErS6UA';

    var supabase = null;

    /** Supabase İstemcisini Başlat */
    function initSupabase() {
        console.log("initSupabase() çağrıldı...");
        try {
            if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
                supabase = window.supabase.createClient(SUPA_URL, SUPA_KEY);
                console.log("Supabase istemcisi oluşturuldu.");
                return true;
            } else {
                console.warn("Supabase kütüphanesi hazır değil (global 'supabase' bulunamadı).");
                return false;
            }
        } catch (err) {
            console.error("Supabase başlatma sırasında kritik hata:", err);
            return false;
        }
    }

    var DB = {
        /** Mevcut modu kontrol et */
        isCloud: function () {
            return supabase !== null;
        },

        getAll: async function () {
            console.log("DB.getAll() çağrıldı. Cloud modu:", this.isCloud());
            var localData = this.getLocal();
            try {
                if (this.isCloud()) {
                    const { data, error } = await supabase.from('akaryakit').select('*').order('tarih', { ascending: false });
                    if (error) {
                        console.error('Supabase query hatası:', error);
                        if (error.code === 'PGRST205') {
                            console.warn("DİKKAT: Tablo bulunamadı, yerel veriler gösteriliyor.");
                        }
                        return localData;
                    }

                    // Eğer bulutta veri yoksa ama yerelde varsa, yerel veriyi öncelikli göster
                    if ((!data || data.length === 0) && localData.length > 0) {
                        console.log("Bulut boş, yerel veriler yükleniyor...");
                        return localData;
                    }
                    return data || [];
                }
            } catch (err) {
                console.error('getAll() istisnası:', err);
            }
            return localData;
        },

        getLocal: function () {
            try {
                var localData = localStorage.getItem(DB_KEY);
                return localData ? JSON.parse(localData) : [];
            } catch (err) {
                console.error('Yerel veri okuma hatası (localStorage kapalı olabilir):', err);
                return [];
            }
        },

        add: async function (kayit) {
            kayit.id = Date.now() + Math.random().toString(36).substr(2, 5);
            kayit.olusturma = new Date().toISOString();

            var success = true;
            try {
                if (this.isCloud()) {
                    const { error } = await supabase.from('akaryakit').insert([kayit]);
                    if (error) {
                        console.error('Supabase insert hatası:', error);
                        success = false;
                        if (error.code === 'PGRST205') {
                            alert("HATA: Tablo bulunamadı! SQL komutunu çalıştırdığınızdan emin olun.");
                        } else {
                            alert("Veritabanı Hatası: " + error.message);
                        }
                    }
                }
            } catch (err) {
                console.error('add() istisnası:', err);
                success = false;
            }

            // Her durumda yerelde tut (yedekleme amaçlı)
            var kayitlar = this.getLocal();
            kayitlar.unshift(kayit);
            try {
                localStorage.setItem(DB_KEY, JSON.stringify(kayitlar));
            } catch (e) { console.error("LocalStorage save error:", e); }

            return success;
        },

        /** Kayıt güncelle */
        update: async function (id, yeniVeri) {
            try {
                if (this.isCloud()) {
                    const { error } = await supabase.from('akaryakit').update(yeniVeri).eq('id', id);
                    if (error) console.error('Supabase update hatası:', error);
                }
            } catch (err) {
                console.error('update() istisnası:', err);
            }

            var kayitlar = this.getLocal();
            var idx = kayitlar.findIndex(k => k.id === id);
            if (idx !== -1) {
                kayitlar[idx] = Object.assign({}, kayitlar[idx], yeniVeri);
                localStorage.setItem(DB_KEY, JSON.stringify(kayitlar));
                return true;
            }
            return false;
        },

        /** Kayıt sil */
        delete: async function (id) {
            try {
                if (this.isCloud()) {
                    const { error } = await supabase.from('akaryakit').delete().eq('id', id);
                    if (error) console.error('Supabase delete hatası:', error);
                }
            } catch (err) {
                console.error('delete() istisnası:', err);
            }

            var kayitlar = this.getLocal().filter(k => k.id !== id);
            localStorage.setItem(DB_KEY, JSON.stringify(kayitlar));
        },

        /** ID ile al */
        getById: async function (id) {
            var all = await this.getAll();
            return all.find(k => k.id === id) || null;
        },

        /** Tarih aralığına göre filtrele */
        filterByDate: async function (start, end) {
            var all = await this.getAll();
            return all.filter(function (k) {
                if (start && k.tarih < start) return false;
                if (end && k.tarih > end) return false;
                return true;
            });
        },

        /** Plaka ile filtrele */
        filterByPlaka: async function (plaka) {
            var q = plaka.trim().toUpperCase();
            var all = await this.getAll();
            return all.filter(function (k) { return k.plaka && k.plaka.toUpperCase().includes(q); });
        },

        /** Birim ile filtrele */
        filterByBirim: async function (birim) {
            var q = birim.trim().toLowerCase();
            var all = await this.getAll();
            return all.filter(function (k) { return k.birim && k.birim.toLowerCase().includes(q); });
        },

        /** Ay & yıl ile filtrele */
        filterByMonth: async function (yil, ay) {
            var all = await this.getAll();
            return all.filter(function (k) {
                if (!k.tarih) return false;
                var d = new Date(k.tarih);
                if (yil && d.getFullYear() !== parseInt(yil)) return false;
                if (ay && (d.getMonth() + 1) !== parseInt(ay)) return false;
                return true;
            });
        },

        /** Özet istatistik */
        summary: function (kayitlar) {
            return kayitlar.reduce(function (acc, k) {
                acc.benzin += parseFloat(k.benzin || 0);
                acc.motorin += parseFloat(k.motorin || 0);
                acc.count++;
                return acc;
            }, { benzin: 0, motorin: 0, count: 0 });
        },

        /** Birim bazlı gruplama */
        groupByBirim: function (kayitlar) {
            var map = {};
            kayitlar.forEach(function (k) {
                var b = k.birim || 'Belirtilmemiş';
                if (!map[b]) map[b] = { birim: b, benzin: 0, motorin: 0, count: 0 };
                map[b].benzin += parseFloat(k.benzin || 0);
                map[b].motorin += parseFloat(k.motorin || 0);
                map[b].count++;
            });
            return Object.values(map).sort(function (a, b) { return (b.benzin + b.motorin) - (a.benzin + a.motorin); });
        },

        /** Ay bazlı gruplama */
        groupByMonth: function (kayitlar) {
            var map = {};
            kayitlar.forEach(function (k) {
                if (!k.tarih) return;
                var d = new Date(k.tarih);
                var ay = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, '0');
                if (!map[ay]) map[ay] = { ay: ay, benzin: 0, motorin: 0, count: 0 };
                map[ay].benzin += parseFloat(k.benzin || 0);
                map[ay].motorin += parseFloat(k.motorin || 0);
                map[ay].count++;
            });
            return Object.values(map).sort(function (a, b) { return a.ay.localeCompare(b.ay); });
        },

        /** Mevcut yılları listele */
        getYears: async function () {
            var yillar = new Set();
            var all = await this.getAll();
            all.forEach(function (k) {
                if (k.tarih) yillar.add(new Date(k.tarih).getFullYear());
            });
            yillar.add(new Date().getFullYear());
            return Array.from(yillar).sort(function (a, b) { return b - a; });
        },

        /** Verileri dışa aktar (JSON) */
        exportBackup: async function () {
            var data = JSON.stringify(await this.getAll(), null, 2);
            var blob = new Blob([data], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = "akaryakit_yedek_" + new Date().toISOString().split('T')[0] + ".json";
            a.click();
            URL.revokeObjectURL(url);
        },

        /** Verileri içe aktar (JSON) */
        importBackup: function (fileContent) {
            try {
                var data = JSON.parse(fileContent);
                if (Array.isArray(data)) {
                    localStorage.setItem(DB_KEY, JSON.stringify(data));
                    return true;
                }
            } catch (e) { console.error('Geri yükleme hatası:', e); }
            return false;
        }
    };

    // Global erişim için window'a bağla
    window.initSupabase = initSupabase;
    window.DB = DB;

    console.log("db.js başarıyla yüklendi.");
})(window);
