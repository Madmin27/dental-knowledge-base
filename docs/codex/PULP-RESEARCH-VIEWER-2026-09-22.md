# Kaynaklı diş içi araştırma modülü

Kullanıcının Akimoto örneğinden yararlanıp atlası geliştirme isteği üzerine, özgün
CC BY4 Figshare araştırma CAD'i alındı; yeni Türkçe arayüz/renderer yazıldı. Akimoto
uygulama kodu veya hazır yüzey dosyaları kopyalanmadı. Açık makalenin tam metni
okundu; kaynak pediatrik görüntüden yeniden biçimlendirilmiş FEM modelidir.

`/tooth-interior`: dört inceleme adımı, saydam dış yüzey, pulpa boşluğu, isteğe
bağlı şematik destek katmanı, üç eksende kesit/çevirme/karşıdan bakış, stencil dolgu,
mobil dokunma/klavye, açıklamalar ve kaynak/lisans penceresi. Kesit dolgu renkleri
ayrı mine-dentin tabakası diye gösterilmez; araştırma örneği ana28 dişe kaydedilmez.

Private contribution sözleşmesine açık `tooth-interior` türü eklendi: üç mesh
hash'i, seçili katman, kesit/opacity ve camera-target-up. Takip doğru modüle döner,
eski/mismatched hash reddedilir. Var olan kayıtlar/ana atlas sözleşmesi korunur.

Source assets Git dışında; yalnız allowlist dönüştürülmüş binary/manifest/atıf
sunulur. Startup'ta SHA/byte boyutu/finite vertex/index kontrolü, sonrasında RAM'deki
doğrulanmış aynı bytes. STEP/arşiv veya hasta verisi rotası yok. Opt-in env olmadan
araştırma modeli404. Mevcut dental-preview read-only bind ile güncellendi; aynı
LAN192.168.1.192:3057. Diğer servis/DB/UFW/Nginx/modem değişmedi.

## Kanıt

- 63 JS testi +10 Python guard testi geçti. Yeni4 araştırma erişim/bütünlük ve
  araştırma görünümü için ek1 katkı testi mevcut testlere dahil.
- İzole localhost'ta17 araştırma tarayıcı adımı: gerçek kaynak, üç kesit, saydam
  kesit, kaynak/limit, dokunma, özel bildirimden aynı source/cut/camera dönüşü.
- Canlı LAN'da son17 araştırma adımı: bunlar arasında klavye, idle render ve
  stale-source reddi var; canlı kuyruğa sentetik kayıt eklenmedi.
- Mevcut atlas20 tarayıcı adımı +ana katkı7 adımı tekrar geçti.
- Canlı ilk denemede GPU geometry count kontrolü erken ölçüm aldı (5→6); test
  bütün6 geometry yüklenmesini bekleyecek şekilde düzeltildi, son canlı test geçti.
  Bu shader yükleme ölçümü anatomik doğruluk kanıtı değildir.
- Stencil yüzeyler saydam olduğunda render sırası ayrıca düzeltildi; screenshot'lar
  incelendi. Kaynak/mesh sayıları, bağlı bileşen ve hacim farkı KANG-PULP-REVIEW.md.
- Kanıtlar repo dışında `/tmp/dkb-pulp/proof/`; kaynak kimliği/manifest
  `/root/.local/share/dental-research/pulp-kang-v1` altında. Lisans/source metadata
  doğrulandı; gerçek telefon ölçümü ve uzman anatomik kabul henüz yapılmadı.

Takım DeepSeek gateway danışmanlığı provenance/şematik PDL/kesit/genellenebilirlik
risklerini değerlendirdi; insan akademik kararının yerine kullanılmadı. Kamuya
akademik yayın, demografik varyasyon veya TASK005/006/011 tamamlandı sayılmıyor.
