import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { CvPdf } from "./CvPdf";
import type { CVData } from "./types";

/**
 * Render a CVData object to a PDF buffer (server-side).
 *
 * Uses @react-pdf/renderer's `renderToBuffer` which returns a NodeJS Buffer.
 * Fonts are built-in Helvetica – no network requests needed.
 */
export async function renderToPdfBuffer(data: CVData): Promise<Buffer> {
  const element = React.createElement(CvPdf, { data });
  const buffer = await renderToBuffer(element as any);
  return Buffer.from(buffer);
}
