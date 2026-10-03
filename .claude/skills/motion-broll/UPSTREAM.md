# Upstream

This skill is copied unchanged from [Barty-Bart/motion-graphics](https://github.com/Barty-Bart/motion-graphics)
(`skills/motion-broll`), commit `e8d610adcf946367430c8b43a97aad8059befaad`, on 2026-10-03. MIT licence, © 2026 Bart: see `LICENSE`
in this folder. Geist fonts: SIL Open Font License (`engine/fonts/OFL-Geist.txt`). Icon paths adapted
from Lucide (ISC), per the upstream README: its licence is in `LICENSE-lucide`.

Two files are added here, not changed: `package.json` (`"type": "commonjs"`, because the kit's root
`package.json` is `"type": "module"` and would otherwise make Node load the engine's CommonJS `.js`
files as ES modules) and `LICENSE-lucide`.

Keep the other files identical to upstream so updates stay a plain copy:

```bash
git clone https://github.com/Barty-Bart/motion-graphics vendor/motion-graphics   # or git -C vendor/motion-graphics pull
rsync -a --delete --exclude 'LICENSE*' --exclude UPSTREAM.md --exclude package.json vendor/motion-graphics/skills/motion-broll/ .claude/skills/motion-broll/
cp vendor/motion-graphics/LICENSE .claude/skills/motion-broll/LICENSE   # then update the commit above
```

How this repo uses it (folders, brand, what gets committed) is in the root `CLAUDE.md`, not here.
