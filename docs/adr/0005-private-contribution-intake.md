# ADR 0005 — Özel atlas katkı kuyruğu

Durum: Yerel inceleme için kabul edildi, 2026-09-22.

## Karar

Mevcut atlasın bir yapısını ve sürümlü görünümünü işaret eden metin katkıları,
servise ait ayrı StateDirectory içinde tutulur. Bu bir bakımcı ön inceleme
kuyruğudur; canonical Issue/Review/Release motoru değildir. TASK-005–015,
akademik hakemlik, doğrulanmış uzman kimliği veya yayın onayı tamamlandı sayılmaz.
Mevcut klinik/akademik PostgreSQL tablolarına yazılmaz; model değişmez.

İlk gönderim, binary SHA-256 çiftini, yapının kaynak adını, FDI seçimini,
kamera/target ve katmanları içerir. Yüzey noktası/barycentric annotation değildir.
Sürüm uyuşmazlığında görünüm güncel modele sessizce taşınmaz. Rol kişinin beyanıdır.
Kaynak URL'leri sunucu tarafından ziyaret edilmez; ham dosya yükleme yoktur.

256 bit rastgele özel takip anahtarı URL fragmentinden Authorization başlığına
geçer. Anahtar sunucuda yalnız SHA-256 özetiyle tutulur; herkese açık liste yoktur.
Anahtar kaybında kurtarma yoktur; kullanıcı indirilebilir takip belgesini saklar.
Bakımcı anahtarı tarayıcıya verilmez: systemd credential + yerel CLI kullanılır.
Mevcut HTTP LAN yalnız yerel önizlemedir; güvenilmeyen ağda gizlilik sağlamaz.
İnternete açmadan HTTPS, gerçek kimlik/yetki, abuse ve yedek politikası gerekir.

## Kalıcılık ve sınırlar

Tek servis yazıcısı, seri mutasyon kuyruğu; kayıt başına geçici dosya, fsync,
atomic rename ve directory fsync. Revision diskteki olay sayısından türetilir.
Başlangıçta tamamlanmamış .tmp dosyaları temizlenir; bunlar alındı belgesi değildir.
Aynı id+anahtar+normalize edilmiş içerik tekrarında aynı kayıt; farklı içerikte
409. Görünüm ve metin özgün kayıtta korunur, takip olayları eklenir. Author
followup revision kontrolü çift yazmayı önler; istemci çakışmada yeniler.
Kota: istek 24.000 byte, kayıt 256 KiB, 2.000 kayıt, 100 olay; IP başına 40/10dk,
kayıt başına 40/10dk, en fazla 4.096 rate-limit anahtarı. Limitler RAM'dedir ve
restart ile sıfırlanır; kimliksiz LAN için temel sınırlamadır, Sybil koruması değildir.

İzinli bakımcı durumları: received → triage / needs_evidence / closed;
triage → needs_evidence / change_planned / closed; needs_evidence → triage / closed;
change_planned → triage / addressed / closed; addressed → triage / closed;
closed → triage. Bunlar domain Issue enum'u değildir. addressed için gerekçe ve
somut değişiklik/doğrulama bağlantısı gerekir, bilimsel kabul anlamı taşımaz.

Gizlilik istisnası: bakımcı redact işlemiyle tüm serbest metin/URL'leri kaldırabilir;
kimlik, teknik görünüm, zamanlar, durum geçmişi ve kaldırma olayı kalır. Orijinal
payload hash geri gönderimle silinen metnin geri gelmesini engeller. Aynı verinin
yedekleri de bakımcı tarafından temizlenmelidir. Olağan triage geçmişi değiştirilemez.

## Takım ve araştırma

DeepSeek gateway tasarım eleştirisi: idempotency, disk senkronizasyonu, sınırlı
kuyruk, eşit erişim hataları, gizlilik ve onay terminolojisi. Bunlar uygulandı;
AI danışmanlık çıktısı insan uzman doğrulaması olarak kullanılmadı.
- [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html): exact origin, custom header, JSON; CORS yok.
- [Node filesystem](https://nodejs.org/api/fs.html): open/sync/rename.

## Açık yayın engelleri

CONTRIB-001: kendi platformumuzun canonical katkı kaydına import migration,
kaynak revizyon eşleme, audit ve
rol doğrulaması tasarlanıp insan tarafından onaylanmadan bu kuyruktan akademik
kabul/yayın üretilemez. İçe aktarma henüz uygulanmadı.
CONTRIB-002: halka açık HTTPS hizmeti, hesap/yetki sistemi, uzman incelemesi,
veri saklama ve silme politikası, şifreli sunucu dışı yedek ve kurtarma tatbikatı.
CONTRIB-003: kök/kemik/yumuşak doku ilişkilerinin isimli diş anatomisi uzmanıyla
incelenmesi; doğrulanmış pulpa/kanal kaynağı. Bu çalışma eksik dokuyu üretmez.
