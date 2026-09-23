# ADR0007 ikinci takım incelemesi

Kullanıcı talebiyle consult_team'e yalnız mimari özet gönderildi; kod veya gerçek
katkı verisi gönderilmedi. İnceleme tasarıma ilişkindir, uygulanmış güvenlik kanıtı değildir.

- z-ai/glm-5.3-flash (mimar): proceed / medium. Tasarım tutarlı, kalan açıklar
  işletim ve test kanıtı; kurtarma ve kimlik sağlayıcı runbook'u öncelikli.
- deepseek/deepseek-v4.1-flash (risk): revise / high. Yetki/çıkar çatışması,
  eşzamanlılık, itiraz ve silme yolları kodla doğrulanmalı.
- Üçüncü model xiaomi/mimo-v2.6-flash çağrısı başarısız. Gateway sonucu degraded;
  tam ekip mutabakatı veya üçüncü bağımsız onay yok.

Değerlendirmemiz: güvenlik kontrollerini uygulayıp test etmeden portalı güvenli
ilan etmeme uyarısı doğru. 'RPO/RTO tanımlı değil' yorumu eksik özete dayanıyor:
ADR0007'de 24 saat/4 saat hedefleri var; gerçek tatbikatın eksik olduğu doğru.
Erişilebilirliği tamamen erteleme önerisi kabul edilmedi. Mevcut özel katkı pilotu
ile gelecekteki akademik oylama pilotunun açılış koşulları ayrı tutulacak.

Uygulama kabulüne eklenecek somut kontroller:

1. Oy/deadline kapanışı aynı tur kilidini kullanır; kapanıştan sonra oy kabul
   edilmez. Aynı kişinin paralel oyları çift sayılmaz. Kaynak/panel değişikliği
   eski snapshot'a yazmayı durdurur. Yetki iptaliyle yarışta eski yetkiyle
   karar çıkmaz. Outbox tekrarında aynı olay iki bildirim oluşturmaz.
2. Kimlik sağlayıcı güncelleme, oturum toplu iptali, MFA kurtarma ve servis
   arızası runbook'u. Kimlik servisi yokken yeni ayrıcalıklı işlem kapalı kalır.
3. Çıkar çatışması yalnız beyanla geçilmez; mevcut yazarlık/kurum/atama kayıtları
   kontrol edilir. Editör de beyan ve değerlendirmeye tabidir; kendi itirazını
   tek başına çözemez. Çatışmasız kurul yoksa bekleyen durum açıkça gösterilir.
4. Ayrı sunucuya kimlik DB+uygulama DB+nesne geri yükleme provası; eski oturum
   iptali, erişim sınırları ve oy/karar tutarlılığı doğrulanır.
5. Yetkisiz özel görüş erişimi, gizlilik nedeniyle kaldırma, bağımsız itiraz
   ve kesinti sırasında deadline davranışı negatif testlerle doğrulanır.
   Kesinti son tarihi sessizce uzatmaz; gerekçeli yeni tur gerekir.

Bu kayıt yeni portalın uygulandığını, testlerin koştuğunu veya akademik onay
alındığını göstermez; GOV-001–006 işlerinin kabul kapsamını somutlaştırır.
