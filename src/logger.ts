type LogFn = (...args: unknown[]) => void;

function stamp(level: string): string {
  return `[${new Date().toISOString()}] [${level}]`;
}

export const logger: { info: LogFn; warn: LogFn; error: LogFn } = {
  info: (...args) => console.log(stamp('INFO'), ...args),
  warn: (...args) => console.warn(stamp('WARN'), ...args),
  error: (...args) => console.error(stamp('ERROR'), ...args),
};
