import hashlib, importlib.util, io, json, subprocess, tarfile, tempfile, unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('restore',ROOT/'scripts/restore_contributions.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class RestoreTests(unittest.TestCase):
    def test_redaction_and_newer_history_survive_old_snapshot(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);source=p/'source';source.mkdir();(source/'archive').mkdir()
            r={'id':'a'*32,'keyHash':'b'*64,'schemaVersion':1,'events':[],'description':'private original'}
            file=source/(r['id']+'.json');file.write_text(json.dumps(r))
            backup=p/'old.tar.gz'
            subprocess.run(['python3',str(ROOT/'scripts/backup_contributions.py'),str(source),str(backup)],check=True,capture_output=True)
            r.update(description='',redactedAt='2026-09-23',archivedAt='2026-09-23')
            (source/'archive'/file.name).write_text(json.dumps(r));file.unlink()
            self.assertEqual(module.restore(backup,source,p/'restored'),1)
            restored=(p/'restored/archive'/file.name).read_text()
            self.assertNotIn('private original',restored)
            self.assertFalse((p/'restored'/file.name).exists())
            with self.assertRaises(ValueError):module.restore(backup,source,p/'restored')

    def test_path_traversal_hash_and_symlink_fail_closed(self):
        for attack in ('path','hash','symlink'):
            with self.subTest(attack=attack),tempfile.TemporaryDirectory() as d:
                p=Path(d);source=p/'source';source.mkdir();backup=p/'bad.tar.gz'
                data=b'{}';name='../escaped' if attack=='path' else 'a'*32+'.json'
                digest='0'*64 if attack=='hash' else hashlib.sha256(data).hexdigest()
                with tarfile.open(backup,'w:gz') as tar:
                    info=tarfile.TarInfo(name);info.size=len(data)
                    if attack=='symlink':info.type=tarfile.SYMTYPE;info.linkname='/etc/passwd';info.size=0
                    tar.addfile(info,io.BytesIO(data))
                    manifest=json.dumps({name:digest}).encode();info=tarfile.TarInfo('manifest.json');info.size=len(manifest);tar.addfile(info,io.BytesIO(manifest))
                with self.assertRaises(ValueError):module.restore(backup,source,p/'restored')
                self.assertFalse((p/'restored').exists())

if __name__=='__main__':unittest.main()
