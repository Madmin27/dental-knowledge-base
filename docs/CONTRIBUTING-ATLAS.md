# Atlas katkıları

Uzman pilotu ve güncel erişim sınırlamaları:
[EXPERT-PILOT.md](EXPERT-PILOT.md). Dış IP'den atlasın açılması, özel katkı
servisinin o adres için yapılandırılmış olduğu anlamına gelmez.

Atlasta **Katkıda bulun** düğmesini kullanın. İlgili yapıyı, sorun türünü,
gözleminizi, beklediğiniz sonucu ve varsa kaynak bağlantılarını yazın.
Gönderim açıldığı andaki kamera ve katman ayarları, modelin tam sürümüyle kaydedilir.
Öğrenci/eğitimci/hekim/araştırmacı rolleri beyana dayanır.

Alındı ekranındaki **özel takip bağlantısını indirin veya saklayın**. Bu bağlantıyla
bildiriminizi ve bakımcı yanıtını okuyabilir, ek kaynak gönderebilir ve aynı 3B
görünümü tekrar açabilirsiniz. Bağlantıya sahip herkes bu erişimi kazanır;
herkese açık paylaşmayın. Kayıp anahtar kurtarılamaz. Hasta bilgisi veya dosyası
göndermeyin. Metinler HTML olarak çalıştırılmaz, bağlantılar sunucuda açılmaz.

Katkılar doğrudan anatomiyi değiştirmez. Bakımcı ön incelemesi → gerekirse ek
kaynak → düzeltme planı → uygulama sonucu şeklinde ilerler. Anatomik değişiklik
ayrıca uzman ve hak/yayın incelemesi gerektirir. Kapatma akademik onay değildir.
Teknik katkılar GitHub pull request ile, anatomik kaynaklar hak sahibi/lisans ve
sabit sürüm bilgisiyle önerilebilir. Modelin CC BY-SA atıf zinciri korunmalıdır.

## Bakımcı

Sunucuda (root veya anahtarı okumaya yetkili bakımcı):

```sh
node scripts/manage_contributions.mjs list
node scripts/manage_contributions.mjs show BILDIRIM_ID
node scripts/manage_contributions.mjs comment BILDIRIM_ID MEVCUT_REVISION /tmp/gerekce.json
node scripts/manage_contributions.mjs update BILDIRIM_ID triage MEVCUT_REVISION /tmp/gerekce.json
```

Gerekçe dosyası: `{"note":"Somut değerlendirme", "evidence":["https://kaynak.example/... "]}`.
`show` çıktısındaki revision kullanılır. Başka birinin güncellemesinde 409 döner;
önce tekrar okuyun. `addressed` için gerçek değişiklik/test bağlantısı gerekir.
Anahtar `/etc/dental-preview/moderator.key` içinde 0600; argüman, Git, ekran veya
loglara kopyalamayın. `DKB_INTAKE_URL` ve `DKB_MODERATOR_KEY_FILE` yalnız alternatif
izole kurulum içindir. CLI özel bildirim metnini ekrana getirir; çıktıyı paylaşmayın.

## Depolama, gizlilik ve yedek

Canlı spool `/var/lib/dental-preview/contributions`; DynamicUser StateDirectory,
kod salt-okunur. Kayıtlar 0600, dizin 0700. Anahtar dosyası ayrı root korumasındadır.
Servis başında directory erişim hatası varsa açılış başarısız olur; sahte alındı verilmez.
Disk dolduğunda/kota dolduğunda gönderim hata verir; takip anahtarını koruyarak tekrar deneyin.
Tek süreç çalıştırın; aynı spool üzerinde ikinci sunucu başlatmayın.

Yerel inceleme politikası: açık bildirimleri aylık gözden geçirin; kapanan metinleri
90 gün sonra veya doğrulanmış silme talebinde kaldırın. Bu süre otomatik bir iş
olarak kurulmuş değildir; bakımcı sorumluluğudur. Kaldırma:

```sh
node scripts/manage_contributions.mjs redact BILDIRIM_ID MEVCUT_REVISION
```

Bu işlem metin, görünen ad ve URL'leri geri alınamaz biçimde kaldırır; teknik
iz kayıtları kalır. Gizli bilgi yanlışlıkla eklendiyse ilgili eski yedekleri de kaldırın.

Yedek (repo dışında, root erişimli konum):

```sh
python3 scripts/backup_contributions.py /var/lib/dental-preview/contributions /var/backups/dental-preview/intake-TARIH.tar.gz
```

Araç her kaydı tutarlı okur; arşivi SHA-256 manifestiyle doğrular, 0600 oluşturur,
var olan yedeğin üzerine yazmaz. Tüm kayıtlar için ortak işlem anı garantisi yoktur.
Şifreli sunucu dışı kopya ayrıca gereklidir; bu sürüm otomatik/off-site yedek kurmaz.
Anahtar geri yükleme için ayrı, güvenli sistem yedeğinde tutulmalıdır.

Kurtarma: yalnız dental-preview servisini durdurun; arşivi **önce boş bir geçici
dizine** açıp manifest hashlerini doğrulayın. Mevcut spool'un ayrı yedeğini alın.
Doğrulanmış JSON dosyalarını StateDirectory'ye, mevcut sahiplik/0600 korunarak
kopyalayın; yalnız bu servisi başlatıp health ve bilinen özel takip linkini kontrol
edin. Yeni kayıtların üzerine körlemesine yazmayın. İzole testte yedek geri okuma
kontrol edilir; fiziksel disk kaybı kurtarması yapılmış sayılmaz.

## Tekrarlanabilir doğrulama

`npm test` katkı erişimi, idempotency, restart, concurrency, limits ve gizlilik
testlerini de çalıştırır. Gerçek Chrome akışı:
`scripts/validate_contributions_browser.mjs ENDPOINT http://127.0.0.1:3058/ OUTPUT TEST_KEY_FILE`.
Yalnız ayrı geçici depo/anahtarla kullanılmalı; gerçek katkı kuyruğuna sentetik test eklemez.
