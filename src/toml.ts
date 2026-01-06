export type TomlValue = string | number | boolean | TomlTable;
export type TomlTable = { [key: string]: TomlValue };

function stripInlineComment(line: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    if (ch === '"' && !inSingle) inDouble = !inDouble;
    if (ch === "#" && !inSingle && !inDouble) return line.slice(0, i);
  }
  return line;
}

function parseInlineTable(value: string): TomlTable {
  const result: TomlTable = {};
  const inner = value.trim().slice(1, -1).trim();
  if (!inner) return result;

  const parts: string[] = [];
  let buf = "";
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    if (ch === '"' && !inSingle) inDouble = !inDouble;
    if (ch === "," && !inSingle && !inDouble) {
      parts.push(buf);
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf);

  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const rawKey = part.slice(0, idx).trim();
    const key = unquote(rawKey);
    const val = part.slice(idx + 1).trim();
    result[key] = parseValue(val);
  }

  return result;
}

function parseValue(value: string): TomlValue {
  const trimmed = value.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return parseInlineTable(trimmed);
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseToml(input: string): TomlTable {
  const result: TomlTable = { model_providers: {} };
  let currentProvider: string | null = null;

  for (const rawLine of input.split(/\r?\n/)) {
    const line = stripInlineComment(rawLine).trim();
    if (!line) continue;

    if (line.startsWith("[") && line.endsWith("]")) {
      const section = line.slice(1, -1).trim();
      if (section.startsWith("model_providers.")) {
        const providerId = section.slice("model_providers.".length);
        currentProvider = providerId;
        const providers = result.model_providers as TomlTable;
        if (!providers[providerId]) providers[providerId] = {};
      } else {
        currentProvider = null;
      }
      continue;
    }

    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = parseValue(line.slice(eq + 1));

    if (currentProvider) {
      const providers = result.model_providers as TomlTable;
      const provider = providers[currentProvider] as TomlTable;
      provider[key] = value;
    } else {
      result[key] = value;
    }
  }

  return result;
}
