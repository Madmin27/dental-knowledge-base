# ADR 0006 — Varyasyon bağlamı ve gerekçeli inceleme

Durum: Kullanıcının varyasyon/gerekçeli karar yönlendirmesine göre kabul edilen
veri sözleşmesi; akademik yetki, portal ve yayın entegrasyonu henüz tamamlanmadı.
Tarih: 2026-09-22. ADR0005 özel katkı kuyruğu ayrı kalır.

## Değişmez ilke

Tek bir evrensel ağız modeli hedeflenmez. Örnek, anatomik varyasyon, bilimsel
iddia ve dağıtılan mesh ayrı kimlikler taşır. Yeni varyasyon önceki örneği silmez;
normal varyasyon, gelişimsel durum, patoloji ve kaynak/modelleme hatası ayrılır.
Bir grupta gözlenmiş olmak, o grubun tamamını temsil etmek değildir.

## Veri sözleşmesi v1

`packages/contracts/anatomical-review.mjs` çalıştırılabilir doğrulama sınırıdır.

- Profile: opaque ID, revision, anatomik sınıf, temsil türü (kaynak örnek/eğitim
  bileşimi/sentetik test), kanıt ve claim referansları, tam asset SHA-256 değerleri.
- Yaş: ay cinsinden min/max aralık, belirleme yöntemi ve kaynak; bilinmiyorsa null.
  Doğum tarihi veya kişi kimliği bu açık eğitim profiline konmaz.
- Kaynağın bildirdiği biyolojik cinsiyet: değer, kayıt yöntemi ve kanıt; yoksa null.
  Cinsiyet kimliğiyle veya geometri üzerinden tahminle karıştırılmaz.
- Dişlenme: sürme öncesi, süt, karma, kalıcı, dişsiz veya bilinmiyor. Takvim yaşından
  otomatik türetilmez. Süt ve kalıcı FDI aynı profilde bulunabilir. Sürme ve kök
  gelişimi/rezorpsiyonu diş başına tutulur. Pediatrik model yetişkinin ölçeklenmişi değildir.
- Diş durumu: mevcut, sürmemiş, çekilmiş, doğuştan yok, varlık dosyasında yok,
  bilinmiyor. Son iki durum klinik yokluk iddiası değildir. Üçüncü azı kaynakta yoksa
  kişide doğuştan yokmuş gibi gösterilmez. Süpernümerer yapı kimliği FDI'ye zorlanmaz;
  ontology opaque structure ID + traits kullanılır, FDI varsa ikincil eşlemedir.
- Morfoloji: yapı kimliğine bağlı açıklama ve kanıt; kök sayısı, kanal tipi,
  şekil/asimetri gibi özelliklerin ileride kontrollü ontology eşlemesi yapılır.
- Kapsam: mevcut yapılar, gösterilemeyen yapılar ve nedenleri. Dış yüzey incelemesi
  pulpa/kanal incelemesi veya tüm anatomik doğruluk onayı sayılmaz.
- Popülasyon betimleyicileri: vatandaşlık, kişinin bildirdiği etnik tanım, örneklem
  coğrafyası ve raporlanmış köken ayrı boyutlardır. Tanım, nasıl kaydedildiği ve
  kaynak zorunlu. Türk/Arap/İspanyol/Güney Amerika tek bir biyolojik sınıflandırma
  listesine sıkıştırılmaz. Karma, çoklu, belirtilmemiş tanımlar desteklenir.
- Popülasyon iddiası: ayrı claim ID; çalışmanın evreni, tasarımı, örnekleme yöntemi,
  örnek sayısı, gözlenen sayı, belirsizlik, sınırlılıklar ve kanıt. Tek örnekten
  sıklık iddiası geçmez. İki örnek yapısal alt sınırdır, bilimsel yeterlilik değildir.
  Örneklem oranı kendiliğinden toplum prevalansı değildir; bu genellenebilirlik
  iddiası ayrıca uzman değerlendirmesi gerektirir. Cinsiyet/yaş ilişkisi de böyledir.

Eksik demografi mevcut kaynak modeline tahminle eklenmez. Birden çok filtreye
uyan doğrulanmış varlık yoksa arayüz "doğrulanmış örnek yok" der; araları otomatik
morph/interpolation ile doldurmaz. Sentetik/eğitim bileşimi kaynak örnekmiş gibi
sunulmaz. Aynı yaş/cinsiyet/köken etiketinde birçok farklı varyasyon bulunabilir.

## Denetmenin gerekçeli kayıtları

Her karar belirli profil revision/digest, asset hashleri ve rubric sürümüne bağlıdır.
Rubric: kaynak izlenebilirliği, anatomik ilişkiler, varyasyon kapsamı, gelişimsel
bağlam, gösterim sınırlılıkları ve eğitim kullanımına uygunluk. Her başlıkta sonuç
(pass/fail/not_assessed/not_applicable), gerekçe ve kanıt referansları tutulur.
Genel karar, geçerli olduğu kullanım/kapsam, sınırlılıklar ve çıkar çatışması
beyanı zorunludur. Zorunlu ölçüt atlanarak APPROVE önerisi oluşturulamaz.

Örnek gerekçe biçimi (gerçek onay değildir): "Bu sürüm, belirtilen kaynaklarla
uyumlu bir kök dış biçimi varyasyonu olarak eğitim karşılaştırmasına uygundur;
pulpa yapısını ve toplumdaki sıklığını doğrulamaz."

`createReviewDossier` yalnız veri doğrular; authorizationGranted=false döner.
Kimlik/uzmanlık doğrulamaz, bir oy saymaz, bilimsel kabul veya yayın yapmaz.
Gerçek yetkili bağdaştırıcı reviewerId ve sunucu zamanını sağlamalıdır. Yeni model,
kapsam veya sınırlılık değişikliği eski imzayı yeni sürüme taşımaz. Düzeltme ve
itiraz kayıtları append-only tutulur; eski gerekçe silinmez. İtiraz, yeniden inceleme,
supersession ve geri çekme domain motoruyla bağlanmalıdır.

## Kullanıcının kabul ettiği %80 karar politikası: bağlayıcı tasarım

Bu ADR, uygulama motoru kurulurken aşağıdaki politikanın sürümlenmesini gerektirir:
- Heyet oylamadan önce dondurulur: ilgili alanda doğrulanmış, bu kapsama yetkili,
  çıkar çatışması bulunmayan kişiler. Yazar kendi değişikliğinin kabul oyunu kullanmaz.
- Onay eşiği `ceil(0.8 * eligible_roster_size)`. Örneğin 5 kişide 4, 3 kişide 3.
  Çekimser/yanıtsız kişiler onay değildir ve sonuçtan sonra paydadan çıkarılmaz.
- Akademik değişiklik için mevcut minimum uzman/kurum şartları korunur; canonical
  değişiklikte en az 3 ilgili uzman, 2 kurum ve alan editörü onayı gerekir.
- Gerekçeli önemli bilimsel itiraz çözülmediyse çoğunluk otomatik kabul üretmez.
  Editör itiraz değerlendirmesini ayrıca kaydeder; DISPUTED yolu korunur.
- Süresi dolan/geri alınan yetki ya da yeni çıkar çatışması varsa heyet ve oylama
  yeni sürümle yeniden açılır. Geçmiş oylar silinmez, uygun olmayan oy sayılmaz.
- Hak/lisans, gizlilik ve teknik kalite kapıları bağımsızdır; %100 akademik oy bile
  bunları geçersiz kılamaz. AI değerlendirmesi oy veya insan imzası değildir.
- Görünen kayıt: karar/kapsam, n/N (%), olumlu/olumsuz/çekimser/yanıtsız sayıları,
  açıklamalar, kanıtlar, model/politika sürümü ve tarih. Yüzde anatomik doğruluk değildir.
  Denetmen adı/kurumu yayımlanmadan açık onay alınır. Yayınlanmayan kimlik de içeride
  doğrulanabilir ve denetlenebilir kalmalıdır; anonimlik sahte uzmanlık yaratmaz.

## Ekip kurma ve yetki yaşam döngüsü

Önce 2 kurumdan 3–5 kurucu aday: diş anatomisi, endodonti, pediatrik diş hekimliği
alanlarında rol/kapsam ihtiyacına göre. Kurumsal profil/yayın ve kurum doğrulaması
kayıt edilir; ORCID veya unvan tek başına yetki değildir. İlk editör proje sahibi
ve belgeli doğrulamayla atanır; sonraki hakemler iki yetkili insanın kayıtlı kararıyla.
Yetki kayıtlarında alan/yapı grubu, izin verilen eylem, başlangıç-bitiş, veren kişi,
dayandırılan doğrulama ve iptal nedeni bulunur. GitHub write veya sistem admin
yetkisi akademik imza vermez. Pediatrik değişiklik pediatrik yetkinlik gerektirir.
Kurul bulunana kadar içerik "uzman incelemesi bekliyor" olarak kalır.

## Uygulama sırası ve kabul sınırı

1. TASK-005: bu sözleşmeleri specimen/variant/claim/evidence ve immutable revision
   deposuna bağla; demografik bilginin belirsizliğini ve kaynak izini koru.
2. TASK-006: doğrulanmış yetki, dondurulmuş heyet, %80 + quorum + itiraz motoru;
   yetkisiz, süresi dolmuş, kendi değişikliğine oy ve yanlış uzmanlık testleri.
3. TASK-011: kriter kriter gerekçe formu, varyasyon karşılaştırma ve karar kartı;
   açık rıza ve reviewer gizlilik alanları. Kanıt yokken kabul düğmesi etkinleşmez.
4. GitHub koordinasyonu: özel bildirimden yayın izni verilmiş özetin issue taslağı;
   inceleyen kendi hesabından açar, URL bağlanır. Capability link/key, özel metin,
   hasta/kimlik verisi taşınmaz. Issue kapanması bilimsel kabul değildir.
5. Yayın: ayrı hak/gizlilik/QC kapıları, sürümlü release ve geri çekme. Yeni çocuk/
   yaş/cinsiyet/popülasyon koleksiyonları ancak gerçek kaynak ve bu incelemeyle.

Bu tur yalnız sözleşme kodu ve testleri uygulandı. DB migration, hakem hesabı,
otomatik %80 oylama, GitHub entegrasyonu veya yeni anatomik modeller kurulmuş sayılmaz.

## Araştırma dayanağı

- AAPD: https://www.aapd.org/globalassets/media/policies_guidelines/bp_developdentition.pdf?v=new
  Dişlenme ve gelişim aşamalarının ayrılması; bu sözleşme yaşa bakıp aşama tahmin etmez.
- National Academies: https://www.nationalacademies.org/read/26902/chapter/9
  Popülasyon tanımlarının bağlama göre ayrılması. Kaynak genomik araştırma içindir;
  dental atlas veri tasarımına uyarlama bizim tasarım çıkarımımızdır, belirli bir
  topluluğun diş anatomisi hakkında bilimsel sonuç olarak kullanılmaz.
