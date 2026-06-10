const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const mainRelative = 'data/restore-startup-main.sqlite';
const sourceRelative = 'data/restore-startup-source.sqlite';
const mainPath = path.join(root, mainRelative);
const sourcePath = path.join(root, sourceRelative);

function runChild(databasePath, code) {
  const result = spawnSync(process.execPath, ['-e', code], {
    cwd: path.join(root, 'backend'),
    env: {
      ...process.env,
      DATABASE_PATH: databasePath,
      JWT_SECRET: 'restore-startup-test-secret-long-enough'
    },
    encoding: 'utf8'
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

function cleanup() {
  for (const base of [mainPath, sourcePath]) {
    for (const suffix of ['', '-wal', '-shm', '.restore-pending', '.restore.json']) {
      if (fs.existsSync(`${base}${suffix}`)) fs.rmSync(`${base}${suffix}`);
    }
  }
}

test('pending restore is applied before SQLite opens', () => {
  cleanup();
  const initializer = `
    const db=require('./src/database/connection');
    db.ready.then(()=>db.run("INSERT INTO app_settings(key,value) VALUES('restore_probe',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[process.argv[1]],(e)=>{if(e)throw e;db.close();}));
  `;
  runChild(mainRelative, initializer.replace('process.argv[1]', "'old'"));
  runChild(sourceRelative, initializer.replace('process.argv[1]', "'restored'"));
  fs.copyFileSync(sourcePath, `${mainPath}.restore-pending`);
  fs.writeFileSync(`${mainPath}.restore.json`, '{}');

  const value = runChild(mainRelative, `
    const db=require('./src/database/connection');
    db.ready.then(()=>db.get("SELECT value FROM app_settings WHERE key='restore_probe'",[],(e,r)=>{if(e)throw e;console.log(r.value);db.close();}));
  `);
  assert.equal(value, 'restored');
  assert.equal(fs.existsSync(`${mainPath}.restore-pending`), false);
  cleanup();
});
