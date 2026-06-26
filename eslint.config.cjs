const { defineConfig } = require('eslint/config');
const universe = require('eslint-config-universe/flat/native');
const universeWeb = require('eslint-config-universe/flat/web');

module.exports = defineConfig([
  { ignores: ['build/**', 'example/**', 'external_source/**', 'internal/**'] },
  ...universe,
  ...universeWeb,
]);
