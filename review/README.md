# Readable just-bash 3.0.0 package review

The `codex/just-bash-3.0.0-readable` branch contains the exact upstream source
commit used to publish just-bash 3.0.0, plus a formatted copy of its npm package
in [`npm/just-bash-3.0.0`](npm/just-bash-3.0.0).

Compare patch branches against this branch to see behavior changes without a
minification or formatting diff. The published bundles repeat implementations
across ESM, CommonJS, browser, and CLI entry points; those repetitions are kept
intact. Formatting does not recover the original names of minified variables.

## Provenance

- Upstream commit: `071669c62c05b21364bdd947f5a4f60785d78653`
- [npm tarball](https://registry.npmjs.org/just-bash/-/just-bash-3.0.0.tgz)
- [npm build provenance](https://registry.npmjs.org/-/npm/v1/attestations/just-bash@3.0.0)
- Tarball SHA-512:
  `d130805bb1b9dd522dedab7b85d2d918272d1f5854bd7fd115090da994370cc1d5356b403d2ddf8d676108449e8e92c78b49591f3071700f7748890ebff5947c`

Every published file is included. JavaScript (`.js`, `.cjs`, `.mjs`) and JSON
are formatted with Prettier 2.8.8; other files are unchanged. The formatter
compares JavaScript ASTs with source locations, comments, formatting metadata,
and redundant empty statements in statement lists removed, and compares parsed
JSON values before writing each file. Empty loop bodies remain checked. Template
literal values remain part of that comparison. Embedded-language formatting is
disabled.

## Source context

The original TypeScript remains unchanged under `packages/just-bash/src/`:

| Published implementation | Original source |
| --- | --- |
| Pipeline execution in CLI, browser, ESM, and CJS bundles | [`pipeline-execution.ts`](../packages/just-bash/src/interpreter/pipeline-execution.ts) |
| Worker bridge buffer sizes | [`protocol.ts`](../packages/just-bash/src/commands/worker-bridge/protocol.ts) |
| Python file buffers, CPython initialization, and source wrapper | [`worker.ts`](../packages/just-bash/src/commands/python3/worker.ts) |

This is a review of changes to the shipped package. Building the unchanged
upstream TypeScript will not reproduce a patched snapshot.

## Reproduce formatting

Use a fresh extraction of the tarball and run the same formatter on either the
original or patched package:

```sh
cd review
pnpm install --ignore-workspace --ignore-scripts
node format-package.cjs /path/to/extracted/package
```

The baseline contains no changes to runtime behavior. Any patch branch must be
compared to this baseline, not upstream `main`.
