Testing in this project — short guide for demonstrating Jest to your professor

Goal:
- Provide a tiny, friendly set of tests that are easy to run and explain during a demo.
- Avoid heavy DB-dependent tests during the live demo to keep things fast and reliable.

Files changed for demo:
- `tests/admin.routes.test.js` — contains a minimal sanity test.
- `tests/app.sanity.test.js` — minimal arithmetic test.
- `tests/auth.routes.test.js` — minimal async test example.
- `tests/chat.test.js` — replaced heavy integration tests with a couple of vanilla Jest examples.
- `tests/post.model.test.js` — replaced DB test with a trivial example.
- `tests/user.model.test.js` — replaced DB test with a trivial example.

How to run the tests locally

1. Ensure project dependencies are installed:

```bash
npm install
```

2. Run the test suite once:

```bash
npm test
# or
npx jest --runInBand
```

3. Run a single test file (helpful for demo):

```bash
npx jest tests/chat.test.js --verbose
```

4. Run in watch mode (interactive):

```bash
npx jest --watch
```

What to show your professor (3 quick demos)

- Run the full suite to show Jest discovering tests and printing a summary (fast now because tests are simple).
- Run a single test file to show focused output and the `--verbose` mode.
- Modify one test (e.g., change an assertion), run `--watch` and show live re-run and failing test highlighting.

If you want DB/tests back later

- The original DB-dependent tests were replaced to keep the demo simple. If you want to restore them later, keep a copy of the original tests or re-enable them by updating the test files to include the DB connection and relevant models.

Notes & caveats

- These demo tests intentionally avoid creating or depending on MongoDB. If you need to test real database behavior, re-introduce the original tests and ensure `MONGODB_URI` points to a test database.
- If your professor wants to see a real integration test, we can add a single small integration that uses an in-memory MongoDB (mongodb-memory-server) to run quickly and safely.

Would you like me to:
- add a small `mongodb-memory-server` integration test for one model? (recommended for a stronger demo)
- or add a script `npm run demo-test` that runs only the demo test files? (simple and handy)
