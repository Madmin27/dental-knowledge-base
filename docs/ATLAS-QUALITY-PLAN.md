# Öğrenci atlası kalite ve kabul planı

2026-09-22. Kullanıcı kaynak modelin görünümünü önceki sürüme göre kabul etti;
nihai akademik yayını veya her anatomik ayrıntıyı onayladığı varsayılmıyor.
Bu plan mevcut mimarinin hak, gizlilik ve uzman incelemesi kapılarını değiştirmez.

## 1. Katmanlarla inceleme — bu değişiklik

- [x] Diş eti saydamlığı %0–100; kökler diş etiyle birlikte görülebilir.
- [x] Kemik için bağımsız saydamlık; sinir/atardamar için ayrı anahtarlar.
- [x] Tek düğmeyle kök, sinir ve damar görünümü.
- [x] Kaynaktan alt alveolar, mental ve maksiller sinirler; dört çift atardamar.
- [x] Katmanlar açıkken kaynak çene konumu korunur; yapay hareket uygulanmaz.
- [x] Üst/alt çene filtreleri ve tek diş görünümü tutarlı; eksik diş içi ağ açıklanır.
- [x] Saydam yüzeyler kökleri görünmez kılmaz ve opak gölge bırakmaz; opaklığa dönüş.
- [x] Masaüstü/mobil görünüm, kaynak bütünlüğü ve etkileşim testleri.

Kabul kanıtı: /tmp/dkb-tissue-review/proof. Kaynak yüzeylerin görünür olması,
anatomik doğruluğa insan uzman onayı verildiği anlamına gelmez. Saydam yüzeylerin
karmaşık üst üste binmelerinde standart WebGL sıralama sınırları devam eder.

## 2. Öğretim doğruluğu — yayın öncesi zorunlu

- [ ] İsimli diş anatomisi uzmanının örnek incelemesi: FDI 16/36/37, kron yüzeyi,
  kök dallanması, diş eti sınırı, sağ/sol ve diş-çene ilişkileri.
- [ ] Her sinir/atardamarın kaynaktaki adı, konumu ve devamlılığı doğrulanır.
  Yüzeylerin yakın durması gerçek bağlantı veya dişe giriş kanıtı sayılmaz.
- [ ] Gerçek pulpa/dentin/kök kanalı katmanları olan açık lisanslı bir örnek seçilir.
  Farklı bağışçı/veri setleri tek kişiye aitmiş gibi kaynaştırılmaz.
- [ ] Kaynak belirsizlikleri, patoloji/yaş farkları ve gösterilmeyen dallar kayıtlanır.
- [ ] Uzman bulguları düzeltildikten sonra hak ve akademik kararlar mevcut sisteme
  kaydedilir. AI veya tarayıcı testi uzman imzası yerine geçmez.

İlk içerik hedefi tüm ağza hayalî kanallar eklemek değil; önce güvenilir bir azı
dişinin kayıtlı dış ve iç yapısını birlikte gösterebilmektir.

## 3. Öğrenci kullanım kalitesi

- [ ] Türkçe/Latince yapı isimleri ve uzman doğrulamalı kısa açıklamalar.
- [ ] Yön işaretleri model döndükçe doğru kalır; görünüm/kamera kaydetme.
- [ ] Katmanları tek tek tanıma alıştırması; yanıtlar kaynaklıdır.
- [ ] Gerçek bir telefon ve öğrenci bilgisayarında kabul denemesi. Hedef 30 FPS
  etkileşim, 10 Mbps ağda 10 saniye içinde kullanılabilir ilk görünüm; ölçülmeden
  geçti sayılmaz. Gerektiğinde indirilebilir düşük ayrıntı düzeyi hazırlanır.
- [ ] Klavye/dokunma erişimi, yükleme hatası ve WebGL kaybı için kullanılabilirlik.

## 4. Kamuya eğitim yayını

- [ ] Varlık bazında atıf, türev lisans, indirme ve hak inceleme kayıtları tamam.
- [ ] Kaynak/derivative hashleri, sürüm, uzman kararı ve geri alma noktası bağlı.
- [ ] İçerik kapsamı ve sınırları öğrencinin anlayacağı biçimde görünür.
- [ ] Kamuya açık adres/HTTPS ve yayın kabulü tamam; şu an yalnız mevcut LAN adresi.

"Mükemmel" etiketi yerine bu somut kabul koşulları izlenir. Kaynakta olmayan
mikroskobik damarlar, toplardamar ağı veya yaşa/cinsiyete özgü doğruluk iddiası
ışıklandırma, renk veya yapay geometriyle tamamlanmış sayılmaz.

## Kök uçlarının açıkta görünmesi — düzeltme ve kabul

Kullanıcının %15 diş eti saydamlığında bildirdiği görünüm ayrıca test edildi.
Varsayılan artık kaynak konumunda diş–diş eti–kemik birleşimidir. Kök incelemesinde
kemik katmanı kapatılamaz; görünürlüğü en az %15 korunur. Diş eti saydamlığı
kemiği de kademeli saydamlaştırır; kemik sürgüsü ayrıca kullanılabilir. Bu bir
sunum düzeltmesidir; kaynak geometrinin olası anatomik kusurlarını gidermiş sayılmaz.
Kök kısaltma, diş eti şişirme, sahte doku, kaynaklar arası uydurma bağlantı yapılmadı.

Üç yönlendirmeli inceleme adımı ve görünümün kapsamını açıklayan kalıcı metin
eklendi. Somut uzman inceleme senaryoları ve bulgu formu:
`docs/EXPERT-REVIEW-PACK.md`. İnsan incelemesi bekleyen maddeler işaretli kalır;
otomatik test sayısı akademik kabulün yerine geçmez.
