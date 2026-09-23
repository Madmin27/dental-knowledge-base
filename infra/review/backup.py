#!/usr/bin/env python3
"""Encrypted, consistent private-portal snapshot. No clinical plaintext in output.

Restore extraction goes only to a NEW directory and requires the current erasure
journal. It never restores a live database or starts a service automatically.
"""
import argparse, datetime, hashlib, io, json, os, pathlib, shutil, subprocess, tarfile, tempfile

MAX_TOTAL = 30 * 1024**3

def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)

def gpg(key, decrypt=False):
    return ['gpg','--batch','--yes','--no-symkey-cache','--pinentry-mode','loopback','--passphrase-file',str(key)] + (['--decrypt'] if decrypt else ['--symmetric','--cipher-algo','AES256'])

def allowed(name):
    if name in ('portal.sql','identity.sql','portal.json','operator.json','realm.json','compose.env','init.sql','erasures.jsonl','manifest.json'):
        return 128*1024**2 if name.endswith('.sql') else 16*1024**2
    import re
    if re.fullmatch(r'vault/[0-9a-f-]{36}\.(?:raw|preview|chunk-\d{1,2})\.enc',name):
        return 21*1024**2
    raise ValueError('unexpected archive member')

def inspect(archive,key,destination=None):
    proc=subprocess.Popen(gpg(key,True)+[str(archive)],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
    hashes={}; manifest=None; total=0
    try:
        with tarfile.open(fileobj=proc.stdout,mode='r|') as tar:
            for member in tar:
                limit=allowed(member.name)
                if not member.isfile() or member.size>limit or member.name in hashes:
                    raise ValueError('invalid archive member')
                total+=member.size
                if total>MAX_TOTAL: raise ValueError('archive quota')
                source=tar.extractfile(member); h=hashlib.sha256(); chunks=[] if member.name=='manifest.json' else None
                output=None
                if destination:
                    target=destination/member.name; target.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
                    output=open(target,'xb'); os.chmod(target,0o600)
                try:
                    while data:=source.read(1024*1024):
                        h.update(data)
                        if output: output.write(data)
                        if chunks is not None: chunks.append(data)
                finally:
                    if output: output.close()
                if chunks is not None: manifest=json.loads(b''.join(chunks))
                else: hashes[member.name]=h.hexdigest()
        if proc.wait()!=0: raise ValueError('decryption failed')
        if not manifest or manifest.get('files')!=hashes: raise ValueError('snapshot integrity mismatch')
        return manifest
    finally:
        if proc.poll() is None: proc.kill();proc.wait()

def snapshot(config,dest,state):
    dest.mkdir(mode=0o700,parents=True,exist_ok=True);os.chmod(dest,0o700)
    stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    target=dest/(stamp+'.tar.gpg'); pending=dest/(stamp+'.pending')
    active=subprocess.run(['systemctl','is-active','--quiet','dental-review.service']).returncode==0
    with tempfile.TemporaryDirectory(prefix='dental-review-backup-',dir='/run') as temp:
        staging=pathlib.Path(temp);os.chmod(staging,0o700)
        try:
            if active: run(['systemctl','stop','dental-review.service'])
            for database,name in [('dental_review','portal.sql'),('dental_identity','identity.sql')]:
                with open(staging/name,'wb') as out:
                    run(['docker','exec','dental-review-database-1','pg_dump','-U','postgres','--no-owner','--no-acl',database],stdout=out,stderr=subprocess.DEVNULL)
            files={name:staging/name for name in ('portal.sql','identity.sql')}
            for name in ('portal.json','operator.json','realm.json','compose.env','init.sql'): files[name]=config/name
            files['erasures.jsonl']=state/'erasures.jsonl'
            for p in sorted((state/'vault').glob('*.enc')):
                if p.is_symlink() or not p.is_file(): raise ValueError('invalid vault entry')
                files['vault/'+p.name]=p
            manifest={'version':1,'createdAt':stamp,'files':{}}
            with open(pending,'xb') as sink:
                os.chmod(pending,0o600)
                proc=subprocess.Popen(gpg(config/'backup.key'),stdin=subprocess.PIPE,stdout=sink,stderr=subprocess.DEVNULL)
                try:
                    with tarfile.open(fileobj=proc.stdin,mode='w|') as tar:
                        for name,path in files.items():
                            allowed(name)
                            with open(path,'rb') as f: manifest['files'][name]=hashlib.file_digest(f,'sha256').hexdigest()
                            tar.add(path,arcname=name,recursive=False)
                        data=json.dumps(manifest).encode();entry=tarfile.TarInfo('manifest.json');entry.size=len(data);entry.mode=0o600;tar.addfile(entry,io.BytesIO(data))
                    proc.stdin.close()
                    if proc.wait()!=0: raise ValueError('encryption failed')
                    sink.flush();os.fsync(sink.fileno())
                finally:
                    if proc.poll() is None: proc.kill();proc.wait()
            inspect(pending,config/'backup.key');pending.replace(target)
            for old in sorted(dest.glob('*.tar.gpg'))[:-14]:old.unlink()
            print('Encrypted private portal + identity snapshot verified. Same-host backup only.')
        finally:
            pending.unlink(missing_ok=True)
            if active: run(['systemctl','start','dental-review.service'])

def extract(archive,config,target,current):
    # The independent current journal must not be taken from the old snapshot.
    if target.exists(): raise ValueError('restore target must be new')
    target.mkdir(mode=0o700,parents=False)
    try:
        inspect(archive,config/'backup.key',target)
        # Use the same tested verifier/reconciliation contract as application startup.
        verifier=pathlib.Path(__file__).with_name('verify-restore.mjs')
        run(['node',str(verifier),str(target/'portal.json'),str(target/'erasures.jsonl'),str(current)],stdout=subprocess.DEVNULL)
        shutil.copyfile(current,target/'erasures.jsonl');os.chmod(target/'erasures.jsonl',0o600)
        print('Verified restore material prepared privately. Apply the current erasure journal before serving any files. Live data unchanged.')
    except Exception:
        shutil.rmtree(target)
        raise

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('action',choices=['snapshot','verify','extract']);p.add_argument('--config',type=pathlib.Path,default=pathlib.Path('/etc/dental-review'));p.add_argument('--backups',type=pathlib.Path,default=pathlib.Path('/var/backups/dental-review'));p.add_argument('--state',type=pathlib.Path,default=pathlib.Path('/var/lib/dental-review'));p.add_argument('--archive',type=pathlib.Path);p.add_argument('--target',type=pathlib.Path);p.add_argument('--current-ledger',type=pathlib.Path);args=p.parse_args()
    try:
        if args.action=='snapshot':snapshot(args.config,args.backups,args.state)
        elif args.action=='verify':inspect(args.archive,args.config/'backup.key');print('Encrypted snapshot integrity verified; this is not a database restore rehearsal.')
        else:
            if not args.target or not args.current_ledger:raise ValueError('target and independently preserved current ledger required')
            extract(args.archive,args.config,args.target,args.current_ledger)
    except Exception:
        print('Private backup operation failed; no secrets or private payload printed.',file=__import__('sys').stderr);raise SystemExit(1)
