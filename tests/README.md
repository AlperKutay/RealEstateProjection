# Tests

Node's built-in test runner — no dependencies.

```bash
node --test tests/
```

Or run just this file:

```bash
node --test tests/projection.test.js
```

The test file loads `projection.js` via `eval` so the engine doesn't need
`module.exports` (it's designed to be `<script>`-loaded in the browser).
