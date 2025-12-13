export function dotProduct<K extends number>(arr1: K[], arr2: K[]): number {
  if (arr1.length !== arr2.length) {
    throw EvalError('Two vectors must be of the same dimensions');
  }
  return arr1.map((x, i) => arr1[i] * arr2[i]).reduce((m, n) => m + n);
}
