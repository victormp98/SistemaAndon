function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) return reject(error);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) return reject(error);
      resolve(row);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) return reject(error);
      resolve(rows);
    });
  });
}

const transactionLocks = new WeakMap();

async function transaction(db, callback) {
  const previous = transactionLocks.get(db) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  transactionLocks.set(db, previous.then(() => current));
  await previous;

  try {
    await run(db, 'BEGIN IMMEDIATE TRANSACTION');
    try {
      const result = await callback();
      await run(db, 'COMMIT');
      return result;
    } catch (error) {
      try {
        await run(db, 'ROLLBACK');
      } catch {
        // Preserve the original transaction error.
      }
      throw error;
    }
  } finally {
    release();
  }
}

module.exports = { run, get, all, transaction };
