#!/usr/bin/env python3
"""Encrypted local intake snapshot with decryption/restore verification.
The encryption key is separate from the repository and must be copied offline.
This is a same-host backup, not disaster recovery or an offsite copy.
"""
import argparse, datetime, fcntl, os, stat, subprocess, tempfile
from pathlib import Path
from restore_contributions import restore

def run(source, destination, key):
    if not source.is_dir():raise ValueError('Source directory missing')
    if destination.is_symlink() or key.is_symlink():raise ValueError('Symlink rejected')
    destination.mkdir(mode=0o700, parents=True, exist_ok=True)
    for p in (destination, key):
        s=p.stat()
        if s.st_uid!=os.getuid() or stat.S_IMODE(s.st_mode)&0o077:raise ValueError('Private ownership and permissions required')
    if key.stat().st_size<32:raise ValueError('Encryption key too short')
    with open(destination/'.lock','a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        with tempfile.TemporaryDirectory(prefix='dental-backup-') as temporary:
            temp=Path(temporary)
            plain=temp/'snapshot.tar.gz';encrypted=temp/'snapshot.gpg';decoded=temp/'decoded.tar.gz'
            subprocess.run(['python3',str(Path(__file__).with_name('backup_contributions.py')),str(source),str(plain)],check=True,capture_output=True)
            home=temp/'gnupg';home.mkdir(mode=0o700)
            for args in [ ['--cipher-algo','AES256','--output',str(encrypted),'--symmetric',str(plain)], ['--output',str(decoded),'--decrypt',str(encrypted)] ]:
                with key.open('rb') as secret:
                    result=subprocess.run(['gpg','--homedir',str(home),'--batch','--no-tty','--pinentry-mode','loopback','--passphrase-fd',str(secret.fileno()),*args],pass_fds=(secret.fileno(),),capture_output=True)
                if result.returncode:raise RuntimeError('Backup encryption or decryption failed')
            # Verify the snapshot alone. Operational restore also reconciles current
            # state so that newer redactions/comments are never overwritten.
            empty=temp/'empty';empty.mkdir(mode=0o700)
            count=restore(decoded,empty,temp/'restored')
            name='intake-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'.tar.gz.gpg'
            staging=destination/('.'+name)
            try:
                with staging.open('xb') as output:
                    os.chmod(staging,0o600)
                    with encrypted.open('rb') as incoming:
                        import shutil
                        shutil.copyfileobj(incoming,output)
                    output.flush();os.fsync(output.fileno())
                os.rename(staging,destination/name)
                # Only this tool's own snapshots; retain the newest 14 successful runs.
                backups=sorted(destination.glob('intake-*.tar.gz.gpg'))
                for old in backups[:-14]:
                    if old.is_file() and not old.is_symlink():old.unlink()
                fd=os.open(destination,os.O_RDONLY)
                try:os.fsync(fd)
                finally:os.close(fd)
            finally:
                staging.unlink(missing_ok=True)
            print(f'Encrypted snapshot verified by restore: {count} records. Retention: 14 snapshots. Same host only.')

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ('source','destination','key'):p.add_argument(name,type=Path)
    a=p.parse_args();os.umask(0o077);run(a.source,a.destination,a.key)
