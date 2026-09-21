# TASK-003 — PostgreSQL ön inceleme

Durum: **Öneri; migration uygulanmadı/doğrulanmadı.** Tarih: 2026-09-16.
Yanıt: `CHATGPT-TASK002-IMPLEMENTATION-REVIEW-20260916-01`.

## Mevcut dosyaların durumu

`001_core.sql`, `migrate.mjs`, compose, package manifest/lock ve ADR-0001 önceki
oturumdan kalan untracked taslaklardır. TASK-002 commit'lerine dahil değildir.
27 domain nesnesini tek migration'da taslaklayan SQL mevcut haliyle çalıştırılmaya
hazır değildir. ADR'nin erken `Accepted` etiketi `Proposed` olarak düzeltildi.
Önceki yerel konteyner deneyi saklanmıyor; bu deney mimari kabul anlamına gelmez.

## ADR-0001 önerisi ve mimari sınırlar

- PostgreSQL seçimi zaten §4.1'de var. Sadece yerel geliştirme için PostgreSQL 17,
  digest ile sabit resmi Docker imajı, dedicated volume, `127.0.0.1:55432` öneriliyor.
- `pg` doğrudan parametreli SQL sürücüsüdür; ORM seçimi değildir. El yazımı,
  sürümlü SQL migration kullanımı önerilir. Üretim Node/DB sürümü burada dondurulmaz.
- §29'daki ORM, queue, auth, cloud, object storage, AI provider ve frontend
  kararları açık kalır. Docker geliştirme düzeni üretim deployment kararı değildir.
- §32'deki kimlik, claim, immutable history, privacy, quorum ve rights semantiği
  korunur. PostgreSQL `uuid` kolonu mevcut generator için persistence tercihi
  olabilir; domain opak ID sözleşmesini UUID v4 biçimine geri sıkıştırmaz.
- Gerçek klinik veri, harici AI çağrısı, public endpoint veya port yönlendirmesi yok.
  Runtime DB rolü ile migration owner ayrılmalı; runtime DDL/TRUNCATE yapamamalı.

## Taslak SQL'de düzeltilmesi gerekenler

1. `claims` satırı değişmezken `consensus_state` aynı satırda bulunuyor. Consensus
   değişimi semantik claim'i yeniden yazmaya zorlamamalı. Sabit assertion ile
   append-only consensus/evidence-assessment snapshot'ları ayrı tutulmalı.
2. `issues` ve `ai_patch_bundles` için state alanı sınırsız text; FK'ler tek başına
   domain sözleşmesini korumaz. Kabul edilen vocabulary ile CHECK/lookup kısıtları
   ve version alanları açıkça tasarlanmalı.
3. Asset rights kaydındaki reviewer FK tek başına yetki/quorum değildir. SQL
   şemasını yayın izni motoru gibi sunmayacağız; TASK-004/006 kapıları gelmeden
   runtime public release işlemi sağlanmayacak.
4. Mevcut release trigger'ı tüm illegal kenarları, revision yarışını, manifest
   dondurma zamanını veya ilk INSERT ile PUBLISHED üretimini engellemiyor. Tam
   yayın iş akışı sonraki görevlere bırakılmalı; o zamana kadar kapı kapalı kalmalı.
5. `variant.claim_id` tek bağlantıyla sınırlı. §10 gereği bir varyant birden fazla
   claim'e bağlanabilmeli; join tablosu kullanılmalı. Aynı şekilde evidence/citation
   yeniden kullanımı ve issue→claim bağı ayrı ilişkilerle temsil edilmeli.
6. `asset_derivations` yalnız self-edge'i engelliyor; döngü, yürütme kimliği ve
   sürümlü işlem tarifi ayrıca değerlendirilmeli. Bu ayrıntı TASK-007'ye ait;
   eksik lineage davranışı tamamlanmış gibi gösterilmemeli.
7. Audit taslağında TASK-002 correlation, actor-kind, revision ve policy decision
   bağları eksik. Hassas veriyi genel loga kopyalamadan bu bağlar taşınmalı.
8. JSONB nesne türü, boyut sınırları, gerekli metadata alanları ve gelecekteki
   privacy trust boundary belirsiz. Ham klinik metadata genel çekirdek DB'ye
   JSONB üzerinden doldurulmamalı. Karantina nesneleri TASK-012'ye bırakılmalı.

## İlk migration için önerilen dar kapsam

Tek seferde 27 boş/eksik tabloyu dondurmak yerine ilk migration:

- `institutions`, `contributors`: temel kimlik kayıtları; uzmanlık/yetki sağlamaz.
- `structures`, `terminology_mappings`: notasyondan bağımsız ID ve sürümlü eşlemeler.
- `claims`: değişmez assertion içeriği, yapı FK, kapsam ve supersedes bağı.
- `claim_assessments`: aynı claim'e bağlı append-only consensus/evidence snapshot;
  teknik revision ve önceki assessment referansı. Claim semantiği değişmez.
- `audit_events`: append-only denetim metadata'sı ve domain olayına referans.
- `schema_migrations`: uygulanmış migration checksum ve zaman kaydı.

Sonraki görevlerde asset/rights, issue/evidence, reviewer/quorum, lineage ve
release tabloları ilgili davranış testleriyle eklenir. §5 listesini terk etmek değil,
§30'daki küçük task sırasına bölmek amaçlanıyor. Yeni `claim_assessments` yardımcı
tablosu mevcut claim semantiğinin kalıcılık temsili olarak öneriliyor; temel
semantiği değiştirecek başka karar varsa ayrı ADR ile ele alınır.

Bu tur yalnız ön inceleme yapıldı. Yukarıdaki revize SQL henüz yazılmadı.

## Migration runner ve kabul testleri

- Uygulama başlamadan mevcut dedicated DB şeması/servis durumu okunur; eski
  notlardan boş veritabanı varsayılmaz. Test ayrı disposable DB/schema kullanır.
- Advisory lock + transaction; SQL ve migration ledger kaydı aynı transaction'da.
- Aynı migration ikinci kez uygulanmaz; checksum değişirse kapalı hata.
- SQL ortasında hata enjekte edilerek DDL ve ledger rollback doğrulanır.
- İki eşzamanlı runner tek tutarlı sonuca ulaşmalı; hata sonrası kilit açılmalı.
- Empty→current migration, FK/orphan retleri ve sınıflandırma ortogonalliği.
- Assertion içeriği değiştirilemez; yeni semantik iddia yeni ID + supersedes bağı.
- Assessment append eder; eski kararlar kalır; duplicate revision ve race reddi.
- Runtime UPDATE/DELETE/TRUNCATE ile geçmiş silemez; migration owner yetkisi
  runtime'a verilmez. Yönetici/DB owner'a karşı mutlak değişmezlik iddiası yok.
- TASK-002 saf domain + TASK-001 guard regresyonları da geçmeli.

DB entegrasyon testleri henüz çalıştırılmadı; mevcut `test:db` script'inin hedef
dosyası henüz yok. Bu taslak package manifest'i çalışır ürün kabul edilmeyecek.

## Geri alma

Yerel deneyde önce dedicated servis durdurulabilir; volume kendiliğinden silinmez.
Test schema yalnız açıkça disposable test ortamında kaldırılır. Paylaşılan veya
veri içeren DB'de reset/down önerilmez; ileri düzeltme migration'ı tercih edilir.


## Implementation update — 2026-09-16

The text above records the pre-implementation assessment, not the current SQL.
The delegated technical decision now implements the proposed narrow core: eight
tables including the migration ledger. ADR-0001 records this local-only decision.
Nine integration tests passed in real PostgreSQL temporary schemas: fresh/repeat
migration, changed/missing/reordered source rejection, rollback/lock recovery,
concurrent migration, ID mappings/FKs/JSON shape, E3 variant/immutable history,
assessment chain/audit binding, revision races and runtime permission denial.
Real authorization, quorum, rights/privacy, public release and clinical data
remain outside TASK-003. The runtime role has no write permissions.
