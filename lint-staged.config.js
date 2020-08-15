module.exports = {
  '*.{ts, tsx}': ['npm run lint -- --fix', 'git add'],
  '*.{md}': ['prettier --write', 'git add'],
};
