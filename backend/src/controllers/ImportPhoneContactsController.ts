import { Request, Response } from "express";
import ImportContactsService from "../services/WbotServices/ImportContactsService";

export const store = async (req: Request, res: Response): Promise<Response> => {
  const phoneImportEnabled =
    String(process.env.CONTACTS_PHONE_IMPORT_ENABLED).toLowerCase() === "true";

  if (!phoneImportEnabled) {
    return res.status(403).json({
      error:
        "Importação do telefone está desabilitada. Use a importação por planilha (XLSX/CSV)."
    });
  }

  const userId: number = parseInt(req.user.id);
  await ImportContactsService(userId);

  return res.status(200).json({ message: "contacts imported" });
};
