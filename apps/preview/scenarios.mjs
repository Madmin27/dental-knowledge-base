import { createRightsGate, permissions } from '../../packages/rights/index.mjs';
import { snapshotDigest } from '../../packages/domain/index.mjs';
export const scenarios = [
  {id:'approved',title:'Açık lisans, eksiksiz izin',description:'Atıf ve kullanım izinleri tamamlanmış sentetik varlık.'},
  {id:'unknown',title:'Lisans bilinmiyor',description:'Kaynak bulunmuş olsa da kullanım hakları doğrulanmamış.'},
  {id:'nc',title:'Ticari kullanıma kapalı',description:'CC BY-NC içerik için bağımsız kullanım izni yok.'},
  {id:'expired',title:'İzin süresi dolmuş',description:'Daha önce onaylanan izin artık geçerli değil.'},
  {id:'revoked',title:'Onay geri çekilmiş',description:'Manifest eski onayı seçiyor; kayıt defterinde yeni bir geri çekme kararı var.'},
  {id:'clinical',title:'İnsan kaynaklı veri',description:'Klinik gizlilik ve karantina incelemesi henüz tamamlanmamış.'},
];
const explanations = {
  UNAPPROVED_RIGHTS:'Doğrulanmış ve uyumlu bir hak kararı bulunmuyor.',
  NC_PERMISSION_REQUIRED:'Kısıtsız çekirdek kütüphane için ayrı, açık bir kullanım izni gerekiyor.',
  EXPIRED_RIGHTS:'İznin süresi dolmuş. Yeni bir hak değerlendirmesi gerekiyor.',
  STALE_OR_MISMATCHED_RIGHTS:'Manifestteki onay güncel değil. Son karar esas alınır.',
  PRIVACY_REVIEW_REQUIRED:'İnsan kaynaklı veri, ayrı gizlilik ve karantina süreci tamamlanmadan yayımlanamaz.',
};
export async function evaluateScenario(id) {
  if(!scenarios.some(s=>s.id===id)) return null;
  const asset={id:'demo-asset',sha256:'a'.repeat(64),origin:'synthetic',institutionOwned:false};
  const record={id:'demo-rights',assetId:asset.id,revision:0,document:{
    reason:'Sentetik önizleme',correlationId:'demo',policyVersion:'rights-v1',status:'APPROVED',
    license:'CC-BY-4.0',sourceRef:'demo-source',permissionRef:null,independentPermission:false,
    shareAlikeCompatible:false,expiresAt:null,territories:['WORLDWIDE'],attribution:{required:true,text:'Sentetik örnek'},
    permissions:Object.fromEntries(permissions.map(p=>[p,true])),
    review:{actorId:'demo-reviewer',actorKind:'human',role:'rights_reviewer',decisionId:'demo-decision'},
  }};
  const manifest={territory:'WORLDWIDE',assets:[{assetId:asset.id,sha256:asset.sha256,rightsId:record.id,
    rightsRevision:0,attribution:'Sentetik örnek',use:{...record.document.permissions}}]};
  if(id==='unknown') {record.document.status='UNKNOWN';record.document.license='UNKNOWN';}
  if(id==='nc') record.document.license='CC-BY-NC-4.0';
  if(id==='expired') record.document.expiresAt='2020-01-01T00:00:00Z';
  if(id==='revoked') {record.revision=1;record.id='demo-revoked';record.document.status='REVOKED';}
  if(id==='clinical') asset.origin='human_derived';
  // This private, per-request synthetic registry recognizes only its own fixture.
  // It is never connected to a real asset, database or production identity provider.
  const digest=snapshotDigest(record);
  const result=await createRightsGate({loadCurrent:async()=>({asset,record}),verifyReview:(_,facts)=>facts.recordDigest===digest})(manifest);
  return {demo:true,allowed:result.allowed,license:record.document.license,
    message:result.allowed ? 'Örnek hak kontrolü geçti. Bu sonuç tek başına yayın onayı değildir.'
      : explanations[result.reasons[0]?.code] ?? 'Hak kontrolü geçilemedi.',
    checkedAt:result.checkedAt};
}
