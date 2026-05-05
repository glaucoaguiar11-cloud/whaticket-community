import { Request, Response } from "express";

import ImportContactsFromSpreadsheetService from "../services/ContactServices/ImportContactsFromSpreadsheetService";

export const store = async (req: Request, res: Response): Promise<Response> => {
  if (!req.file?.path) {
    return res.status(400).json({ error: "Arquivo não enviado" });
  }

  const result = await ImportContactsFromSpreadsheetService(req.file.path);

  return res.status(200).json({
    message: "contacts imported from spreadsheet",
    ...result
  });
};
