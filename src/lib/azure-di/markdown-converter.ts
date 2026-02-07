import type { AnalyzeResult } from "@azure/ai-form-recognizer";

/**
 * Konvertiert ein Azure Document Intelligence AnalyzeResult in Markdown-Format.
 * Rekonstruiert das Dokument Seite für Seite, um die korrekte Lesereihenfolge zu bewahren.
 * 
 * @param result - Das AnalyzeResult von Azure Document Intelligence
 * @returns Markdown-formatierter String mit korrekter Seitenreihenfolge
 */
export function convertLayoutToMarkdown(result: AnalyzeResult): string {
  const sections: string[] = [];

  // 1. Iteriere durch alle Seiten in der richtigen Reihenfolge
  if (result.pages && result.pages.length > 0) {
    result.pages.forEach((page) => {
      const pageNumber = page.pageNumber;

      // 2a. Füge Seiten-Header hinzu
      sections.push(`--- Page ${pageNumber} ---`);
      sections.push("");

      // 2b. Finde alle Tabellen auf dieser Seite
      const tablesOnPage = (result.tables || []).filter((table) =>
        table.boundingRegions?.some((region) => region.pageNumber === pageNumber)
      );

      // 2c. Konvertiere und füge Tabellen ein
      if (tablesOnPage.length > 0) {
        tablesOnPage.forEach((table, tableIndex) => {
          sections.push(`### Table ${tableIndex + 1}`);
          sections.push("");

          // Erstelle 2D-Grid basierend auf rowCount und columnCount
          const grid: string[][] = Array.from(
            { length: table.rowCount },
            () => Array(table.columnCount).fill("")
          );

          // Fülle das Grid mit Zellinhalten
          table.cells.forEach((cell) => {
            const rowIndex = cell.rowIndex;
            const columnIndex = cell.columnIndex;
            const content = cell.content || "";

            if (grid[rowIndex] && grid[rowIndex][columnIndex] !== undefined) {
              grid[rowIndex][columnIndex] = content.trim();
            }
          });

          // Konvertiere Grid in Markdown-Tabelle
          const markdownTable = convertGridToMarkdownTable(grid);
          sections.push(markdownTable);
          sections.push("");
        });
      }

      // 2d. Füge alle Textzeilen dieser Seite hinzu
      if (page.lines && page.lines.length > 0) {
        sections.push("### Text Content");
        sections.push("");
        page.lines.forEach((line) => {
          sections.push(line.content);
        });
        sections.push("");
      }
    });
  }

  // Fallback: Wenn keine Pages vorhanden sind, nutze den raw content
  if (!result.pages || result.pages.length === 0) {
    if (result.content) {
      sections.push("### Document Content");
      sections.push("");
      sections.push(result.content);
    }
  }

  return sections.join("\n");
}

/**
 * Konvertiert ein 2D-String-Grid in eine Markdown-Tabelle.
 * 
 * @param grid - 2D-Array mit Zellinhalten
 * @returns Markdown-formatierte Tabelle
 */
function convertGridToMarkdownTable(grid: string[][]): string {
  if (grid.length === 0) {
    return "";
  }

  const rows: string[] = [];

  // Erste Zeile als Header
  const headerRow = grid[0].map((cell) => cell || " ").join(" | ");
  rows.push(`| ${headerRow} |`);

  // Header-Separator
  const separator = grid[0].map(() => "---").join(" | ");
  rows.push(`| ${separator} |`);

  // Datenzeilen (ab Index 1)
  for (let i = 1; i < grid.length; i++) {
    const dataRow = grid[i].map((cell) => cell || " ").join(" | ");
    rows.push(`| ${dataRow} |`);
  }

  return rows.join("\n");
}
