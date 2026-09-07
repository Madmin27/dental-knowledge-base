"""Reject restricted paths in the Git index, including force-added files.

This filename guard is not a patient-data detector or a history scanner.
"""

import argparse
from pathlib import PurePosixPath
import subprocess
import sys


RESTRICTED_EXTENSIONS = {
    '.dcm', '.dicom', '.ima', '.nii', '.nrrd', '.mha', '.mhd', '.raw', '.vol',
}
RESTRICTED_DIRECTORIES = {'quarantine', 'clinical-raw', 'patient-data'}


def restricted(path):
    parts = PurePosixPath(path.lower()).parts
    for index, part in enumerate(parts[:-1]):
        if part in RESTRICTED_DIRECTORIES:
            # The named service is source code, not a runtime data directory.
            if index == 1 and parts[:2] == ('services', 'quarantine'):
                continue
            return True
    # Splitting at dots also covers dotfiles and trailing dots, unlike suffixes.
    return any('.' + segment in RESTRICTED_EXTENSIONS for segment in parts[-1].split('.')[1:])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', default='.', help='Git working tree to inspect')
    args = parser.parse_args()
    result = subprocess.run(
        ['git', '-C', args.repo, 'ls-files', '--cached', '-z'],
        capture_output=True,
    )
    if result.returncode:
        print('FAIL: cannot read Git index.', file=sys.stderr)
        return 2
    paths = result.stdout.decode('utf-8', errors='surrogateescape').split('\0')
    blocked = sum(restricted(path) for path in paths if path)
    if blocked:
        # Do not print filenames that could themselves contain patient identifiers.
        print(f'FAIL: {blocked} restricted path(s) in Git index. '
              'Unstage/remove clinical files; see docs/privacy/NO_CLINICAL_DATA_IN_GIT.md.',
              file=sys.stderr)
        return 1
    print('PASS: no restricted clinical paths in Git index.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
