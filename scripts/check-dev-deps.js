/**
 * Fails when test-only packages are listed under `dependencies`.
 * `expo install` has moved them there more than once; they belong in
 * `devDependencies` so they never ship with the app.
 */
const pkg = require('../package.json');

const TEST_ONLY = /^(jest|jest-expo|@types\/jest|@testing-library\/.+)$/;
const misplaced = Object.keys(pkg.dependencies ?? {}).filter((name) => TEST_ONLY.test(name));

if (misplaced.length) {
  console.error(`Move to devDependencies: ${misplaced.join(', ')}`);
  process.exit(1);
}
console.log('Test-only packages are in devDependencies.');
