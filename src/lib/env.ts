// Recebe o valor (não o nome) para preservar a substituição inline
// que o Next.js faz em acessos estáticos a process.env.NEXT_PUBLIC_*.
export function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Variável de ambiente ${name} não definida`);
  }
  return value;
}
