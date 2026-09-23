# İlk uzman pilotu — yürütme planı

Durum: Hazır inceleme planı; davet gönderilmedi, uzman katılımı veya anatomik
onay henüz belgelenmedi. Tarih: 2026-09-22.

## Amaç ve katılımcılar

Mevcut görüntüleyicide eğitim açısından yanıltıcı noktaları ve kaynak eksiklerini
bulmak. İlk turda 3–5 insan uzman hedeflenir: dental anatomi eğiticisi,
endodonti uzmanı ve periodontoloji veya ağız/çene cerrahisi uzmanıyla farklı
inceleme alanları kapsanır. Bu sayı akademik yeterlilik veya oylama eşiği değildir.

Bakımcı adayların uzmanlığını kurumsal profil ve kişinin teyidiyle kaydeder;
inceleme alanını, çıkar çatışması beyanını ve adının yayımlanmasına ilişkin
iznini ayrıca alır. Formdaki kişinin kendi seçtiği rol yetki vermez. İlk pilot
katılımcıları otomatik olarak yayın yetkilisi veya oylama paneli üyesi olmaz.
Yetki modeli için ADR0006 geçerlidir.

## 30–45 dakikalık oturum

1. Bakımcı kullanılan commit, ilgili model manifesti ve SHA-256 değerini
   kaydeder. Cihaz, tarayıcı ve grafik modu da yazılır. İnceleme sırasında
   model sürümü değişirse yeni oturum kaydı açılır.
2. İlk 5 dakika: gezinme, katmanlar, kaynak bilgileri ve bilinen eksikler.
3. Yaklaşık 20 dakika: FDI 16/36/37, gingival sınırlar, kök–kemik ilişkileri,
   sinir/arter etiketleri; uzman yalnız yetkin olduğu alanları değerlendirir.
4. Yaklaşık 10 dakika: ayrı diş içi örneği, kesitlerin anlamı ve iki farklı
   kaynağın aynı örnek sanılmasına yol açabilecek sunum sorunları.
5. Son 5–10 dakika: bulguların tekrarı, öncelik ve eksik kaynaklar.

Tam kontrol listesi [EXPERT-REVIEW-PACK.md](EXPERT-REVIEW-PACK.md) içindedir.
28 dişin tamamı incelenmeden tüm dentisyon incelendi denmez. Süre yetmezse
kalan yapılar açıkça “incelenmedi” işaretlenir.

## Bir bulgu, bir kayıt

Aşağıdaki şablon elle doldurulabilir. Mevcut katkı formu kullanılabiliyorsa
gözlem/öncelik/gerekçe açıklamaya, beklenen ilişki beklenen sonuç alanına,
kaynaklar kaynak bağlantılarına yazılır. Form kamera ve model bağlamını yakalar;
inceleyen kayıt öncesi doğru yapı ve görünümün seçili olduğunu kontrol eder.
Yeni bir backend tamamlanması bu pilotun ön koşulu değildir.

```text
Bulgu kimliği / tarih:
İnceleyen / uzmanlık / uzmanlık teyidi kaydına özel referans:
Commit / kaynak örneği / manifest SHA-256:
Yapı / FDI (bağımsız örnekte bilinmiyorsa bilinmiyor):
Bakış açısı / çene / katmanlar / saydamlık / tekrar adımları:
Beklenen anatomi ve dayanak (eser, sayfa/şekil veya DOI/URL):
Gözlenen sapma ve kimlik bilgisi içermeyen görüntü:
Olası köken: kaynak / dönüşüm / sunum / belirsiz
Etki: eğitim yayınını engeller / açıklamayla kullanılabilir / küçük düzeltme
Etkinin gerekçesi ve hangi kullanım için geçerli olduğu:
Önerilen düzeltme / belirsizlik / ek kaynak ihtiyacı:
Yeniden inceleme: sürüm, inceleyen, sonuç, tarih
Kamuya aktarım izni: bulgu metni / görünen ad (ayrı ayrı)
```

Kaynak bulguyu desteklemiyorsa bunu açıkça yazın; biçimin alışılmadık olması
tek başına hata kanıtı değildir. Anatomik varyasyon ile geometri hatasını
ayırt edemeyen bulgu “belirsiz” kalır. Hasta bilgisi veya ham klinik veri alınmaz.

## Koordinasyon ve çıkış koşulu

Bakımcı özel bir takip listesinde davet, katılım, inceleme kapsamı, bulgu kimliği,
sorumlu ve sonraki adımı tutar. Davet veya kişisel görüşler izinsiz yayımlanmaz.
Görüş, tartışma ve kararlar kendi platformumuzda tutulur; GitHub'a aktarılmaz.
GitHub yalnız kod yönetiminde kullanılır. Portal ve denetim tasarımı ADR0007'dedir.

İlk turun çıktısı: kapsam matrisi (incelendi/incelenmedi), gerekçeli bulgu listesi,
tekrarlanabilen engelleyici sorunlar ve TASK-005/006 için gerçek örneklerdir.
Görüş ayrılıkları kaynaklarıyla korunur. Çoğunluk, kaynak eksikliğini gidermez;
bu pilotta oy oranıyla anatomik doğruluk ilan edilmez. Düzeltmeler yeni sürümde
yeniden incelenir. Genel eğitim yayınına geçiş ayrı yayın kararı gerektirir.

## Erişim durumu ve pilot kanalı

2026-09-22 işletim kontrolü: servis LAN IP'si `192.168.1.192:3057` üzerinde;
UFW'de 3057 için geçici genel erişim izni var. Kullanıcı
`http://85.96.191.197:3057` üzerinden dış erişim bildirdi. Bu oturumda bağımsız
bir dış ağdan erişim veya modem yönlendirmesi doğrulanmadı. Dental için Nginx
reverse proxy yapılandırması bulunmadı; doğrudan HTTP, HTTPS yayını değildir.

Katkı servisinin `PREVIEW_ORIGIN` değeri hâlâ
`http://192.168.1.192:3057`. Host/Origin kontrolü dış IP üzerinden katkı
isteklerini reddeder; atlasın açılması katkı gönderiminin çalıştığını göstermez.
Bu kontrolü kaldırmak çözüm değildir. Mevcut pilot LAN üzerinde veya bakımcı
eşliğinde ekran paylaşımı ve bu şablonla yürütülebilir; dışarıdan bağımsız
katılım için önce HTTPS ve kesin public origin yapılandırılmalı, gönderim ve
özel takip akışı aynı origin üzerinden doğrulanmalıdır. Genel HTTP üzerinden
özel takip anahtarları taşınmamalıdır. Güvenli kamuya açılma koşulları
CONTRIB-002 kapsamındadır.

## Davet taslağı — henüz gönderilmedi

“Açık dental anatomi projemizin kaynak tabanlı 3B önizlemesini, uzmanlık alanınız
çerçevesinde 30–45 dakikalık bir oturumda değerlendirmenizi rica ediyoruz.
Bu bir ürün onayı talebi değildir. Özellikle anatomik sapmaları, sunumun yanlış
anlaşılabildiği noktaları ve eksik kaynakları kaydetmek istiyoruz. Bağımsız diş
içi araştırma örneği ağız modelinden ayrı değerlendiriliyor. Görüşünüzün ve
adınızın yayımlanması için ayrıca izin isteyeceğiz.”
