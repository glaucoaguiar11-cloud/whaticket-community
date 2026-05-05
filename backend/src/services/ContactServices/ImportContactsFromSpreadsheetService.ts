import fs from "fs/promises";
import path from "path";
import XLSX from "xlsx";

import Contact from "../../models/Contact";

interface ImportResult {
  imported: number;
  skipped: number;
  updated: number;
}

const normalizeNumber = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const digitsOnly = String(value).replace(/\D/g, "");

  // Alguns arquivos exportam números internacionais com prefixo 00
  return digitsOnly.startsWith("00") ? digitsOnly.slice(2) : digitsOnly;
};

const normalizeText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const pickValue = (row: Record<string, unknown>, aliases: string[]): string => {
  for (const alias of aliases) {
    const key = Object.keys(row).find(
      currentKey => currentKey.trim().toLowerCase() === alias
    );

    if (key) {
      const normalized = normalizeText(row[key]);
      if (normalized) return normalized;
    }
  }

  return "";
};

const ImportContactsFromSpreadsheetService = async (
  filePath: string
): Promise<ImportResult> => {
  try {
    const ext = path.extname(filePath).toLowerCase();

    if (![".xlsx", ".xls", ".csv"].includes(ext)) {
      throw new Error("UNSUPPORTED_FILE_TYPE");
    }

    const workbook = XLSX.readFile(filePath, { raw: false });
    const firstSheetName = workbook.SheetNames?.[0];

    if (!firstSheetName) {
      return { imported: 0, skipped: 0, updated: 0 };
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: ""
    });

    let imported = 0;
    let skipped = 0;
    let updated = 0;

    for (const row of rows) {
      const number = normalizeNumber(
        pickValue(row, ["numero", "número", "number", "telefone", "phone"])
      );

      if (!number) {
        skipped += 1;
        continue;
      }

      const name =
        pickValue(row, ["nome", "name", "contato", "contact"]) || number;
      const email = pickValue(row, ["email", "e-mail"]);

      const contact = await Contact.findOne({ where: { number } });

      if (contact) {
        const nextName = name || contact.name;
        const nextEmail = email || contact.email;

        if (contact.name !== nextName || contact.email !== nextEmail) {
          await contact.update({
            name: nextName,
            email: nextEmail,
            importSource: "spreadsheet"
          });
          updated += 1;
        } else {
          skipped += 1;
        }

        continue;
      }

      await Contact.create({
        number,
        name,
        email: email || "",
        importSource: "spreadsheet"
      });
      imported += 1;
    }

    return { imported, skipped, updated };
  } finally {
    await fs.unlink(filePath).catch(() => undefined);
  }
};

export default ImportContactsFromSpreadsheetService;
