import "server-only";

import { readFile } from "fs/promises";
import { join } from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import type { DocxTemplateData } from "./map-candidate";

const TEMPLATE_PATH = join(process.cwd(), "Template_CV_Master.docx");

export async function renderDocx(data: DocxTemplateData): Promise<Buffer> {
  const templateBuffer = await readFile(TEMPLATE_PATH);
  const zip = new PizZip(templateBuffer);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{", end: "}" },
  });

  doc.render(data);

  const buf = doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  return buf as Buffer;
}
