module.exports = {
  '*.{ts, tsx}': ['yarn lint --fix', 'git add'],
  '*.{md}': ['prettier --write', 'git add'],
};
