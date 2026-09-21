import {randomUUID} from 'node:crypto';
import {permissions} from '../packages/rights/index.mjs';
export function rightsFixture() {
  const asset={id:randomUUID(),sha256:'a'.repeat(64),origin:'synthetic',institutionOwned:false};
  const record={id:randomUUID(),assetId:asset.id,revision:0,document:{
    reason:'Synthetic rights assessment',correlationId:'synthetic-test',policyVersion:'rights-v1',
    status:'APPROVED',license:'CC-BY-4.0',sourceRef:'synthetic-source',permissionRef:null,
    independentPermission:false,shareAlikeCompatible:false,expiresAt:null,territories:['WORLDWIDE'],
    attribution:{required:true,text:'Synthetic attribution'},permissions:Object.fromEntries(permissions.map(p=>[p,true])),
    review:{actorId:randomUUID(),actorKind:'human',role:'rights_reviewer',decisionId:randomUUID()},
  }};
  const manifest={territory:'WORLDWIDE',assets:[{assetId:asset.id,sha256:asset.sha256,rightsId:record.id,rightsRevision:0,
    attribution:'Synthetic attribution',use:Object.fromEntries(permissions.map(p=>[p,true]))}]};
  return {asset,record,manifest};
}
