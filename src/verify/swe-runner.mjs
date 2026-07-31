// Isolated test runner for the swe recompute adapter. Invoked as:
//   node swe-runner.mjs <absolute path to tests.mjs>
// tests.mjs must `export const tests = [{ name, run }]`, where `run` returns
// true on pass (or throws / returns non-true on fail). Prints JSON to stdout:
//   { results: [{ name, pass, error? }] }  |  { fatal: "<message>" }
//
// Runs in its own process (parent sets a timeout), so a hanging or crashing
// bundle cannot take down the verifier.

const testsPath = process.argv[2];

try {
  const mod = await import(testsPath);
  const tests = Array.isArray(mod.tests) ? mod.tests : [];
  const results = [];
  for (const t of tests) {
    let pass = false;
    let error;
    try {
      pass = (await t.run()) === true;
    } catch (e) {
      error = String(e && e.message ? e.message : e);
    }
    results.push(error ? { name: t.name, pass: false, error } : { name: t.name, pass });
  }
  process.stdout.write(JSON.stringify({ results }));
} catch (e) {
  process.stdout.write(JSON.stringify({ fatal: String(e && e.message ? e.message : e) }));
}
