import copy, hashlib, importlib.util, io, json, subprocess, tarfile, tempfile, unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('restore',ROOT/'scripts/restore_contributions.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class RestoreTests(unittest.TestCase):
    def record(self,events):
        return {'id':'a'*32,'keyHash':'b'*64,'payloadHash':'c'*64,'schemaVersion':1,
                'createdAt':'2026-09-23T10:00:00Z','submission':{'description':'Synthetic observation'},
                'events':[{'at':f'2026-09-23T10:0{i}:00Z','actor':'contributor','note':note,'evidence':[]} for i,note in enumerate(events)]}

    def restore_pair(self,backup,current,expect_error=False):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);source=p/'source';source.mkdir();file=source/(backup['id']+'.json')
            file.write_text(json.dumps(backup));archive=p/'backup.tar.gz'
            subprocess.run(['python3',str(ROOT/'scripts/backup_contributions.py'),str(source),str(archive)],check=True,capture_output=True)
            file.write_text(json.dumps(current));before=file.read_bytes();snapshot=archive.read_bytes()
            if expect_error:
                with self.assertRaises(ValueError):module.restore(archive,source,p/'restored')
                self.assertFalse((p/'restored').exists())
                self.assertEqual(file.read_bytes(),before);self.assertEqual(archive.read_bytes(),snapshot)
                return
            self.assertEqual(module.restore(archive,source,p/'restored'),1)
            return json.loads((p/'restored'/file.name).read_text())

    def test_divergent_equal_and_unequal_histories_abort_without_output(self):
        for left,right in [(['A','B'],['A','C']),(['A','B','D'],['A','C']),(['A','C'],['A','B','D'])]:
            with self.subTest(left=left,right=right):self.restore_pair(self.record(left),self.record(right),True)

    def test_identical_and_prefix_histories_select_longest(self):
        for left,right,expected in [(['A'],['A'],['A']),(['A'],['A','B'],['A','B']),(['A','B'],['A'],['A','B']),([],['A'],['A'])]:
            with self.subTest(left=left,right=right):
                result=self.restore_pair(self.record(left),self.record(right))
                self.assertEqual([e['note'] for e in result['events']],expected)

    def test_immutable_identity_and_submission_conflicts_abort(self):
        for field in ['keyHash','payloadHash','createdAt','submission']:
            with self.subTest(field=field):
                backup=self.record(['A']);current=copy.deepcopy(backup)
                current[field]={'description':'Changed'} if field=='submission' else 'd'*64
                self.restore_pair(backup,current,True)

    def test_redaction_does_not_bypass_divergence(self):
        for backup_redacted in [False,True]:
            with self.subTest(backup_redacted=backup_redacted):
                left=self.record(['A','B']);right=self.record(['A','C'])
                (left if backup_redacted else right)['redactedAt']='2026-09-23T11:00:00Z'
                self.restore_pair(left,right,True)

    def test_legacy_redaction_rewrites_require_operator_review(self):
        clear=self.record(['Private historical note']);redacted=copy.deepcopy(clear)
        redacted['events'][0]['note']='İçerik gizlilik nedeniyle kaldırıldı.'
        redacted['events'].append({'actor':'maintainer','status':'closed','note':'Redacted'})
        redacted['redactedAt']='2026-09-23T11:00:00Z'
        self.restore_pair(clear,redacted,True);self.restore_pair(redacted,clear,True)

    def test_compatible_redaction_wins_in_either_direction(self):
        clear=self.record([]);redacted=copy.deepcopy(clear)
        redacted.update(redactedAt='2026-09-23T11:00:00Z',submission={'description':''})
        redacted['events']=[{'actor':'maintainer','status':'closed','note':'Redacted'}]
        for a,b in [(clear,redacted),(redacted,clear)]:
            self.assertEqual(self.restore_pair(a,b),redacted)

    def test_events_cannot_extend_redacted_history(self):
        redacted=self.record(['A']);redacted['redactedAt']='2026-09-23T11:00:00Z'
        self.restore_pair(redacted,self.record(['A','B']),True)

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
