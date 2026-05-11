const browserGlobals = {
  caches: 'readonly',
  clearTimeout: 'readonly',
  document: 'readonly',
  fetch: 'readonly',
  getComputedStyle: 'readonly',
  confirm: 'readonly',
  localStorage: 'readonly',
  location: 'readonly',
  matchMedia: 'readonly',
  navigator: 'readonly',
  requestAnimationFrame: 'readonly',
  ResizeObserver: 'readonly',
  Response: 'readonly',
  self: 'readonly',
  setTimeout: 'readonly',
  window: 'readonly'
};

const nodeGlobals = {
  Buffer: 'readonly',
  console: 'readonly',
  globalThis: 'readonly',
  process: 'readonly',
  Response: 'readonly',
  URL: 'readonly'
};

export default [
  {
    ignores: [
      'node_modules/**',
      'drafts/**',
      'handoff/**'
    ]
  },
  {
    files: ['scripts/**/*.js', 'sw.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: browserGlobals
    },
    rules: {
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-unused-vars': ['error', {
        args: 'after-used',
        ignoreRestSiblings: true
      }]
    }
  },
  {
    files: ['tests/**/*.mjs', 'bin/**/*.mjs', 'eslint.config.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: nodeGlobals
    },
    rules: {
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-unused-vars': ['error', {
        args: 'after-used',
        ignoreRestSiblings: true
      }]
    }
  }
];
