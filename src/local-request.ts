export interface LocalRequestHeaders {
  host?: string;
  origin?: string;
}

export function isTrustedLocalRequest(headers: LocalRequestHeaders, port: number): boolean {
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const host = headers.host?.trim().toLowerCase();
  if (!host || !allowedHosts.has(host)) return false;

  const origin = headers.origin?.trim().toLowerCase();
  if (!origin) return true;
  return origin === `http://${host}`;
}
