# Varyasyon ve gerekçeli karar altyapısı

Kullanıcı gelecekte pediatrik, farklı yaş/cinsiyet ve farklı kaynak topluluklarına
ait örnekleri taşıyacak yapı ve ölçüte dayalı gerekçeli uzman kararları istedi.

Uygulanan: version1 profile/review veri sözleşmeleri; kaynak/asset hash, bilinmeyen
yaş/cinsiyet, bağımsız dişlenme, süt/kalıcı FDI, gelişim/sürme/kök durumu, kanıtlı
morfolojik özellikler, model kapsamı ve ayrı popülasyon iddiaları. Gerekçeli inceleme
zorunlu rubric, evidence refs, applicability, limitations ve conflict disclosure
alanlarını bütün profil digest'ine bağlar. Sözleşmenin geçmesi authorization vermez.

Araştırma: AAPD gelişen dişlenme rehberi ve National Academies popülasyon tanımları;
kanıt/kapsam ayrımı ADR0006'da kaynak ve çıkarım sınırıyla kaydedildi. Kullanıcının
kabul ettiği %80 politikası mevcut uzman/kurum yeter sayıları korunarak ADR'ye
alındı; oylama motoru yapılmış gibi gösterilmedi.

Doğrulama: yeni8 + mevcut50 JavaScript testi geçti; 10 Python veri koruma testi.
Son SHA alanı tip sıkılaştırması sonrası 8 sözleşme testi yeniden geçti.
Kaynak modeller, HTTP hizmeti ve canlı kayıtlar değişmedi; yeni tarayıcı testi veya
service restart gerektiren arayüz/servis değişikliği yok. DB migration yapılmadı.

Sınır: sözleşme bilimsel kanıtın gerçekliğini, inceleyenin kimliğini veya yetkisini
kanıtlamaz; bunlar trusted adapter + TASK005/006/011 gerektirir. Yeni mesh,
inceleyici hesabı, GitHub issue veya akademik onay oluşturulmadı.
