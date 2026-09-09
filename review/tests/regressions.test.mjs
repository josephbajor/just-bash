import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const require = createRequire(import.meta.url);
const packageRoot = path.resolve(
  process.env.JUST_BASH_REVIEW_PACKAGE ||
    fileURLToPath(new URL("../npm/just-bash-3.0.0", import.meta.url))
);
const cases = JSON.parse(fs.readFileSync(new URL("cases.json", import.meta.url), "utf8"));
const entries = ["index.js", "index.cjs", "browser.js"];
const quote = (value) => "'" + value.replaceAll("'", "'\"'\"'") + "'";

for (const entry of entries) {
  const entryPath = path.join(packageRoot, "dist/bundle", entry);
  const { Bash, InMemoryFs } = entry.endsWith(".cjs")
    ? require(entryPath)
    : await import(pathToFileURL(entryPath).href);
  for (const { name, command, stdout } of cases.cwd) {
    test(`${entry}: ${name}`, async () => {
      const bash = new Bash({
        fs: new InMemoryFs({ "/work/data.txt": "work\n", "/input/data.txt": "input\n" }),
        cwd: "/",
      });
      const result = await bash.exec("set -o pipefail\n" + command, { rawScript: true });
      assert.equal(result.stdout, stdout);
      assert.equal(result.stderr, "");
      assert.equal(result.exitCode, 0);
    });
  }
}

const { Bash, InMemoryFs } = await import(
  pathToFileURL(path.join(packageRoot, "dist/bundle/index.js")).href
);
for (const mode of ["heredoc", "inline", "file"]) {
  for (const [name, source] of Object.entries(cases.python)) {
    test(`Python ${mode}: ${name}`, { timeout: 30000 }, async () => {
      const vfs = new InMemoryFs({ "/work/script.py": source });
      const bash = new Bash({ fs: vfs, cwd: "/", python: true });
      const command =
        mode === "file"
          ? "python3 /work/script.py argument"
          : mode === "inline"
          ? "python3 -c " + quote(source) + " argument"
          : "python3 - argument <<'PY'\n" + source + "\nPY";
      const result = await bash.exec(command, { rawScript: true });
      if (name === "runtime_error" || name === "syntax_error") {
        assert.equal(result.exitCode, 1);
        assert.equal(result.stdout, "");
        assert.match(
          result.stderr,
          name === "runtime_error" ? /ValueError: source error/ : /IndentationError/
        );
        assert.match(result.stderr, /line 2/);
        if (name === "runtime_error") {
          const filename = mode === "file" ? "/work/script.py" : mode === "heredoc" ? "-" : "-c";
          assert.ok(result.stderr.includes(`File "${filename}", line 2`));
          assert.ok(result.stderr.includes('raise ValueError("source error")'));
        }
        return;
      }
      assert.equal(result.stderr, "");
      assert.equal(result.exitCode, name === "exit_seven" ? 7 : 0);
      if (name === "literals") {
        assert.deepEqual(JSON.parse(result.stdout), [
          "first\nsecond\n    nested\n\nlast",
          "path\\to\\file\n'quoted' \"double\"\nC:\\temp",
          "count=2\nnext=3",
          "Unicode: café 🐍\ntabs:\tend",
          "leftright",
        ]);
      } else if (name === "patch") {
        assert.equal(result.stdout, "first\nsecond\n");
        assert.equal(
          await vfs.readFile("/work/generated.py"),
          'if True:\n    print("first")\n    print("second")\n'
        );
      } else {
        assert.equal(result.stdout, name === "context" ? "42\n" : "before exit\n");
      }
    });
  }
}

test(
  "Python: round-trip a large JSON file and preserve logical file length",
  { timeout: 120000 },
  async () => {
    const vfs = new InMemoryFs({});
    const bash = new Bash({
      fs: vfs,
      cwd: "/",
      python: true,
      executionLimits: { maxPythonTimeoutMs: 120000 },
    });
    const result = await bash.exec(
      `python3 - <<'PY'
import json, os
os.makedirs('/work', exist_ok=True)
rows = [{'id': i, 'text': 'x' * 80, 'v': [i, i + 1, i + 2]} for i in range(100000)]
with open('/work/out.json', 'w') as f:
    json.dump(rows, f)
print(os.path.getsize('/work/out.json'))
PY`,
      { rawScript: true }
    );
    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, "");
    const bytes = (await vfs.readFileBuffer("/work/out.json")).length;
    assert.ok(bytes > 8 * 1024 * 1024);
    assert.equal(result.stdout, `${bytes}\n`);
    const read = await bash.exec(
      "python3 -c " +
        quote(
          "import json, os; d = json.load(open('/work/out.json')); print(len(d), d[-1]['id'], os.environ.get('_'))"
        )
    );
    assert.equal(read.exitCode, 0);
    assert.equal(read.stderr, "");
    assert.equal(read.stdout, "100000 99999 python3\n");
  }
);
