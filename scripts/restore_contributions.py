#!/usr/bin/env python3
"""Offline restore into a NEW directory only. Supply the current spool to retain
newer events and privacy redactions. Never overwrite a running service's state.
The archive is operator-trusted input; paths, hashes and sizes are still checked.
"""
import argparse, hashlib, json, os, re, tarfile
from pathlib import Path

NAME=re.compile(r'(?:archive/)?[a-f0-9]{32}\.json\Z')
def validate(name,data):
    if not NAME.fullmatch(name) or len(data)>262144:raise ValueError('Invalid record path/size')
    record=json.loads(data)
    if record.get('id')+'.json'!=Path(name).name or record.get('schemaVersion')!=1:raise ValueError('Invalid record identity')
    if not re.fullmatch('[a-f0-9]{64}',record.get('keyHash','')):raise ValueError('Invalid capability digest')
    if not isinstance(record.get('events'),list) or len(record['events'])>201:raise ValueError('Invalid history')
    return record

def reconcile(backup,current):
    """Select only a proven continuation, never silently select a branch.

    Old redaction operations rewrote earlier event prose. Without a persisted
    pre-redaction chain proof, such histories require private operator review.
    Failing before destination creation is safer than reviving erased content.
    """
    for field in ('schemaVersion','id','keyHash','payloadHash','createdAt'):
        if (field in backup)!=(field in current) or backup.get(field)!=current.get(field):
            raise ValueError('Conflicting immutable record identity; operator review required')
    a,b=backup['events'],current['events']
    canonical=lambda event:json.dumps(event,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False)
    if any(canonical(x)!=canonical(y) for x,y in zip(a,b)):
        raise ValueError('Divergent event histories; operator review required (including rewritten redactions)')
    redacted_a,redacted_b=bool(backup.get('redactedAt')),bool(current.get('redactedAt'))
    if redacted_a and redacted_b and backup['redactedAt']!=current['redactedAt']:
        raise ValueError('Conflicting redaction identities; operator review required')
    if redacted_a!=redacted_b:
        redacted,clear=(backup,current) if redacted_a else (current,backup)
        if len(redacted['events'])<len(clear['events']):
            raise ValueError('History extends a redaction; operator review required')
        return redacted
    if backup.get('submission')!=current.get('submission'):
        raise ValueError('Conflicting submission; operator review required')
    return backup if len(a)>len(b) else current

def restore(archive,current,destination):
    if destination.exists():raise ValueError('Destination must not exist')
    if not current.is_dir():raise ValueError('Current spool required for deletion and revision reconciliation')
    records={}
    with tarfile.open(archive,'r:gz') as tar:
        members=[]
        for member in tar:
            members.append(member)
            if len(members)>20001:raise ValueError('Archive count exceeded')
        if len(members)>20001 or len({m.name for m in members})!=len(members):raise ValueError('Archive count or duplicate names')
        for m in members:
            if not m.isfile() or m.size>262144 and m.name!='manifest.json':raise ValueError('Invalid archive member')
        entry=tar.getmember('manifest.json')
        if entry.size>4000000:raise ValueError('Manifest too large')
        manifest=json.load(tar.extractfile(entry))
        if not isinstance(manifest,dict) or set(manifest)!={m.name for m in members if m.name!='manifest.json'}:raise ValueError('Manifest mismatch')
        for name,digest in manifest.items():
            if not NAME.fullmatch(name):raise ValueError('Invalid path')
            data=tar.extractfile(name).read(262145)
            if hashlib.sha256(data).hexdigest()!=digest:raise ValueError('Digest mismatch')
            r=validate(name,data)
            if r['id'] in records:raise ValueError('Duplicate receipt across archive/live')
            records[r['id']]=(name,data,r)
    # Reconcile everything before creating the destination. Any conflict aborts.
    current_ids=set()
    for file in [*current.glob('*.json'),*(current/'archive').glob('*.json')]:
        if file.is_symlink():raise ValueError('Symlink rejected')
        name=file.relative_to(current).as_posix();data=file.read_bytes();r=validate(name,data)
        if r['id'] in current_ids:raise ValueError('Duplicate current receipt across archive/live')
        current_ids.add(r['id'])
        old=records.get(r['id'])
        if old and reconcile(old[2],r) is old[2]:continue
        records[r['id']]=(name,data,r)
    if len(records)>20000:raise ValueError('Restore capacity exceeded')
    destination.mkdir(mode=0o700,parents=False);(destination/'archive').mkdir(mode=0o700)
    for name,data,r in records.values():
        # Archived metadata, not an arbitrary archive pathname, selects lifecycle.
        target=destination/('archive' if r.get('archivedAt') else '')/(r['id']+'.json')
        fd=os.open(target,os.O_CREAT|os.O_EXCL|os.O_WRONLY|os.O_NOFOLLOW,0o600)
        with os.fdopen(fd,'wb') as output:output.write(data);output.flush();os.fsync(output.fileno())
    for directory in [destination/'archive',destination]:
        fd=os.open(directory,os.O_RDONLY)
        try:os.fsync(fd)
        finally:os.close(fd)
    return len(records)

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('archive',type=Path);p.add_argument('current',type=Path);p.add_argument('destination',type=Path);a=p.parse_args()
    print(f'Restored and reconciled {restore(a.archive,a.current,a.destination)} records into a new directory. Stop the service before any operator cutover.')
