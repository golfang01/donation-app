// Keeps the JWT in memory for the session — never localStorage (XSS risk).
let memoryToken: string | null = null;

export function getMemoryToken(): string | null {
  return memoryToken;
}

export function setMemoryToken(token: string | null): void {
  memoryToken = token;
}