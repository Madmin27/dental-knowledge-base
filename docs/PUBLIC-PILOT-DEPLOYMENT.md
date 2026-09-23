# HTTPS uzman pilotu geçişi

23 Eylül 2026: Hazırlık dosyaları; henüz uygulanmış HTTPS yayını değildir.
Seçilecek gerçek alan adı kullanıcıdan bekleniyor. Mevcut servis çalışır durumda,
`PREVIEW_ORIGIN=http://192.168.1.192:3057`. Nginx sözdizimi kontrolü başarılı;
mevcut başka sitelerde yinelenen server_name uyarıları var, bu işte değiştirilmedi.

## Hazır dosyalar ve değişiklik sınırı

- `infra/dental-public.nginx.conf.example`: HTTP → HTTPS yönlendirmesi,
  TLS sonlandırma, yerel servise proxy, katkı endpointinde erişim logu kapalı.
- `infra/dental-public.override.conf.example`: loopback bind ve kesin HTTPS origin.
- `tests/contributions.test.mjs`: HTTPS origin üzerinden gönderim, takip,
  ek açıklama, yeniden başlatma sonrası erişim; yanlış anahtar, origin ve
  forwarded-header kandırma girişimleri.

Testte HTTPS origin başlıkları yerel HTTP upstream üzerinde kullanılır; bu TLS
sertifikası veya gerçek Nginx uçtan uca testi değildir. Uygulama Origin/Host
kontrolü değişmedi. Public hostname'i kabul etmek için kaynak kodunu gevşetmek
gerekmiyor; proxy özgün Host ve Origin başlıklarını korumalıdır.

## Bu turdaki doğrulama

- İzole geçici depoyla 9 katkı testi geçti. Canlı kuyruğa test kaydı eklenmedi.
- Nginx şablonu geçici test sertifikasıyla ayrı yapılandırmada `nginx -t`
  kontrolünden geçti. Bu sertifika silindi; canlı servise kurulmadı.
- Canlı unit, Nginx, firewall ve DNS değiştirilmedi.

## Uygulama sırası

1. Kullanıcının seçtiği hostname için A/AAAA, sertifika SAN ve sona erme tarihini
   doğrula. Modemde 443 yönlendirmesini dış ağdan test et; LAN başarısı yetmez.
2. Geçerli sertifika hazır olduktan sonra örneklerde hostname ve sertifika
   yollarını doldur. Örnek adresi veya kendinden imzalı sertifikayı canlıya alma.
3. Mevcut unit/drop-in ve Nginx dosyalarının yedeğini al. Katkı spool'unu
   `scripts/backup_contributions.py` ile repo dışında yedekle ve ayrı geçici
   dizinde geri okuma kontrolü yap. Gerçek katkı içeriğini loglara yazma.
4. Yalnız dental Nginx site dosyasını ve `90-public.conf` drop-in'ini yükle.
   `nginx -t` geçmeden reload yapma. `systemctl daemon-reload`, yalnız
   `dental-preview` restart ve Nginx reload ile devreye al.
5. Health, iki viewer ve kaynak dosyalarını HTTPS üzerinden doğrula. Gerçek
   kuyruğa sentetik bulgu yazmadan izole intake ile gönderim/özel takip testini
   tamamla. Gerçek ilk pilot gönderimini kullanıcının/inceleyenin kendi
   bildirimiyle doğrula. Sertifika hatasını `-k` ile örterek başarılı sayma.
6. Bakımcı CLI için `DKB_INTAKE_URL=https://SEÇİLEN_HOST` kullan. Yerel DNS/hairpin
   NAT yoksa hostname'in yerel çözümünü düzenle; Host korumasını kaldırma.
7. Yeni adres dışarıdan doğrulanınca geçici 3057 UFW/NAT erişimini kaldır.
   Loopback geçişi eski IP:3057 bağlantısını sonlandırır; yeni URL'yi duyur.

Geri dönüş: yalnız bu işte eklenen drop-in ve Nginx site dosyasını kaldırıp
eski yapılandırmayı geri yükle; daemon-reload, dental restart ve doğrulanmış
Nginx reload yap. Katkı deposunu silme veya eski yedekle üzerine yazma.

## Pilotun işletim sınırları

Proxy arkasında uygulamanın IP kotası aynı loopback IP üzerinde birleşir:
şu an tüm normal katılımcılar için toplam 40 API isteği / 10 dakika. İlk pilot
oturumlarını sırayla yürüt; genel katılıma geçmeden güvenilir proxyye bağlı
istemci-IP politikası ve uçtan uca kötüye kullanım testlerini tamamla.
İstemciden gelen X-Forwarded-For'a koşulsuz güvenme.

Sunucu dışı şifreli yedek hedefi, gerçek geri yükleme provası ve moderasyon
sorumlusu ayrıca belirlenmelidir. HTTPS tek başına CONTRIB-002'nin tamamlandığı
veya akademik yayın onayı alındığı anlamına gelmez.
