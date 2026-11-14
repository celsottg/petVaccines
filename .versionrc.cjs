// Configuration of `npm run release` (commit-and-tag-version).
// See docs/release-checklist.md and CONTRIBUTING.md for the procedure.

// `app.json` keeps the app version under `expo.version`, which the built-in JSON updater does not read.
const expoVersion = {
  readVersion(contents) {
    return JSON.parse(contents).expo.version;
  },
  writeVersion(contents, version) {
    const json = JSON.parse(contents);
    json.expo.version = version;
    return `${JSON.stringify(json, null, 2)}\n`;
  },
};

module.exports = {
  // package.json is where the current version is read from; the others are bumped together with it.
  packageFiles: [{ filename: 'package.json', type: 'json' }],
  bumpFiles: [
    { filename: 'package.json', type: 'json' },
    { filename: 'package-lock.json', type: 'json' },
    { filename: 'app.json', updater: expoVersion },
  ],
  // Release commit: "chore(release): 1.0.0". The tag keeps the default "v" prefix: "v1.0.0".
  releaseCommitMessageFormat: 'chore(release): {{currentTag}}',
  header: '# Histórico de mudanças\n\nTodas as mudanças relevantes deste projeto são registradas neste arquivo.\n',
  types: [
    { type: 'feat', section: 'Novidades' },
    { type: 'fix', section: 'Correções' },
    { type: 'perf', section: 'Desempenho' },
    { type: 'revert', section: 'Reversões' },
    { type: 'docs', section: 'Documentação', hidden: true },
    { type: 'style', hidden: true },
    { type: 'refactor', section: 'Refatorações', hidden: true },
    { type: 'test', hidden: true },
    { type: 'build', hidden: true },
    { type: 'ci', hidden: true },
    { type: 'chore', hidden: true },
  ],
};
