# ADR 0007 — Kendi sunucumuzda katkı ve akademik yönetişim

Tarih: 2026-09-23. Karar: Kullanıcı yönlendirmesiyle GitHub yalnız kod,
commit, test ve dağıtım geliştirmesinde kullanılacak. Akademik katkılar,
tartışmalar, şerhler, heyetler, oylar ve kararlar platformda tutulacak.
ADR0006'nın GitHub koordinasyonu adımı kaldırılır; diğer bilimsel ilkeleri sürer.
Durum: Mimari ve ürün tasarımı. Portal, kimlik servisi ve oylama henüz kurulmadı.

## Birincil kayıt ve kapsam

Katılımcının tek çalışma yeri Dental Open Source olur. GitHub hesabı gerekmez;
katkı aktarımı, issue senkronizasyonu veya GitHub üzerinde akademik oylama yoktur.
Git deposuna kişisel görüşler, gerçek oylar, uzmanlık belgeleri ve özel takip
anahtarları konmaz. Kod değişikliği kamuya açık karar kimliğine atıf yapabilir.
Bilimsel gerekçe platformda kalır; herkese açık kod commitlerine özel içerik taşınmaz.

Katkı → ön inceleme → kanıt/tartışma → uzman incelemesi → gerekçeli karar →
ayrı yayın kontrolü akışı izlenir. Her katkının oylamaya gitmesi gerekmez:
kullanım sorusu, yinelenen bildirim veya yazım düzeltmesi ilgili akışa yönelir.
Benzer kayıtlar bağlantıyla birleştirilir, katkı sahibinin izi kaybolmaz.

## Hesap ve yetki

Hesap kimliği ile akademik yetki ayrı tablolardır. Başlangıçta davetli pilot;
genel kayıt daha sonra spam/abuse kontrolleriyle açılır. Hesap için doğrulanmış
iletişim, güvenilir oturum yönetimi ve kurtarma gerekir. Kurum e-postası,
profesör unvanı veya ORCID tek başına inceleme/yayın yetkisi vermez.

Kimlik için kendi sunucumuzda bakımı yapılan OIDC sağlayıcısı kullanılacak;
Keycloak ilk teknik adaydır. Kurulum öncesi kaynak tüketimi, sürüm, lisans ve
kurtarma akışı doğrulanacak. Parola/MFA altyapısı sıfırdan yazılmayacak.
Uygulama OIDC issuer+subject'i kendi sabit kullanıcı kimliğine bağlar.

| Rol | Yetki ve sınır |
| --- | --- |
| Katılımcı | Katkı, kaynak, tartışma, ek açıklama ve itiraz; akademik kabul oyu yok |
| Moderatör | Ön inceleme, görünürlük, kişisel bilgi/spam kontrolü ve yönlendirme; bilimsel onay yok |
| Alan denetmeni | Doğrulanmış uzmanlık ve verilen kapsam/süre içinde kriterli değerlendirme ve oy |
| Alan editörü | Heyet oluşturma, gerekçeli itiraz değerlendirmesi ve karar işlemleri; eşiği aşma yetkisi yok |
| Hak/gizlilik sorumlusu | Kendi kapısının kararı; anatomik çoğunluğun yerine geçmez |
| Sistem yöneticisi | İşletim; kendiliğinden akademik yetki kazanmaz |

Yetki kaydı uzmanlık kanıtı, kapsam, başlangıç/bitiş, verenler ve iptal gerekçesi
taşır. İlk editör belgeli doğrulamayla atanır; sonraki denetmen atamaları iki
yetkili insanla kaydedilir. Kişi kendi değişikliğini onaylayamaz. MFA, ayrıcalıklı
rollerde zorunlu; yetki verme, son karar ve hesap kurtarmada yeniden doğrulama
gerekir. Kurtarma akademik yetki kontrollerini atlayamaz. Paylaşılan admin hesabı yok.

Eski özel takip bağlantıları uzman kimliği değildir. Sahibi, mevcut anahtarını
sunup doğrulanmış hesabına kaydı bağlayabilir; salt ad eşleşmesiyle sahiplik verilmez.
Yeni portalda hesabı olmadan gelen ön bildirimler inceleme oyuna dönüşmez.

## Oylama, şerh ve itiraz kuralları

ADR0006'nın %80 politikası korunur. Oylama açılırken kaynak/model hashleri,
claim revision, kanıt seti revision, kapsam, rubric, politika, heyet ve son tarih
tek snapshot olarak dondurulur. Sonuç işlemi sunucu zamanı ve DB transaction ile
yapılır; istemciden gelen yetki, tarih, yüzde veya kimlik kabul edilmez.

1. Akademik kabul için gereken onay `ceil(0.8*N)`; N dondurulmuş uygun heyettir.
   Canonical değişiklikte en az 3 ilgili uzman, 2 kurum ve ayrı alan editörü
   onayı gerekir. Alan editörünün kapı onayı ikinci bir heyet oyu sayılmaz.
2. APPROVE, REQUEST_CHANGES, REJECT ve ABSTAIN ayrı sayılır. Yanıtsız da görünür.
   Çekimser ve yanıtsız paydada kalır. 4 onay/5 kişi = %80; 4 onay/6 kişi = %66,7.
   Arayüz yüzdeyi bilimsel doğruluk veya popülasyon oranı diye göstermez.
3. Her oy gerekçe, ölçütler, kanıt, kapsam ve sınırlılık içerir. Zorunlu ölçüt
   incelenmemişse APPROVE verilemez. Destek/like sayısı uzman oyu değildir.
4. Son tarihe kadar oy düzeltilebilir; eski kayıt korunur, snapshot başına
   kişinin son geçerli oyu sayılır. Son tarihten sonra oy eklenmez. Eşik erken
   geçilse bile oylama kapanmadan karar kesinleşmez. Süre sonunda eşik eksikse
   sonuç 'yeterli onay yok'; bilimsel ret ile karıştırılmaz.
5. Yetki iptali, çıkar çatışması veya heyet değişikliği turu durdurur. Yeni
   snapshot/tur açılır; payda küçültülerek sonuca gidilmez. Önceki oylar yeniden
   onay olmadan taşınmaz. Kaynak, kanıt seti, kapsam veya rubric değişince de
   yeni tur gerekir. Tarih değişikliği sessiz yapılamaz; yeniden açılış kaydı gerekir.
6. Şerh, gerekçeli katılmama kaydıdır ve azınlıkta kalsa da korunur. Önemli
   bilimsel itiraz ayrı bir kayıttır: iddia, etkilenen yapı/sürüm, dayanak ve
   etkisi belirtilir. Eksik dayanak varsa otomatik spam sayılmaz; ek bilgi istenir.
7. İtirazın önemini çatışmasız alan editörü ve bağımsız ilgili uzman gerekçeyle
   değerlendirir. Maddi anatomi hatası, desteklenmeyen genelleme veya yanıltıcı
   eğitim sonucu örnek ölçütlerdir. Önemli itiraz çözülmeden %100 bile kabul
   üretmez. Uyuşmazlık DISPUTED olarak kalır; editör gerekçesiz veto silemez.
8. Karara itiraz, ilk kararın editörü/heyetinden bağımsız ve aynı uzmanlık
   yeterliliğini taşıyan kurulca ele alınır. Uygun kurul yoksa 'bağımsız inceleme
   bekleniyor' görünür. Eski kararın üstüne yazılmaz; yeni karar bağlantıyla eklenir.
9. Akademik kabul sonrasında hak/lisans, gizlilik ve teknik kalite kapıları ayrı
   tamamlanır. Bir karara dayanarak birden fazla sürüm sessizce yayımlanamaz.
   Sonradan ciddi sorun çıkarsa geri çekme ve uyarı geçmişi görünür kalır.

Oylama sırasında diğer oyların toplu sonucu heyete gösterilmez; tartışma ve
kanıtlar görünürdür. Kapanışta sayılar ve gerekçeler yayımlama politikasıyla
görünür olur. Bu, grup baskısını azaltmaya yönelik proje tasarım kararıdır.
Denetmen adının kamuya gösterimi ayrı izin taşır; içeride kimliği her zaman
denetlenebilir. İzni olmayanlar için 'doğrulanmış denetmen R-…' gibi sabit etiket
kullanılır. İsim gösterimini geri çekmek oyu geçmişten silmez.

## Tartışma ve görünürlük

Özel ön bildirim, heyet çalışma alanı ve kamuya açık tartışma ayrı erişim
alanlarıdır. Başka alana taşıma açık bir yayın işlemi ve metin önizlemesi gerektirir.
Katılımcıya katkısının kimlere görüneceği gönderimden önce anlatılır.
Mevcut saklama onayı kamuya yayın onayı yerine kullanılmaz.

Her başlık bir yapı/iddia/sürüme bağlanır. Yanıt, kaynak, öneri, bilimsel şerh
ve moderasyon işlemi ayrı türlerdir. Düzenlemeler sürümlenir; diğer katılımcının
sözleri değiştirilemez. Yalnız sıralı akış ve bir düzey yanıtla başlanır.
İlk sürüm metin ve kaynak bağlantısı alır; hasta dosyası/görüntü yüklemez.
Kaynak URL'leri sunucuda kendiliğinden açılmaz. Kamuya açık, maskelenmiş görünüm
ayrı sorguyla üretilir; özel JSON'un alanlarını tarayıcıda gizlemek yeterli değildir.

Gizlilik nedeniyle kaldırılan metin erişimden ve uygulanabilir yedek saklama
döngüsünden çıkarılır. Değişmez audit içine özel metnin kopyası yazılmaz;
kim/ne zaman/hangi gerekçeyle kaldırdı bilgisi kalır. Veri saklama süreleri
kayıt türüne göre yazılılaştırılır; eski katkı politikasının 90 günlük metin
kuralı uzun ömürlü akademik kararlara otomatik uygulanmaz.

## Mimari ve taşınabilirlik

Başlangıç: Node uygulamasında modülleri ayrılmış tek backend, PostgreSQL,
ayrı kimlik servisi ve bildirim işçisi. Portal aynı tasarım sistemini kullanır.
Genel forum ürünü eklemek yerine değerlendirme için gereken tartışma kurulur;
aksi halde forum yetkisi ile akademik yetki arasında ikinci bir doğruluk kaynağı oluşur.

Veri grupları: accounts/identity links; credentials; scoped grants; contributions
ve revisions; discussions/posts/revisions; evidence links; review rounds ve
roster snapshots; rubric assessments; ballot revisions; objections/resolutions;
decisions/appeals; publication consents; moderation actions; audit; notification
outbox. Mevcut contributors/claims/audit tablolarıyla kimlik eşlemesi korunur.
Mevcut immutable contributors.display_name tasarımı kişisel veri bakımından
migration öncesi ele alınır: özel profil verisi silinebilir ayrı depoya alınır,
audit sabit opaque ID tutar. Tarih tablolarına gelişigüzel kişisel veri eklenmez.

Oy, yetki kontrolü, yeni revision ve audit aynı transaction içinde yazılır;
stale revision 409 döndürür. `(round, reviewer, revision)` benzersizliği ve
idempotency key tekrar isteklerin çift oy üretmesini önler. Kapanış ve oy yarışı
aynı tur kilidiyle çözülür. Bildirimler transactional outbox üzerinden tekrar
gönderime dayanıklı işlenir; e-postada özel görüş/anahtar yok, site bağlantısı var.

Özel dosyalar public dizinin dışında; sabit nesne kimliği ve SHA-256 ile tutulur.
JSON intake kontrollü ve tekrar çalıştırılabilir importla PostgreSQL'e taşınır;
eski kayıt/receipt eşlemesi ve sayım/hash kontrolü tamamlanmadan eski depo kaldırılmaz.
Mutlak sunucu dosya yolları DB iş kayıtlarına gömülmez.

Taşıma paketi: sürümlü DB yedeği, nesne manifesti ve dosyalar, kimlik servisi DB'si,
gerekli şifreleme anahtarları ayrı güvenli kanal, sürüm sabitlenmiş deployment
tanımı. Kimlik realm export'u tek başına tam yedek sayılmaz. Geçişte yazılar
kısa süre durdurulur, son fark alınır, kayıt/hash/oy sonuçları ve oturumlar
doğrulanır. Eski oturumlar iptal edilir. Uygulama UUID'leri ve karar bağlantıları korunur.
İlk hedef RPO ≤24 saat, RTO ≤4 saat; bunlar tatbikatla kanıtlanacak hedeflerdir.

## Güvenlik ve işletim kabulü

- HTTPS, Secure/HttpOnly/SameSite oturum çerezi, CSRF/origin kontrolü, süreli
  oturum ve iptal. Kimlik tokenları URL veya localStorage içine konmaz.
- Her istek ve her nesnede sunucu yetki kontrolü; varsayılan ret. Rolü gizli
  düğmeyle sınırlamak yeterli değildir. Scope/COI/expiry her kritik işlemde kontrol.
- DB migration sahibi ile runtime hesabı ayrı; runtime sınırlı yazma yolları.
  JSON intake veya viewer'a DB owner yetkisi verilmez.
- XSS için güvenli metin sunumu/izinli Markdown, içerik ve hız sınırları, güvenilir
  proxy dışında istemci-IP başlıklarını kabul etmeme. MFA ve recovery denemeleri sınırlı.
- Operasyon loglarında görüş, token, e-posta, kimlik belgesi yok. Denetim olayları
  actor/time/reason/correlation ile kayıtlı. DB yöneticisinin mutlak erişimi yokmuş
  gibi 'değiştirilemez' iddiası kurulmaz; ayrı ortam yedekleri ve imzalı periyodik
  audit manifestleri tahrif tespitini güçlendirir, uzman onayı yerine geçmez.
- Gerçek restore tatbikatı, yedek yaş/alarm takibi, disk/kuyruk sağlık ölçümleri,
  güvenlik güncelleme sorumlusu ve olay müdahale prosedürü genel açılış ön koşulu.

## Arayüz tasarımı

Mevcut atlasın tipografi/renk/boşluk sistemi kullanılır. Üst gezinme: Atlas,
Katkılarım, Tartışmalar, Kararlar; yetkililerde İnceleme masası. Mobilde bölümler
sekmelere dönüşür. Ayrı bir yönetim temasına savrulmaz.

Katılımcı: kısa açıklama → ilgili diş/sürüm/görünüm → kaynak → görünürlük
önizlemesi → gönder → takip zaman çizgisi. Sonraki adım ve beklenen sorumlu açık.
Uzun metin taslağı sunucuya kaydedilir; otomatik kaydın başarı/hata durumu görünür.

İnceleme masası: atanmış işler, uzmanlık alanı, son tarih, bekleyen itiraz ve
eksik kaynak filtreleri. Sol liste, ortada görüş/model bağlamı, sağda yetkiye
uygun işlem paneli. Her işlemin gerekçesi ve alıcısı görünür.

Denetmen: kaynak/model karşılaştırması, kriter kriter değerlendirme, çıkar
çatışması beyanı, taslak kaydetme, oy önizleme ve kesin gönderim. Onay düğmesi
eksik kriteri açıklayarak kilitlenir; yalnız renk veya belirsiz hata kullanılmaz.

Karar kartı: '4/5 onay (%80)', 0 ret, 0 değişiklik talebi, 1 çekimser, 0 yanıtsız;
kapsam ve sürüm, gerekçeler, şerhler, görünmesine izin verilen isimler, kanıtlar,
editör kararı, yayın kapıları ve itiraz bağlantısı. Örnek sayılar demo olarak
etiketlenir; canlı sitede uydurma uzman/oy/karar gösterilmez.

WCAG 2.2 AA hedefi: klavye ile tüm işler, görünür focus, erişilebilir kimlik
doğrulama, etiket/hata ilişkisi, ekran okuyucu ve %200 zoom/telefon testleri.
Hedef, test yapılmadan uygunluk sertifikası gibi sunulmaz.

## Teslim sırası ve kanıt

| İş | Çıktı | Kabul kanıtı |
| --- | --- | --- |
| GOV-001 | Kimlik/yetki ve özel katkı DB temeli | Hesaplar arası veri sızıntısı, scope/expiry/COI, oturum/MFA kurtarma testleri; gerçek intake import provası |
| GOV-002 | Katılımcı takip + moderatör masası | Katkı → yanıt → ek kanıt → yönlendirme uçtan uca; mobil/klavye; özel/kamu sınırı |
| GOV-003 | Sürümlü tartışma ve şerh | Düzenleme geçmişi, görünürlük onayı, moderasyon ve kaldırma yetki testleri |
| GOV-004 | Heyet, rubric ve %80 motoru | 3/3, 4/5, 4/6; çekimser/yanıtsız; çift oy, deadline/kapanış yarışı, stale kaynak ve roster iptali |
| GOV-005 | Gerekçeli karar, bağımsız itiraz ve yayın kapıları | %100 + açık önemli itirazın reddi; bağımsız kurul; lisans/gizlilik/QC eksikse yayının engellenmesi |
| GOV-006 | Dış pilot ve taşınma provası | Ayrı sunucuya restore, karar/kimlik eşlemesi, bildirim tekrarları, gerçek cihaz ve 3–5 uzman geri bildirimi |

TASK-005/006/011 bu işlerin teknik bağımlılıklarıdır; yeni adlar tamamlanmışlık
iddiası değildir. GOV-002 tamamlanınca gerçek uzmanlardan bulgu toplamaya
başlanır; bütün oylama sistemi bitene kadar pilot bekletilmez. Uzman heyeti
oluşmadan 'akademik kabul' özelliği açılmaz. HTTPS dış pilot ön koşuludur.

## Araştırma ve takım eleştirisi

İkinci inceleme ve uygulama kabulüne eklenen kontroller:
[23 Eylül değerlendirmesi](../codex/GOVERNANCE-SECOND-REVIEW-2026-09-23.md).

- [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html): varsayılan ret ve her nesne/istekte kontrol.
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html): oturum yaşam döngüsü ve kritik işlemlerde yeniden doğrulama.
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/): erişilebilirlik tasarım/test hedefi.
- [COPE peer review](https://doi.org/10.24318/2019.1.4): uzmanlık, çıkar çatışması ve gerekçeli değerlendirme için rehber; bizim %80 politikamızı belirlemez.
- [Keycloak containers](https://www.keycloak.org/server/containers) ve [export sınırları](https://www.keycloak.org/server/importExport): kendi sunucumuzda kimlik adayı; export tam restore yerine geçmez.

Takım: yerel consult_team üzerinden deepseek-flash, 23 Eylül 2026; yalnız
anonim mimari özet gönderildi. Olumlu: modüllü tek backend, özel/kamu ayrımı,
sürüm bağlı kararlar. Eleştiri: değişen heyet, itirazın önemini kimin belirlediği,
bağımsız itiraz kurulu, kimlik/yetki ayrımı ve geri yükleme kanıtı. Bunlar yukarıda
somutlaştırıldı. Takımın UI'den önce tüm oy motorunu bitirme sırasını aynen
almıyoruz: moderasyon pilotu daha erken kullanılabilir; oylama açılışı yine
yetki ve kural testleri tamamlandıktan sonra. AI görüşü akademik oy değildir.
