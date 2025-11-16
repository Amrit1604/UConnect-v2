const fs = require('fs');
const path = require('path');

describe('Basic Sanity Checks', () => {
  test('package.json exists and has name', () => {
    const pkgPath = path.resolve(__dirname, '..', 'package.json');
    expect(fs.existsSync(pkgPath)).toBe(true);
    const pkg = require(pkgPath);
    expect(pkg.name).toBeTruthy();
  });

  test('README.md exists and mentions project', () => {
    const readme = path.resolve(__dirname, '..', 'README.md');
    expect(fs.existsSync(readme)).toBe(true);
    const content = fs.readFileSync(readme, 'utf8');
    expect(content.length).toBeGreaterThan(20);
  });

  test('important folders exist', () => {
    const folders = ['routes', 'models', 'views', 'public'];
    folders.forEach(f => {
      const p = path.resolve(__dirname, '..', f);
      expect(fs.existsSync(p)).toBe(true);
    });
  });
});
