# Katkı kuyruğu — uygulama ve doğrulama

Yerel ağ atlasına form → özel takip → ek açıklama → bakımcı ön incelemesi → aynı
3B görünümü açma akışı eklendi. Kaynak geometri değişmedi. Seçili yapı kaynak adı,
iki model binary hash'i, FDI, kamera/target ve katmanlar kaydedilir. Eşleşmeyen
model sürümü sessizce yeniden eşlenmez. Dosya veya hasta kaydı alımı yoktur.

Veriler Git/core DB dışında `/var/lib/dental-preview/contributions` içinde.
Systemd DynamicUser + StateDirectoryMode0700; kayıt0600; bakımcı anahtarı root0600
LoadCredential ile alınır. Port3057 ve LAN adresi aynıdır; firewall/Nginx/modem veya
PostgreSQL değişmedi. Ortak koddaki hak ve insan onayı motorları korunur.

## Doğrulama

- 50 JavaScript testi: mevcut43 + yeni7 katkı testi.
- 10 Python clinical guard testi; Git index taraması.
- Chrome: 7 katkı akışı, 20 atlas akışı; runtime exception yok.
- Katkı testleri ayrı localhost3058/geçici spool üzerinde. Canlı kuyruk boş bırakıldı;
  canlı LAN formunun etkinliği ve health contributionsEnabled=true doğrulandı.
- Başarılı alındının restart ve SIGKILL sonrası okunması; atomik JSON dosyaları;
  idempotency, yetkisiz erişim, Host/Origin, eşzamanlı revision çakışması, key hash,
  kota/rate/body sınırı, bilimsel yetki taklidinin reddi, gizlilik tombstone'u.
- Tarayıcı: metnin HTML olmaması, özel takip, ek açıklama, bakımcı durum geçmişi,
  FDI36 yan açı ve saydamlıkların geri yüklenmesi, mobil form.
- Backup tar.gz kaydı hash manifestiyle yeniden okunarak doğrulandı. Otomatik veya
  sunucu dışı yedek kurulduğu iddia edilmez; fiziksel güç kesintisi test edilmedi.
- Görsel kanıt ve sentetik sonuçlar yerel `/tmp/dkb-contributions/` altında;
  anahtar/takip URL içerebilecek çıktılar Git'e alınmadı.

## Takım değerlendirmesi

DeepSeek gateway üzerinden iki görüş: önce tasarım, sonra server kodu. İdempotency,
directory fsync, özel erişim, kota, gizlilik ve akademik onay ayrımı benimsendi.
İkinci turda kaynak dizisinin varsayılan boş olması ve bakımcı comment-only akışı
eklendi; görünüm sözleşmesinin serbest metni kaydetmediği test edildi. Tekrar redact
idempotent. Olay sayısı ve byte kotası birlikte geçerli. Directory fsync başarısızlığı
başarılı alındıya çevrilmedi; güvenli retry korundu. AI görüşü anatomik uzman onayı değildir.

Takip: ADR0005 CONTRIB-001/002/003. Bu iş TASK-005–015 veya kamuya akademik yayın
olarak işaretlenmedi. Henüz kaynakta olmayan pulpa/kanal üretimi yapılmadı.
