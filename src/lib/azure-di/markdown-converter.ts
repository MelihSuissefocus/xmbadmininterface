import type { AnalyzeResult } from "@azure/ai-form-recognizer";

/**
 * Konvertiert ein Azure Document Intelligence AnalyzeResult in Markdown-Format.
 * Priorisiert Tabellen, um strukturierte Daten für LLM-Verarbeitung zu optimieren.
 * 
 * @param result - Das AnalyzeResult von Azure Document Intelligence
 * @returns Markdown-formatierter String mit Tabellen und Volltext
 */
export function convertLayoutToMarkdown(result: AnalyzeResult): string {
  const sections: string[] = [];

  // 1. Verarbeite alle erkannten Tabellen
  if (result.tables && result.tables.length > 0) {
    result.tables.forEach((table, tableIndex) => {
      sections.push(`### Detected Table ${tableIndex + 1}`);
      sections.push("");

      // 2. Erstelle 2D-Grid basierend auf rowCount und columnCount
      const grid: string[][] = Array.from(
        { length: table.rowCount },
        () => Array(table.columnCount).fill("")
      );

      // 3. Fülle das Grid mit Zellinhalten
      table.cells.forEach((cell) => {
        const rowIndex = cell.rowIndex;
        const columnIndex = cell.columnIndex;
        const content = cell.content || "";

        // Behandle merged cells (rowSpan/columnSpan)
        if (grid[rowIndex] && grid[rowIndex][columnIndex] !== undefined) {
          grid[rowIndex][columnIndex] = content.trim();
        }
      });

      // 4. Konvertiere Grid in Markdown-Tabelle
      const markdownTable = convertGridToMarkdownTable(grid);
      sections.push(markdownTable);
      sections.push("");
    });
  }

  // 5. Füge den gesamten Dokumentinhalt als Fallback hinzu
  if (result.content) {
    sections.push("### Full Document Content");
    sections.push("");
    sections.push(result.content);
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
  const headerRow = grid[0].map(cell => cell || " ").join(" | ");
  rows.push(`| ${headerRow} |`);

  // Header-Separator
  const separator = grid[0].map(() => "---").join(" | ");
  rows.push(`| ${separator} |`);

  // Datenzeilen (ab Index 1)
  for (let i = 1; i < grid.length; i++) {
    const dataRow = grid[i].map(cell => cell || " ").join(" | ");
    rows.push(`| ${dataRow} |`);
  }

  return rows.join("\n");
}
