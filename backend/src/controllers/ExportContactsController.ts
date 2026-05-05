import { Request, Response } from "express";
import XLSX from "xlsx";

import Contact from "../models/Contact";

export const xlsx = async (req: Request, res: Response): Promise<Response> => {
  const source = String(req.query.source || "spreadsheet").trim();

  const contacts = await Contact.findAll({
    where: { importSource: source },
    order: [["name", "ASC"]]
  });

  const rows = contacts.map(contact => ({
    nome: contact.name,
    numero: contact.number,
    email: contact.email,
    origem: contact.importSource
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "contatos");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const filename = `contatos-${source}.xlsx`;

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);

  return res.status(200).send(buffer);
};
