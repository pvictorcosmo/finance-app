/** "Almoço  Itaú" -> "almoco itau" (sem acento, minúsculo, espaços simples). */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Chave de "estabelecimento" para reconhecer a mesma loja em lançamentos diferentes:
 * "UBER *TRIP 1234 SAO PAULO" e "Uber *trip 9876" -> "uber trip".
 */
export function merchantKey(description: string): string {
  return normalize(description)
    .replace(/\b(pag|pg|ifd|mp|pp|ec|dl|htm|com|br)\*/g, ' ')
    .replace(/[*#/\\._\-|]+/g, ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/\bparcela\b|\bparc\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 3)
    .join(' ');
}

/** Decodifica bytes de um arquivo: UTF-8 se for válido, senão Latin-1 (comum em CSV de banco). */
export function decodeBytes(bytes: Uint8Array): string {
  const utf8 = decodeUtf8Strict(bytes);
  const text = utf8 ?? decodeLatin1(bytes);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // remove BOM
}

function decodeLatin1(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 4096) {
    out += String.fromCharCode(...bytes.subarray(i, i + 4096));
  }
  return out;
}

/** Retorna null se os bytes não forem UTF-8 válido. */
function decodeUtf8Strict(bytes: Uint8Array): string | null {
  const codes: number[] = [];
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    let cp: number;
    let extra: number;
    if (b < 0x80) {
      cp = b;
      extra = 0;
    } else if (b >= 0xc2 && b < 0xe0) {
      cp = b & 0x1f;
      extra = 1;
    } else if (b >= 0xe0 && b < 0xf0) {
      cp = b & 0x0f;
      extra = 2;
    } else if (b >= 0xf0 && b < 0xf5) {
      cp = b & 0x07;
      extra = 3;
    } else {
      return null;
    }
    for (let k = 1; k <= extra; k++) {
      const c = bytes[i + k];
      if (c === undefined || (c & 0xc0) !== 0x80) return null;
      cp = (cp << 6) | (c & 0x3f);
    }
    codes.push(cp);
    if (codes.length >= 4096) {
      out += String.fromCodePoint(...codes);
      codes.length = 0;
    }
    i += extra + 1;
  }
  return out + String.fromCodePoint(...codes);
}
