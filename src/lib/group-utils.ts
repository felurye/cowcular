export function generateCode(len = 6): string {
  return Math.random()
    .toString(36)
    .slice(2, 2 + len)
    .toUpperCase();
}
