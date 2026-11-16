// Runs async jobs in FIFO order with at most `limit` in flight. Used to stop the
// Overview from starting every heavy all-centre report call at the same instant,
// which saturates the database and trips its statement timeout.
export function createLimiter(limit) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Limiter concurrency must be a positive integer.');
  const waiting = [];
  let running = 0;
  const next = () => {
    while (running < limit && waiting.length) {
      const {job, resolve, reject} = waiting.shift();
      running++;
      Promise.resolve().then(job).then(resolve, reject).finally(() => { running--; next(); });
    }
  };
  const run = job => new Promise((resolve, reject) => { waiting.push({job, resolve, reject}); next(); });
  run.stats = () => ({running, waiting: waiting.length});
  return run;
}
