# Kang 2024 — diş içi araştırma örneği

Durum: **yalnız mevcut LAN içinde araştırma önizlemesi**. Akademik onay veya
public release kararı oluşturulmadı. Kaynak/türev meshler Git dışında; projeye
code/test/atıf kaydı girer. Ücretli model veya üçüncü taraf atlas kodu kopyalanmadı.

## Birincil kaynak doğrulaması

- Figshare v1: https://doi.org/10.6084/m9.figshare.24591537.v1
- API: https://api.figshare.com/v2/articles/24591537/versions/1
- Kang, Fang Fang (2024), models.zip, CC BY 4.0. Lisans API yanıtında doğrulandı.
- Makale: Shi H, Kang FF, Liu Q (2024), PeerJ 12:e17456, DOI10.7717/peerj.17456.
- Tam metin Europe PMC fullTextXML ile okundu:
  https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11285364/fullTextXML
- Arşiv SHA256: b65d9f1c13cd6758b18d4bb7630763390285460ccb262baf765edc329de4ec46
  Figshare MD5: 0a39101c181b2458a48488c75c31894d.

Makale karma dişlenmedeki 7 yaş kaynak katılımcıyı, etik kurul onayını ve veli
onamını bildiriyor. Araştırmacılar tam gelişmiş ve farklı kök gelişim modelleri
oluşturmuş. Bu nedenle kaynak CAD, değiştirilmemiş pediatrik örnek veya yetişkin
normu diye etiketlenmedi; 46.stp'nin özgül gelişim evresi ayrıca teyit bekliyor.
Çalışma için verilen onam, bizim adımıza yeni klinik kullanım/yayın onayı sayılmadı.

PDL kalınlığı yöntemlerde0.15mm, tartışmada0.2mm olarak geçer. İncelemede tutarsızlık
kaydedildi, arayüzde açıklandı; kesin kalınlık iddiası veya ölçüm aracı sunulmadı.
PDL bizim ürettiğimiz katman değil; kaynağın yapay olarak oluşturduğu CAD yüzeyidir.
Mine/dentin ayrı değil; pulpa boşluğu biyolojik pulpa dokusu/sinir/damar ağı değildir.
Açık apikal foramen ve tüm yan dallar temsil edilmiş kabul edilmez.

## Veri ve gizlilik sınırı

Arşiv6 STEP dosyası içeriyor; DICOM, CBCT hacmi veya hasta metadata dosyası yok.
Yalnız `46.stp`, `牙髓腔.stp`, `牙周膜.stp` dönüştürüldü. Ham arşiv/CAD repo dışında
geçici kaynak dizininde; HTTP ile sunulmaz. Dönüşüm yalnız koordinatlar, normaller ve
indeksleri çıkarır; CAD header/operator bilgilerini tarayıcı dosyalarına taşımaz.
Tam yüz/baş hacmi alınmadı. Bu teknik inceleme insan privacy/akademik imzası değildir.
Kamuya sunum için mevcut projenin bağımsız hak/gizlilik/akademik kapıları geçerlidir.

## Dönüşüm

`scripts/assets/extract_kang_pulp.py`: izole cadquery-ocp8.0.1.0.0 + numpy.
Tam arşiv hash'i ve kaynak mm birimi doğrulanır; CAD BRep validity kontrol edilir.
Mutlak0.025mm linear deflection,0.4rad angular deflection. Bu meshing ayarları
kaynak klinik doğruluğu veya ölçüm toleransı değildir. Altı ondalıklı koordinat
birleştirmesi, Float32 yazım ve üçgenlerden normal hesabı; smoothing/decimation,
kök oynatma, yeni kanal/doku veya anatomiye hizalama yok.

Tüm parçalar ortak koordinatlarda saklanır. Tarayıcıda bütün birleşime aynı
−90° X dönüşü ve ortak merkez ötelemesi uygulanır. Ölçek değişmez. Kesit eksenleri
örnek uzayına aittir; anatomik bukkal/lingual-mezial/distal diye adlandırılmaz.

| Parça | Üçgen | Açık / non-manifold kenar | Bağlı bileşen | CAD hacmine fark |
|---|---:|---:|---:|---:|
| Dış yüzey | 311708 | 0 / 0 | 1 | %0.01734 |
| Pulpa boşluğu | 296070 | 0 / 0 | 1 | %0.02393 |
| Şematik PDL | 380542 | 0 / 0 | 1 | %0.00730 |

Üçünde de sıfır alanlı üçgen0, kaynak noktası welding kayması0. Float32 en büyük
koordinat farkı yaklaşık9.54e-7mm. Bu değerler anatomik geçerlilik ölçütü değildir;
kendi kendine yüzey kesişimleri veya bütün katman ilişkileri uzman onayı almış sayılmaz.
Birebir kaynak/binary hashleri external manifest.json içinde tutulur.

## Tarayıcı davranışı

4 öğrenme adımı; dış yüzey saydamlığı; yalnız boşluk; üç eksenli kesit, taraf
çevirme, kesite karşıdan bakış, kapalı meshlerde stencil dolgu. Dolgu yüzeyi yeni
doku katmanı değildir. Şematik PDL varsayılan gizli. Kamera dokunma/fare/klavye
ile kontrol edilir; boşta render yapılmaz. WebGL context kaybında açık hata mesajı.

Katkı görünüm sözleşmesi `kind=tooth-interior`: kaynakID + üç yüzey hash'i + seçili
katman + kesit ekseni/konumu/tarafı + opaklık + kamera/target/up. Takip linki doğru
araştırma sayfasına döner; kaynak değişmişse eşleştirme reddedilir. Ana ağız modeli
aynı eski sözleşmeyle çalışır. Kaynaksız iç anatomi mevcut28 dişe eklenmez.

## İşletim ve geri alma

Yüzeyler `/root/.local/share/dental-research/pulp-kang-v1` altında. Parent0700;
servise yalnız bu dizin salt-okunur bağlanır. `RESEARCH_ASSET_DIR` verilmezse veri
rotaları404; sayfa yalnız kullanılamama açıklaması gösterir. Sunucu başlangıçta
hash/byte boyutu/indeks/finite koordinatları doğrulayıp Buffer snapshot'ı sunar;
diskte sonradan değiştirilmiş dosya çalışan sürece karışmaz. Yeni sürümde restart
ve yeni doğrulama gerekir. STEP/archive rotası yok. HTTP dinleyici mevcut LAN
IP3057 ile sınırlı, mevcut UFW korunur; ek halka açık domain/port yok.

Geri alma: unit'teki RESEARCH_ASSET_DIR ve bu araştırma bind satırını kaldırıp yalnız
dental-preview restart. Özel katkı kuyruğunu veya ana atlas modellerini silmeyin.
Git'ten yeni kurulumda bu isteğe bağlı kaynak dizini hazırlanmadan araştırma bind
satırları kullanılmamalı; normal atlas ayrı çalışabilir.

## Takım değerlendirmesi ve sınırlar

DeepSeek gateway tasarım eleştirisi alındı: kaynak bağları, yanlış demografik
etiketler, kesit dolgusu, PDL varsayımı, hash bütünlüğü, mobil maliyet. Tam kaynak
kod/uzman anatomi incelemesi değildi. CAD hacmi/bileşen/welding kontrolleri eklendi;
kesit dolgusunun saydamlıkta render sırası düzeltildi. Hashler startup'ta doğrulanır
ve dosya yeniden okunmadan aynı doğrulanmış bytes sunulur. İnsan onayı üretilmedi.
Gerçek telefon GPU performansı, klinik doğruluk ve uzman incelemesi henüz yok.
