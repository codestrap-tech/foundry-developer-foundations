let log = '';
export function getLogger() {
  return {
    getLog: () => log,
    log: (message: string) => (log = `${log}\n${message}\n`),
  };
}
