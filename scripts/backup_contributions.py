#!/usr/bin/env python3
"""Create/verify a private intake snapshot. Source records are atomically replaced.
One snapshot is not a global transaction; each independent receipt is consistent.
Never put this archive in the repository or a public directory.
"""
import argparse, hashlib, io, json, os, re, tarfile, tempfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('source',type=Path);p.add_argument('archive',type=Path);a=p.parse_args()
if a.archive.exists():p.error('Refusing to overwrite an existing backup')
a.archive.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
fd,tmp=tempfile.mkstemp(prefix='.intake-',dir=a.archive.parent)
try:
    manifest={}
    with os.fdopen(fd,'wb') as output:
        with tarfile.open(fileobj=output,mode='w:gz') as tar:
            for path in sorted(a.source.glob('*.json')):
                if not re.fullmatch(r'[a-f0-9]{32}\.json',path.name):continue
                data=path.read_bytes();record=json.loads(data)
                if record['id']+'.json'!=path.name:raise ValueError('Record ID mismatch')
                manifest[path.name]=hashlib.sha256(data).hexdigest()
                info=tarfile.TarInfo(path.name);info.size=len(data);info.mode=0o600;tar.addfile(info,io.BytesIO(data))
            data=json.dumps(manifest,sort_keys=True).encode();info=tarfile.TarInfo('manifest.json');info.size=len(data);info.mode=0o600;tar.addfile(info,io.BytesIO(data))
        output.flush();os.fsync(output.fileno())
    with tarfile.open(tmp,'r:gz') as tar:
        for name,digest in manifest.items():
            if hashlib.sha256(tar.extractfile(name).read()).hexdigest()!=digest:raise ValueError('Backup verification failed')
    os.link(tmp,a.archive);os.unlink(tmp)
    dirfd=os.open(a.archive.parent,os.O_RDONLY)
    try:os.fsync(dirfd)
    finally:os.close(dirfd)
    print(f'Verified {len(manifest)} records; archive mode 0600. Keep a separate encrypted off-host copy.')
finally:
    if os.path.exists(tmp):os.unlink(tmp)
