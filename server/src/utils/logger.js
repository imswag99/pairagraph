// One JSON object per line — no new dependency, just a consistent shape
// (level, message, timestamp, plus whatever context a call site passes) so
// logs are actually greppable/parseable instead of free-form string
// concatenation. `error` writes to stderr, everything else to stdout, same
// split `console.error`/`console.log` already had.
function write(level, message, meta) {
  const entry = { level, message, timestamp: new Date().toISOString(), ...meta };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
};
