# Akimoto atlası — tarayıcı incelemesi, 2026-09-22

Kullanıcının verdiği https://dental-atlas-akimoto.m-akimoto.chatgpt.site/ adresi
izole Chrome ile incelendi. Web metin aracı erişemedi; HTTP + gerçek tarayıcı ile
sayfa ve görünür açıklamalar okundu. Ana sayfa ilk görüntüde 265/372 yükleniyordu;
bütün 372 yapının yüklenmesi, quiz ve animasyonların doğruluğu doğrulanmış sayılmaz.
Diş içi ve periodontal sayfalar açıldı; diş içi kök enine kesit düğmesi denendi.

## Gözlemler

- Ana atlas kendi atıflarında BodyParts3D / Z-Anatomy kullanıyor. Bizim kaynak
  ailemizle aynı; birebir aynı geometri/sürüm olduğu doğrulanmadı.
- Arayüz 372 yapı: kemik, diş, kas, sinir, arter, ven, bez ve diğer gruplar.
  Arama, seçili yapıyı yalnız göster/gizle/odak, grup opaklığı, kesit ayarları,
  hasta yön referansı, kaynaklı landmark açıklamaları var.
- Kas başlangıç/sonlanma, karşılaştırma, öğrenme kursları ve quiz kontrolleri
  bulunuyor. Bunların tamamı uçtan uca test edilmedi.
- Hareketler açıkça şematik; kas renklerinin kas gücü/EMG olmadığı belirtiliyor.
  Eğitim modeli henüz uzman denetimi görmemiş olarak etiketlenmiş. Görsellik
  anatomik onay veya fiziksel simülasyon kanıtı değildir.

## Diş içi kaynak adayı — en yararlı bulgu

Sayfa: https://dental-atlas-akimoto.m-akimoto.chatgpt.site/pulp.html
Kayıt: https://dental-atlas-akimoto.m-akimoto.chatgpt.site/research/pulp/manifest.json
Özgün veri: https://doi.org/10.6084/m9.figshare.24591537.v1
API doğrulaması: https://api.figshare.com/v2/articles/24591537/versions/1
Makale: https://pubmed.ncbi.nlm.nih.gov/39076773/ (DOI 10.7717/peerj.17456).

Figshare API doğrudan kontrol edildi: models.zip, Fang Fang Kang, CC BY 4.0,
finite-element-study models. Makale kaydı Shi, Kang ve Liu (2024), mandibular
ilk kalıcı molar/yer tutucu sonlu eleman çalışması olarak eşleşiyor. Tam makale
bu incelemede erişim engeli nedeniyle okunamadı; yöntem bağımsız doğrulaması bekler.

Akimoto kendi dönüşüm kaydında 46.stp, pulpa boşluğu ve PDL STEP yüzeylerini ortak
koordinatlarda tessellation ile aktardığını söylüyor. Görselde tek dişin dış yüzeyi
ve iç boşluğu birlikte görüldü; kök enine kesit preset'i kesiti etkinleştirdi.

**Sitenin kendi kapsam açıklaması**: çocuk CBCT'sinden değiştirilmiş araştırma
modeli, yetişkin standart dişi değil; PDL 0.15 mm şematik katman; ayrı mine/dentin
segmentasyonu yok; kanal uçları kapalı; apikal açıklık, tüm dallar, damar ve sinir
ayrıntıları yok. Ana atlasın 28 dişine kayıt/hizalama yapılmamış. Manifestteki
0.015 mm tessellation toleransı klinik doğruluk değildir. Bu iddialar henüz bizim
özgün CAD/çalışma üzerinden bağımsız doğrulamamız değildir.

Karar: ayrı, açıkça sınırlanmış bir "araştırma örneği — diş içi" modülü için güçlü
aday. Ana yetişkin dişlerin içine aynı pulpayı ölçekleyip yerleştirmeyin. Önce özgün
veri ve makale, hak/gizlilik değerlendirmesi, mesh/topoloji ve dönüşüm incelemesi;
sonra ayrı asset lineage + inceleme. Bu tur klinik hacim/CAD/model arşivi alınmadı,
üçüncü taraf JS/model uygulamaya kopyalanmadı; yalnız site kaynakları incelendi.

## Periodontal örnek

https://dental-atlas-akimoto.m-akimoto.chatgpt.site/periodontium.html
Kaynak olarak https://data.mendeley.com/datasets/xjsx7nfhj8/1 gösteriliyor.
Diş, PDL, kortikal/trabeküler kemik katmanları ve ayrı diş seçimi var. Sayfa PDL'nin
0.25 mm şematik katman olduğunu, kaynakta yerel kayma/örtüşme bulunduğunu açıkça
söylüyor. Dolayısıyla bu görünüm de gerçek PDL kalınlığının ölçümü sayılamaz.
Mendeley özgün lisans/veri içeriği bu tur bağımsız doğrulanmadı; aday durumundadır.

## Bizim atlas için öncelik

1. Bağımsız, kaynaklı diş içi örneği; aynı koordinatta dış yüzey + boşluk + kesit.
2. Mevcut gerçek yüzeylerde kesit düzlemi; kesit doldurmanın doku icat etmediğinin
   açık ayrımı, açık/kapalı mesh davranışı ve kaynak geometri bütünlüğü testleri.
3. Yapı arama, izole etme ve kaynaklı kısa açıklama; öğrenme adımları/karşılaştırma.
4. Landmark ve kas eklemeleri yalnız özgün kaynak/hak/kapsam incelemesinden sonra.
5. Hareket modülü en son; şematik gösterim ile biyomekanik doğruluğu ayırın.

Mevcut hizmet/model veya DB değiştirilmedi. İnceleme, üçüncü taraf atlasın uzman
onayı veya mevcut kaynaklarının tümünün yeniden dağıtım izni anlamına gelmez.
Görsel kanıtlar yerel /tmp/dkb-akimoto/ altında; uygulamaya dahil edilmedi.
