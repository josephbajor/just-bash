# Package patch review

Compare `codex/just-bash-3.0.0-fixes` against
`codex/just-bash-3.0.0-readable`. The formatting and complete upstream source
context are already in the base branch.

The runtime changes are the result of applying the existing package patch to
the original npm tarball, then running the same formatter used for the base.
The input patch's SHA-256 is
`d4736c46e5a14653560982a8b0c0bec791e9c464489a467450e98b010efd0551`.
The patch was applied without translating or changing its implementation.

## Suggested reading order

1. [`dist/bundle/chunks/worker.js`](npm/just-bash-3.0.0/dist/bundle/chunks/worker.js)
   contains most of the changes. Original source context is in
   [`worker.ts`](../packages/just-bash/src/commands/python3/worker.ts).
   - Track logical file length separately from allocated capacity. Grow capacity
     geometrically instead of allocating and copying the whole file at every
     extending write. Flush only logical contents at close; use logical length
     for reads, append, and seeking from the end.
   - Set `thisProgram: "python3"` when initializing CPython. This avoids using the
     absolute worker path as the program name, which triggered interpreter
     finalization crashes at some installation path lengths.
   - Keep Python source unchanged in a string and execute
     `exec(compile(source, filename, "exec"), globals(), globals())` in the same
     interpreter. The old wrapper prefixed every source line with four spaces,
     which changed multiline string contents. Cache the original lines for
     tracebacks and retain the existing exit-code handling.
2. [`dist/bundle/index.js`](npm/just-bash-3.0.0/dist/bundle/index.js) shows the
   pipeline directory fix. Original source context is in
   [`pipeline-execution.ts`](../packages/just-bash/src/interpreter/pipeline-execution.ts).
   Save and restore both the environment and internal working directory for
   isolated pipeline stages, including the exception path. Previously `$PWD`
   was restored while the actual directory leaked. Explicit `lastpipe` behavior
   is retained. The CLI, interactive shell, browser, and CJS bundles repeat this
   same change.
3. [`dist/bundle/chunks/chunk-CHRGJY5U.js`](npm/just-bash-3.0.0/dist/bundle/chunks/chunk-CHRGJY5U.js)
   shows the shared bridge data buffer growing from 8 MiB to 100 MiB, plus the
   existing 4,128 bytes of control/path metadata. Original source context is in
   [`protocol.ts`](../packages/just-bash/src/commands/worker-bridge/protocol.ts).
   Matching constants change in both workers and the CJS bundle. Some existing
   comments still describe the old size; this review preserves the input patch
   exactly, including those stale comments.

Only the published snapshot is patched. The TypeScript source remains an
unchanged reference; rebuilding it will not reproduce this patched snapshot.
Application-level tool descriptions, working-directory defaults, and error
recovery behavior are outside this package patch.

## Validation

Use Node.js 22. Install the snapshot's production dependencies without build
scripts or optional native modules, then run the standalone regressions:

```sh
cd review/npm/just-bash-3.0.0
pnpm install --ignore-workspace --ignore-scripts --prod --no-optional --lockfile=false
cd ../..
node --test tests/regressions.test.mjs
```

The 43 tests cover:

- Seven pipeline-directory cases through each of the ESM, CJS, and browser
  exports, including errors and explicit `lastpipe` (21 tests).
- Multiline literals, generated Python, module context/future imports,
  tracebacks, malformed source, and exit codes through heredoc, `-c`, and file
  execution (21 tests).
- Writing and reading JSON larger than 8 MiB, checking logical file length and
  the pinned CPython program name (one test).

The tests target the published snapshot and do not rebuild upstream source.
Set `JUST_BASH_REVIEW_PACKAGE` to an absolute extracted-package path to test a
different copy. The formatter separately verifies AST/JSON equivalence for all
572 JavaScript/JSON files; the remaining published files are unchanged.
