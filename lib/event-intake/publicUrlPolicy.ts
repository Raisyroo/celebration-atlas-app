import { lookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { isIP } from 'node:net';

export class PublicSourceUrlError extends Error {
  readonly code: 'invalid_url' | 'blocked_target' | 'dns_failed';

  constructor(
    message: string,
    code: 'invalid_url' | 'blocked_target' | 'dns_failed',
  ) {
    super(message);
    this.name = 'PublicSourceUrlError';
    this.code = code;
  }
}

export type PublicAddress = {
  address: string;
  family: 4 | 6;
};

export type PublicSourceTarget = {
  url: URL;
  addresses: PublicAddress[];
};

function parseIpv4(address: string): number[] | null {
  const parts = address.split('.');
  if (parts.length !== 4) return null;
  const values = parts.map((part) => Number(part));
  if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return null;
  return values;
}

function parseIpv6(address: string): number[] | null {
  const normalized = address.toLowerCase().split('%')[0];
  if (!normalized || normalized.split('::').length > 2) return null;
  const [leftRaw, rightRaw = ''] = normalized.split('::');

  function parseSide(raw: string): number[] | null {
    if (!raw) return [];
    const segments = raw.split(':');
    const parsed: number[] = [];
    for (const segment of segments) {
      if (segment.includes('.')) {
        const ipv4 = parseIpv4(segment);
        if (!ipv4) return null;
        parsed.push((ipv4[0] << 8) | ipv4[1], (ipv4[2] << 8) | ipv4[3]);
        continue;
      }
      if (!/^[0-9a-f]{1,4}$/.test(segment)) return null;
      parsed.push(Number.parseInt(segment, 16));
    }
    return parsed;
  }

  const left = parseSide(leftRaw);
  const right = parseSide(rightRaw);
  if (!left || !right) return null;
  const hasCompression = normalized.includes('::');
  const missing = 8 - left.length - right.length;
  if ((!hasCompression && missing !== 0) || (hasCompression && missing < 1)) return null;
  const words = [...left, ...Array.from({ length: missing }, () => 0), ...right];
  if (words.length !== 8) return null;
  return words.flatMap((word) => [word >> 8, word & 0xff]);
}

function isPublicIpv4(address: string): boolean {
  const bytes = parseIpv4(address);
  if (!bytes) return false;
  const [a, b, c] = bytes;
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a >= 224) return false;
  return true;
}

function isPublicIpv6(address: string): boolean {
  const bytes = parseIpv6(address);
  if (!bytes) return false;
  const allZero = bytes.every((byte) => byte === 0);
  const loopback = bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1;
  if (allZero || loopback) return false;

  const ipv4Mapped = bytes.slice(0, 10).every((byte) => byte === 0)
    && bytes[10] === 0xff
    && bytes[11] === 0xff;
  if (ipv4Mapped) return isPublicIpv4(bytes.slice(12).join('.'));

  if ((bytes[0] & 0xfe) === 0xfc) return false;
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return false;
  if (bytes[0] === 0xff) return false;
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8) return false;
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00) return false;
  if (bytes[0] === 0x20 && bytes[1] === 0x02) return false;
  if (bytes[0] === 0x00 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b) return false;

  return bytes[0] >= 0x20 && bytes[0] <= 0x3f;
}

export function isPublicIpAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}

export function parsePublicSourceUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new PublicSourceUrlError('Enter a valid public website URL.', 'invalid_url');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new PublicSourceUrlError('Official source URLs must use http:// or https://.', 'invalid_url');
  }
  if (url.username || url.password) {
    throw new PublicSourceUrlError('URLs containing credentials are not allowed.', 'blocked_target');
  }
  if (url.port && url.port !== '80' && url.port !== '443') {
    throw new PublicSourceUrlError('Only standard website ports are allowed.', 'blocked_target');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!hostname || hostname.length > 253) {
    throw new PublicSourceUrlError('The source hostname is invalid.', 'invalid_url');
  }
  if (
    hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal')
    || hostname.endsWith('.home')
    || hostname.endsWith('.lan')
  ) {
    throw new PublicSourceUrlError('Only public internet websites can be inspected.', 'blocked_target');
  }
  if (!isIP(hostname) && !hostname.includes('.')) {
    throw new PublicSourceUrlError('Only public internet hostnames can be inspected.', 'blocked_target');
  }
  if (isIP(hostname) && !isPublicIpAddress(hostname)) {
    throw new PublicSourceUrlError('Private and reserved network addresses are blocked.', 'blocked_target');
  }

  url.hostname = hostname;
  url.hash = '';
  return url;
}

export async function resolvePublicSourceTarget(input: string | URL): Promise<PublicSourceTarget> {
  const url = parsePublicSourceUrl(input instanceof URL ? input.toString() : input);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(hostname)) {
    return { url, addresses: [{ address: hostname, family: isIP(hostname) as 4 | 6 }] };
  }

  let resolved: LookupAddress[];
  try {
    resolved = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new PublicSourceUrlError('The official source hostname could not be resolved.', 'dns_failed');
  }
  if (!resolved.length || resolved.some((entry) => !isPublicIpAddress(entry.address))) {
    throw new PublicSourceUrlError('The source resolved to a private or reserved network address.', 'blocked_target');
  }

  const addresses = resolved
    .map((entry) => ({ address: entry.address, family: entry.family as 4 | 6 }))
    .sort((left, right) => left.family - right.family);
  return { url, addresses };
}
