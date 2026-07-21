# HarfBuzz validation fonts

These redistributable fixtures are pinned inputs for the private HarfBuzz engine
experiment. `fixtures.json` records their upstream revisions, licenses, SHA-256
digests, and intended coverage.

The WOFF and WOFF2 files are container conversions of
`NotoSans-wdth-wght.ttf`. They can be reproduced with FontTools 4.59.1:

```sh
python -m venv /tmp/harfbuzz-fixture-tools
/tmp/harfbuzz-fixture-tools/bin/pip install 'fonttools[woff]==4.59.1'
/tmp/harfbuzz-fixture-tools/bin/python - <<'PY'
from fontTools.ttLib import TTFont
for flavor in ('woff', 'woff2'):
    font = TTFont('NotoSans-wdth-wght.ttf')
    font.flavor = flavor
    font.save(f'NotoSans-wdth-wght.{flavor}')
PY
```

The experiment's verifier is the authoritative integrity check; the command
above documents the pinned tool rather than replacing the recorded hashes.
