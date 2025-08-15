module.exports = {
  extends: ['eslint-config-curvenote'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    // Add any project-specific rules here
  },
};
