const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const prettier = require(process.env.REVIEW_PRETTIER_PATH || "prettier");

assert.equal(prettier.version, "2.8.8");
const root = path.resolve(process.argv[2]);
const formattingOnly = new Set([
  "start", "end", "loc", "range", "extra", "tokens", "comments",
  "leadingComments", "trailingComments", "innerComments", "errors",
]);
function ast(source) {
  return JSON.parse(JSON.stringify(
    prettier.__debug.parse(source, { parser: "babel" }).ast,
    (key, value) => {
      if (formattingOnly.has(key)) return undefined;
      // Prettier removes redundant standalone semicolons in statement lists.
      // Keep singular empty loop/conditional bodies in the comparison.
      if ((key === "body" || key === "consequent") && Array.isArray(value)) {
        return value.filter((node) => node.type !== "EmptyStatement");
      }
      return value;
    },
  ));
}
let count = 0;
function visit(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const filename = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      visit(filename);
      continue;
    }
    if (!entry.isFile() || !/\.(?:[cm]?js|json)$/.test(entry.name)) continue;
    const source = fs.readFileSync(filename, "utf8");
    const isJson = filename.endsWith(".json");
    const options = {
      parser: isJson ? "json" : "babel",
      printWidth: 100,
      tabWidth: 2,
      trailingComma: "all",
      embeddedLanguageFormatting: "off",
      endOfLine: "lf",
    };
    // Some minified method chains need a second pass to reach stable layout.
    let formatted = source;
    let stable = false;
    for (let pass = 0; pass < 4; pass++) {
      const next = prettier.format(formatted, options);
      if (next === formatted) {
        stable = true;
        break;
      }
      formatted = next;
    }
    assert.ok(stable, `Formatting did not converge: ${filename}`);
    if (isJson) {
      assert.deepEqual(JSON.parse(formatted), JSON.parse(source), filename);
    } else {
      assert.deepEqual(ast(formatted), ast(source), `Formatting changed the AST: ${filename}`);
    }
    fs.writeFileSync(filename, formatted);
    count++;
  }
}
visit(root);
console.log(`Formatted and verified ${count} JavaScript/JSON files.`);
