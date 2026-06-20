export type CsvRow = Record<string, unknown>;

const NUMERIC = /^-?\d+(\.\d+)?$/;

/**
 * Parser CSV minimo con soporte de comillas dobles (y comillas escapadas ""),
 * separador coma y saltos CRLF/LF. La primera fila no vacia es el encabezado.
 * Coacciona valores numericos a number para que la validacion aplique.
 */
export function parseCsv(text: string): CsvRow[] {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  const pushField = () => {
    record.push(field);
    field = "";
  };
  const pushRecord = () => {
    pushField();
    records.push(record);
    record = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      pushField();
    } else if (ch === "\n") {
      pushRecord();
    } else if (ch === "\r") {
      // ignorar; el \n hara el push
    } else {
      field += ch;
    }
  }
  // Ultimo campo/registro si el archivo no termina en salto de linea.
  if (field.length > 0 || record.length > 0) {
    pushRecord();
  }

  const nonEmpty = records.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length < 1) return [];

  const header = nonEmpty[0].map((h) => h.trim());
  const rows: CsvRow[] = [];
  for (let r = 1; r < nonEmpty.length; r++) {
    const cells = nonEmpty[r];
    const obj: CsvRow = {};
    for (let c = 0; c < header.length; c++) {
      const raw = (cells[c] ?? "").trim();
      obj[header[c]] = NUMERIC.test(raw) ? Number(raw) : raw;
    }
    rows.push(obj);
  }
  return rows;
}
