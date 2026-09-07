"""Integration tests use only generated text in disposable Git repositories."""

from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
GUARD = ROOT / 'scripts/check_clinical_data.py'


class ClinicalDataGuardTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name)
        self.git('init', '-q')
        shutil.copy(ROOT / '.gitignore', self.repo / '.gitignore')

    def git(self, *args):
        return subprocess.run(['git', '-C', str(self.repo), *args],
                              check=True, capture_output=True)

    def stage(self, path):
        target = self.repo / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text('SYNTHETIC TEST TEXT ONLY\n')
        self.git('add', '-f', '--', path)

    def guard(self):
        return subprocess.run([sys.executable, str(GUARD), '--repo', str(self.repo)],
                              capture_output=True, text=True)

    def test_clean_source_and_quarantine_service_are_allowed(self):
        for path in ('README.md', 'services/quarantine/README.md',
                     'services/quarantine/src/worker.py', 'tests/synthetic.json'):
            self.stage(path)
        self.assertEqual(self.guard().returncode, 0)

    def test_force_added_restricted_paths_fail_without_leaking_names(self):
        paths = ('scan.dcm', 'scan.DiCoM', 'scan.IMA', 'scan.NII.GZ',
                 'scan.nrrd', 'scan.mha', 'scan.mhd', 'scan.raw', 'scan.vol',
                 'scan.dcm.zip', 'quarantine/image.png',
                 'nested/patient-data/scan.stl', 'clinical-raw/note.json',
                 'services/quarantine/data/quarantine/image.png',
                 'data/scan with\nnewline.DCM')
        for path in paths:
            with self.subTest(path=path):
                self.stage(path)
                result = self.guard()
                self.assertEqual(result.returncode, 1)
                self.assertNotIn(path, result.stdout + result.stderr)
                self.git('rm', '--cached', '--', path)
        self.assertEqual(self.guard().returncode, 0)

    def assert_ignored_and_rejected(self, path):
        result = subprocess.run(['git', '-C', str(self.repo), 'check-ignore', '-q', path])
        self.assertEqual(result.returncode, 0)
        self.stage(path)
        result = self.guard()
        self.assertEqual(result.returncode, 1)
        self.assertNotIn(path, result.stdout + result.stderr)

    def test_dotfile_dcm_is_rejected(self):
        self.assert_ignored_and_rejected('.dcm')

    def test_uppercase_dotfile_dcm_is_rejected(self):
        self.assert_ignored_and_rejected('.DCM')

    def test_compressed_dotfile_is_rejected(self):
        self.assert_ignored_and_rejected('.nii.gz')

    def test_trailing_dot_is_rejected(self):
        self.assert_ignored_and_rejected('scan.dcm.')

    def test_previously_committed_restricted_file_is_checked(self):
        self.stage('scan.dcm')
        self.git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
                 'commit', '-qm', 'Synthetic fixture')
        self.assertEqual(self.guard().returncode, 1)
        self.git('rm', '--cached', 'scan.dcm')
        self.assertEqual(self.guard().returncode, 0)

    def test_missing_worktree_file_does_not_hide_index_entry(self):
        self.stage('scan.dcm')
        (self.repo / 'scan.dcm').unlink()
        self.assertEqual(self.guard().returncode, 1)

    def test_gitignore_blocks_data_but_tracks_service_source(self):
        for path in ('scan.DCM', 'scan.NII.GZ', 'scan.dcm.zip',
                     'quarantine/a.png', 'clinical-raw/a.json', 'patient-data/a.stl'):
            with self.subTest(path=path):
                result = subprocess.run(['git', '-C', str(self.repo),
                                         'check-ignore', '-q', path])
                self.assertEqual(result.returncode, 0)
        self.stage('services/quarantine/README.md')
        result = subprocess.run(['git', '-C', str(self.repo), 'check-ignore',
                                 '--no-index', '-q', 'services/quarantine/README.md'])
        self.assertEqual(result.returncode, 1)

    def test_non_repository_fails_closed(self):
        with tempfile.TemporaryDirectory() as empty:
            result = subprocess.run([sys.executable, str(GUARD), '--repo', empty],
                                    capture_output=True)
            self.assertEqual(result.returncode, 2)


if __name__ == '__main__':
    unittest.main()
