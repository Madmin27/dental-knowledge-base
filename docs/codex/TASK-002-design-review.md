# TASK-002 — Mimari ön inceleme önerisi

Tarih: 2026-09-16. Durum: **Mimari geri bildirim uygulandı / kod incelemesi bekliyor**.
Bu belgedeki önceki tasarım anlatımını §6 uygulama sözleşmesi tamamlar; çelişkide §6 esas alınır.
Yanıt: `CHATGPT-PR2-REREVIEW-20260916-01`.
Normatif kaynak: Architecture v0.1 §6–9, §17–24, §27, §30, §32.

TASK-001 PR #2 için teknik PASS bildirildi; 2026-09-16 canlı kontrolde PR açık,
draft, head `02e15e3f45b5f27828bbfa3f4f424a07047ece54` ve iki CI kontrolü SUCCESS.
Bu belge merge veya akademik onay kaydı değildir. TASK-002'nin `f886473`
commit'indeki erken taslak korunur; henüz kabul edilmiş baseline değildir.

## 1. Kapsam ve kimlik stratejisi

TASK-002 yalnız saf domain nesneleri, kimlikler, enum'lar, geçiş doğrulaması ve
invariant testlerini kapsar. PostgreSQL, migration ve ORM TASK-003 kapsamındadır.
İnceleme sonrası uygulama `packages/domain`, `tests/domain.test.mjs` ve ilgili
görev/test belgeleriyle sınırlanır. Veritabanı veya sağlayıcı seçimi yapılmaz.

Mevcut kimlik üretici tercihi UUID v4; domain API kimliği opak kabul eder, UUID biçimini zorunlu tutmaz; `node:crypto.randomUUID()` ile üretilir. Anahtar
FDI, ISO, isim, kurum veya başka ontoloji kodundan türetilmez. UUID/ULID kullanımı
§6 ile uyumludur; v4 seçimi mimarinin mevcut zorunluluğu değil, bu öneridir.
İnsan tarafından okunur etiket ve sürümlü terminoloji eşlemesi ayrı alanlardır.

- Yapı/issue kimliği yaşam döngüsü boyunca sabittir; `revision` artar.
- Bilimsel claim içeriği değişirse yeni claim kimliği ve `supersedes_claim_id`
  gerekir; eski iddianın ifadesi değiştirilmez. Consensus kararı ayrı olaydır.
- Kaynak asset, türev asset, patch ve release farklı nesnelerdir; kaynak üzerine
  yazılmaz. Düzeltme yeni asset/release kimliği üretir.
- Revision pozitif yönde ilerleyen güvenli tamsayıdır; taşma reddedilir.
- Bu aşamada kimlik doğrulama biçimseldir; nesnenin varlığı/yetkisi anlamına gelmez.

## 2. Enum önerisi

| Alan | Değerler | Kaynak |
|---|---|---|
| anatomical_class | canonical, variant, developmental, pathological, unknown | §9.1 |
| evidence_grade | E0_OBSERVATION, E1_REPLICATED_OBSERVATION, E2_LITERATURE_SUPPORTED, E3_INDEPENDENTLY_VERIFIED | §9.1 |
| consensus_state | proposed, under_review, accepted, disputed, rejected, superseded | §9.1 |
| review_decision | APPROVE, REQUEST_CHANGES, REJECT, ABSTAIN | §18.1 |
| actor_kind | human, ai, system | Teknik öneri; yetki rolü değildir |
| entity_kind (geçiş çekirdeği) | issue, claim, patch, release | Bu görev kapsamı |

Issue, patch ve release durumları aşağıdaki tabloların sol sütunlarıdır.
§17.2'deki `INVALID/SPAM` için `INVALID_SPAM`, `RESOLVED/CLOSED` için iki ayrı
`RESOLVED` ve `CLOSED` kodu önerilmektedir; bunlar açıkça incelemeye sunulan
yorumlamalardır. Diğer domain nesnelerine gelişigüzel enum eklenmez.

Üç bilimsel eksen bağımsızdır: E3 kabul edilmiş varyant geçerlidir. E3 klinik kanıt
standardı değildir ve canonical sınıfına otomatik yükseltme yaratmaz. Bir reviewer
oyuyla kanıt seviyesi otomatik değişmez. Evidence promotion ayrı, gerekçeli olay ve
§19–20 şartlarını gerektirir; TASK-002 kanıt/quorum hesaplama motoru kurmaz.

## 3. Geçiş sözleşmesi

Tablolar §17.2'nin ötesindeki ayrıntılı kenarları **önerir**; mimaride kesinleşmiş
geçiş tablosu olarak sunulmaz. Listede olmayan bütün geçişler, self-transition,
bilinmeyen nesne/durum ve eksik denetim bağlamı reddedilir.

Geçişler veritabanına veya yayına yazmaz; değişmez yeni snapshot ve audit-event
taslağı döndürür. Eski snapshot korunur. Gerçek atomik kayıt, optimistic concurrency,
append-only depolama, kimlik doğrulama ve kapsamlı yetkilendirme sonraki görevlerdir.

Korunan geçişte `actor.kind=human` tek başına yeterli olmayacaktır. Öneri: eksik
veya başarısız politika bağlamında geçiş reddedilsin. Daha sonra sunucu tarafından
üretilen, nesne/revision/hedef/karar/politika sürümüne bağlı doğrulama sonucu
kullanılsın; HTTP gövdesindeki rol veya `approved: true` kabul edilmesin.
TASK-002 sentetik doğrulayıcıyla bu sözleşmeyi test eder; gerçek eligibility/quorum,
rights/privacy/QC değerlendirmesini tamamlanmış gibi göstermez.

### Issue

| Başlangıç | Önerilen hedefler | Koşul |
|---|---|---|
| DRAFT | OPEN | Yazar/katkı yetkisi |
| OPEN | TRIAGE | Yetkili triage |
| TRIAGE | NEEDS_EVIDENCE, UNDER_REVIEW, DUPLICATE, INVALID_SPAM | Gerekçeli insan moderasyonu |
| NEEDS_EVIDENCE | UNDER_REVIEW | Yeni kanıt bağlantısı ve triage kararı |
| UNDER_REVIEW | ACCEPTED_AS_CORRECTION, RECLASSIFIED_AS_VARIANT, DISPUTED, REJECTED, SUPERSEDED | Yetkili bilimsel karar; gereken quorum |
| DISPUTED | UNDER_REVIEW, SUPERSEDED | Yeni kanıt/karar; eski itiraz korunur |
| ACCEPTED_AS_CORRECTION | RESOLVED | Düzeltme ve ilgili claim/patch/release bağlantısı |
| RECLASSIFIED_AS_VARIANT | RESOLVED | İlgili claim ve variant bağlantısı |
| DUPLICATE | CLOSED | Asıl issue bağlantısı |
| INVALID_SPAM | CLOSED | Moderasyon gerekçesi |
| REJECTED | CLOSED | Red kararı bağlantısı |
| SUPERSEDED | CLOSED | Yerine geçen kayıt bağlantısı |
| RESOLVED | CLOSED | Çözüm kaydı korunur |
| CLOSED | Yok | Terminal; yeni kanıt yeni issue/claim ve eski kayda referans üretir |

Geçersiz örnekler: OPEN→RESOLVED, TRIAGE→ACCEPTED_AS_CORRECTION,
CLOSED→OPEN; AI'nın reclassification veya bilimsel kabul kararı vermesi.
Kapatma ne claim doğruluğunu ne kamuya yayını kendiliğinden onaylar.

### Claim / consensus

| Başlangıç | Önerilen hedefler | Koşul |
|---|---|---|
| proposed | under_review | İncelemeye uygun kanıt/iddia kaydı |
| under_review | accepted, disputed, rejected | Yetkili insan kararı; §19 quorum |
| accepted | disputed, superseded | Yeni itiraz veya ardıl claim; önceki kabul saklanır |
| disputed | under_review, superseded | Yeni değerlendirme/ardıl kayıt |
| rejected | superseded | Yeni iddia ayrı kimlikle ve bağlantıyla |
| superseded | Yok | Terminal |

Geçersiz örnekler: proposed→accepted, rejected→accepted, superseded→proposed.
`accepted→disputed` erken taslakta yoktur; sonradan ortaya çıkan bilimsel itirazı
korumak için öneriliyor. Eski karar ve yayımlanmış release snapshot'ı değişmez.
Bu kenar kesinleştirilmeden kod değiştirilmez.

### AI patch

| Başlangıç | Önerilen hedefler | Koşul |
|---|---|---|
| REQUESTED | GENERATING | Kayıtlı iş ve temel sürümler |
| GENERATING | GENERATED | Yeni türev çıktısı oluşmuş |
| GENERATED | QC_FAILED, AWAITING_HUMAN_REVIEW | Gerçek QC sonucu |
| QC_FAILED | SUPERSEDED | Yeni patch bağlantısı; başarısız rapor korunur |
| AWAITING_HUMAN_REVIEW | APPROVED, CHANGES_REQUESTED, REJECTED | Yetkili insan ve gereken quorum |
| CHANGES_REQUESTED | SUPERSEDED | Yeni patch kimliği |
| APPROVED | MERGED_INTO_RELEASE, SUPERSEDED | Yetkili release işlemi veya ardıl patch |
| REJECTED | SUPERSEDED | Yeni patch kimliği; red korunur |
| MERGED_INTO_RELEASE | Yok | Terminal |
| SUPERSEDED | Yok | Terminal |

Geçersiz örnekler: GENERATED→APPROVED, QC_FAILED→APPROVED,
CHANGES_REQUESTED→GENERATING (aynı patch'i yeniden yazmak), AI→APPROVED/MERGED.
Erken taslaktaki GENERATING→QC_FAILED kaldırılması öneriliyor: üretim hatası QC
hatası değildir; retry/failure iş yürütme katmanında kaydedilmelidir.

### Release

| Başlangıç | Önerilen hedefler | Koşul |
|---|---|---|
| DRAFT | FROZEN_FOR_REVIEW | Tam, sürümlü manifest |
| FROZEN_FOR_REVIEW | APPROVED, SUPERSEDED | Onay için kapılar doğrulanmış; replacement için yeni release bağlantısı |
| APPROVED | PUBLISHED, SUPERSEDED | Aynı manifest/revision için geçerli kapılar veya yeni release bağlantısı |
| PUBLISHED | WITHDRAWN, SUPERSEDED | Yetkili insan; gerekçe/ardıl release bağlantısı |
| WITHDRAWN | Yok | Geçmiş kayıt saklanır |
| SUPERSEDED | Yok | Geçmiş kayıt saklanır |

Geçersiz örnekler: DRAFT→PUBLISHED, FROZEN_FOR_REVIEW→DRAFT,
PUBLISHED→DRAFT, WITHDRAWN→PUBLISHED; AI/system doğrudan onay/yayın/geri çekme.
Dondurulmuş manifest düzeltmesi yeni release nesnesidir. Freeze ve publication
yetkilerinin ayrılığı korunur; salt actor türüyle güvenlik iddiası kurulmaz.

## 4. Test planı ve erken taslağın açıkları

Mevcut 10 guard ve 7 domain testi 2026-09-16 tekrar geçti. Bu sonuç yalnız mevcut
taslağı kapsar; aşağıdaki yeni sözleşmelerin uygulandığı/test edildiği anlamına gelmez.

- Ortogonal üç eksen, claim'in asset olmadan var olabilmesi, notasyon değişiminde
  internal ID korunması ve geçersiz ID'lerin reddi.
- Her makinede tüm durum çiftlerinin tablolara göre olumlu/olumsuz sınanması.
- AI/system için protected-edge retleri, insan olup yetkisiz olma, eksik politika
  sonucu ve başka nesne/revision için verilmiş kararın reddi.
- Quorum/evidence sınıflandırmayı otomatik değiştiremez; varyant hataya indirgenmez.
- Girdi snapshot'ı ve nesne kimliği korunur; revision tam bir artar; taşma reddedilir.
- Her geçiş aktör, gerekçe, önceki/yeni revision, zaman ve correlation ID üretir.
- Claim supersession, issue resolution ve patch/release bağlantıları eksikse ret.
- Manifest hem işlem sonucunda hem dışarıdan gelen değiştirilmiş snapshot'a karşı
  sürüm/hash bağlamıyla denetlenir; `Object.freeze` depolama değişmezliği sayılmaz.

Erken taslaktaki eksikler: korunacak geçişlerde yalnız `human` kontrolü yapılması;
bazı SUPERSEDED/RESOLVED/CLOSED kararlarının AI/system'e açık kalması; referans ve
correlation kontrollerinin olmaması; revision artışında taşma kontrolü olmaması;
tam durum matrisi testlerinin ve review_decision enum'unun bulunmaması.
Yeni politika bağlamı arayüzü burada teklif edilir; henüz uygulamaya alınmamıştır.

## 5. İstenen mimari geri bildirim

UUID v4 tercihi, slash durumlarının kod karşılıkları, claim accepted→disputed,
üretim hatası/QC ayrımı, terminal durumlar ve kapalı-varsayılan politika bağlamı
sözleşmesi değerlendirilsin. Temel nesne semantiği veya §32 invariant'ını değiştiren
karar varsa ayrıca ADR gerekir. Ön kontrol sonrası TASK-002 taslağı dar kapsamla
düzeltilir; TASK-003 dosyaları bu incelemeye dahil edilmez.


## 6. Uygulanan sözleşme — 2026-09-16

Mimari geri bildirim: `CHATGPT-TASK002-DESIGN-REVIEW-20260916-01`.
§4'teki eksikler ilk taslağın inceleme bulgularıdır; aşağıdaki uygulama bunları
saf domain kapsamı içinde giderir. Üretim güvenliği veya akademik onay iddiası yoktur.

`createTransitionEngine({verifyPolicyDecision, policyVersion, clock})` yalnız
sunucunun güvenilir bileşimi tarafından kurulmalıdır. Callback senkron çalışır ve
kararın güvenilir kaynağını/otantikliğini doğrular; kesin `true` dışındaki sonuçlar
reddedilir. Varsayılan `transition` doğrulayıcısızdır ve hiçbir geçişe izin vermez.
Bu güven sınırı domain modülünün içinden çözülen auth değildir; istemci callback,
aktör, clock veya politika doğrulama kaynağı belirleyemez.

Bütün geçişlerde karar zorunludur; korunan insan kararlarında buna ek olarak insan
aktör zorunludur. Kararın alanları:

| Alan | Bağ / kontrol |
|---|---|
| decision_id | Boş olmayan opak karar kimliği; audit'e referans |
| outcome | Yalnız ALLOW |
| policy_version | Engine'in beklediği sürümle birebir aynı |
| entity_id, entity_kind | Aynı nesne ve makine |
| entity_revision | Aynı güvenli tamsayı sürüm |
| from_state, to_state | Tam olarak istenen geçiş |
| actor_scope.actor_id, actor_kind, action | Aktör ve `kind:from:to` kapsamı |
| entity_digest | Kanonik JSON snapshot'ın SHA-256'sı; manifest dahil |
| references_digest | Geçişteki referansların kanonik JSON SHA-256'sı |
| expires_at | Varsa UTC ISO zaman; sunucu saatinde geçerli olmalı |

Digest kimlik doğrulama/İmza değildir: tüm alanları doğru tahmin edilmiş istemci
nesnesi bile güvenilir callback tarafından doğrulanmadan kabul edilmez. Replay ve
concurrency engeli ileride atomik revision karşılaştırmasıyla persistence katmanında
kurulacaktır. Snapshot, referans ve verifier'a verilen facts kopyalanır/dondurulur.

AI/system: yalnız issue DRAFT→OPEN, claim proposed/disputed→under_review ve patch
hazırlama/QC geçişleri, geçerli politika kararıyla mümkün. Issue moderasyonu,
bilimsel kararlar, patch onayı/red/değişiklik isteği/merge/supersession ve bütün
release geçişleri insan aktör de gerektirir. Bu kısıt gerçek uzmanlık/quorum
hesaplamasının yerine geçmez.

Claim semantik değişikliği transition helper'ına yeni payload verilerek yapılamaz;
yeni claim ve supersedes bağlantısı gerekir. Consensus accepted→disputed mümkündür;
yeni kanıt referansı zorunludur. CLOSED terminaldir. Yeni kanıt yeni issue kimliği
ve önceki issue/claim referansı taşır; nesne oluşturma/persistence sonraki görevdir.

GENERATING→QC_FAILED kaldırıldı. QC sadece GENERATED sonrasında çalışır; iş yürütme
hataları domain'e yeni durum eklemeden job katmanına bırakıldı. Release
FROZEN_FOR_REVIEW/APPROVED→SUPERSEDED yeni release kimliğine referansla mümkündür;
eski manifest ve snapshot korunur. Aynı nesneye successor/duplicate referansı yasak.

Audit taslağı actor, reason, correlationId, önceki/yeni durum ve revision, sunucu
zamanı, decisionId, policyVersion ve referansları taşır. Alan adlarının camelCase
olması mevcut JavaScript domain arayüzüyle uyumludur; DB/API formatı seçimi değildir.

Test sonucu: 16 domain testi; issue 196, claim 36, patch 100, release 36 olmak üzere
368 durum çifti (49 izinli, 319 yasak) ve ayrıca 84 AI/system ret kontrolü geçti.
10 klinik dosya guard testi de geçti. Gerçek policy provider, quorum, DB, privacy,
rights ve QC motorları bu testlerin kapsamı değildir.
