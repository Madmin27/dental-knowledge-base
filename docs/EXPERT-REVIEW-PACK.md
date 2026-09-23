# DentalKnowledgeBase — somut uzman inceleme paketi

Durum: İncelemeye hazırlanmış aday; uzman tarafından onaylanmış içerik değildir.
İlk 3–5 uzmanla yürütme ve erişim koşulları: [EXPERT-PILOT.md](EXPERT-PILOT.md).
İnceleme ekranı: mevcut atlas önizlemesi. Ana eylemler: 1) diş-diş eti-kemik birleşimi,
2) kemik içinde kök incelemesi, 3) sinir/atardamar katmanları, 4) tek diş.

## İnceleyene verilecek kaynaklar

- Kaynak/geometri/atıf: `docs/assets/Z-ANATOMY-REVIEW.md`.
- Her dosyanın kaynak revizyonu, SHA-256 ve dönüşümleri:
  `apps/preview/public/models/z-anatomy/dentition.json`, `neurovascular.json`.
- İndirilebilir yüzeyler, lisans ve atıflar uygulamanın Kaynak & lisans ekranında.
- Eklenen özgün geometri yok. Sunum alt bölmesi diş/diş eti/kemik alt kümesine
  uygulanmıştır; nörovasküler yüzeylere uygulanmamıştır. Bu fark incelenmelidir.

## İnceleme sırası ve kayıt

Her madde için **uygun / düzeltilecek / kaynak yetersiz / incelenmedi** seçilir.
İnceleyen adı, uzmanlık, tarih ve incelenen manifest hashleri kayda girilmelidir.
Boş veya "incelenmedi" maddesi onay anlamına gelmez.

1. Sağ/sol, üst/alt ve FDI eşlemesi; 28 dişin tek tek kimliği.
2. FDI 16/36/37: kron, tüberkül, fissür, kök sayısı ve biçiminin kaynakla uyumu.
   Kaynaktaki biçimin popülasyon normu gibi anlatılmadığını kontrol edin.
3. Kök-kemik ilişkisi: ön, yan ve oklüzal bakış; diş eti %0/%15/%75 ve kemik
   %0/%55/%85 saydamlık. Doku modelinin sınırları dışında kalan kök bölgeleri
   ve kök-kemik kesişimleri ayrı bulgu olarak kaydedilir. Yazılım görünürlüğü
   değiştirerek morfolojik kusuru çözdüğünü iddia etmez.
4. Pembe diş eti alt kümesinin sınırları ve gerçek anatomik sınırın farkı.
   Sunumun tüm çene/baş dokularını kapsadığı izlenimi verip vermediği.
5. Sağ/sol alt alveolar, mental ve maksiller sinirlerin konumu/etiketi.
6. Sağ/sol alt alveolar, mental dal, arka üst alveolar ve büyük damak
   atardamarlarının konumu/etiketi. Eksik dallar ve açık uçlar açıkça yazılır.
7. Sinir/damar konumu kaynakta korunur; yapay çene ayırma kapalıdır.
   Bir yüzeyin dişe yakınlığı gerçek pulpa bağlantısı olarak yorumlanmaz.
8. Yoklukların görünürlüğü: üçüncü azılar, pulpa/kanal hacimleri, diş içi damar
   ve sinir ağı, venler, kapillerler, periodontal ligament segmentasyonu.
9. Türkçe etiketlerin eğitim terminolojisi; açıklamalar ve yaş/cinsiyet iddiaları.
10. Bağımsız diş içi araştırma örneği: `docs/assets/KANG-PULP-REVIEW.md`
    ve bu örneğin kendi manifestiyle inceleyin. Kesit, iç boşluk ve kaynakta
    bulunan yapıların etiketlerini kontrol edin. Kesit kapağı bir doku
    segmentasyonu değildir. Bu örneği Z-Anatomy ağzındaki FDI 16/36/37 ile
    eşleştirmeyin; aynı bireye veya dişe ait olduğu çıkarımını yapmayın.

## Bulgu şablonu

- İncelenen sürüm / manifest SHA-256:
- İnceleyen / uzmanlık / tarih:
- Yapı / FDI / sağ-sol:
- Adımlar (görünüm, çene filtresi, saydamlık değerleri):
- Beklenen anatomik ilişki ve başvuru kaynağı:
- Gözlenen sapma (mümkünse ekran görüntüsü):
- Kaynak model kusuru / dönüşüm kusuru / sunum kusuru / belirsiz:
- Etki: yayını engeller / açıklamayla kullanılabilir / küçük düzeltme:
- Düzeltme ve yeniden inceleme sonucu:
- Gerekçeli kararın kapsamı, sınırlamaları ve varsa karşı görüş:
- İsmin/görüşün kamuya aktarılması için izin (ayrı ayrı):

Bu dosyanın hazırlanması insan incelemesini gerçekleştirmiş sayılmaz. Kamuya
öğrenci yayını, kaydedilmiş hak/akademik kararlar ve gerçek cihaz kabulünden sonra
hazırlanır. İnceleme notlarına hasta kimliği veya ham klinik görüntü eklenmez.

## Teknik teslim kanıtı — 2026-09-22

Kaynak geometri dosyaları bu düzeltmede değiştirilmedi. 43 JavaScript testi
geçti. 20 tarayıcı akışı yerel önizlemede geçti; özellikle bildirilen %15
saydamlık görünümü, kemik bağlamı, üç inceleme adımı ve tek diş dönüşü denendi.
Görsel kanıt: /tmp/dkb-context-proof/local. Bunlar anatomik uzman görüşü değildir.

Aynı 20 akış kurulu LAN servisinde de geçti; canlı kanıt: /tmp/dkb-context-proof/live.
