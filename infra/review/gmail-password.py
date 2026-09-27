#!/usr/bin/env python3
"""Enter a Gmail app password locally, without terminal echo. Sends no email."""
import getpass,json,os,pathlib,re,sys,tempfile
if len(sys.argv)!=2: raise SystemExit('Usage: gmail-password.py /PRIVATE/mail-setup.json')
p=pathlib.Path(sys.argv[1])
if not p.is_absolute() or p.is_symlink() or (p.stat().st_mode & 0o777)!=0o600:
 raise SystemExit('Use an existing private mode-0600 configuration file.')
data=json.loads(p.read_text())
if data.get('smtp',{}).get('host')!='smtp.gmail.com': raise SystemExit('Not a Gmail setup file.')
secret=getpass.getpass('Gmail app password (hidden; not your account password): ').replace(' ','')
if not re.fullmatch('[a-zA-Z0-9]{16}',secret): raise SystemExit('Expected a 16-character application password.')
data['smtp']['password']=secret
data['deliveryVerified']=False
fd,temp=tempfile.mkstemp(prefix='.mail-setup-',dir=p.parent)
try:
 os.fchmod(fd,0o600)
 with os.fdopen(fd,'w') as f: json.dump(data,f);f.flush();os.fsync(f.fileno())
 os.replace(temp,p)
finally:
 if os.path.exists(temp): os.unlink(temp)
print('App password saved privately. Email delivery and registration remain unverified; no message sent.')
