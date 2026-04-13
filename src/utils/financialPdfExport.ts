/**
 * Print a specific element by temporarily hiding everything else.
 * Uses browser print-to-PDF — no external dependencies needed.
 */
export function printElement(elementId: string, title?: string) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map(s => s.outerHTML)
    .join("\n");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title || "Financial Report"}</title>
      ${styles}
      <style>
        @media print {
          body { padding: 20px; background: white; color: black; }
          .no-print { display: none !important; }
        }
        body { padding: 20px; background: white; color: black; font-family: system-ui, sans-serif; }
        table { border-collapse: collapse; width: 100%; }
        th, td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: left; }
        th { font-weight: 600; font-size: 0.75rem; text-transform: uppercase; color: #6b7280; }
        .text-right { text-align: right; }
        .font-bold { font-weight: 700; }
        .bg-muted\\/30 { background: #f9fafb; }
        .text-destructive { color: #dc2626; }
      </style>
    </head>
    <body>
      ${title ? `<h1 style="margin-bottom:16px;font-size:1.5rem;">${title}</h1>` : ""}
      <p style="color:#6b7280;margin-bottom:24px;font-size:0.875rem;">Generated: ${new Date().toLocaleString()}</p>
      ${el.innerHTML}
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
}

/**
 * Download an HTML report as a styled PDF via browser print.
 * Opens a new window with the rendered content and triggers print().
 */
export function downloadTableAsPdf(htmlContent: string, title: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        @page { margin: 0.75in; }
        body { padding: 0; background: white; color: black; font-family: system-ui, -apple-system, sans-serif; }
        table { border-collapse: collapse; width: 100%; }
        th, td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: left; font-size: 0.875rem; }
        th { font-weight: 600; font-size: 0.7rem; text-transform: uppercase; color: #6b7280; }
        .text-right { text-align: right; }
        .font-bold { font-weight: 700; }
        h1 { font-size: 1.5rem; margin-bottom: 4px; }
        .subtitle { color: #6b7280; font-size: 0.875rem; margin-bottom: 24px; }
        .section-header { font-weight: 600; font-size: 1rem; margin: 16px 0 8px; }
        .total-row { font-weight: 700; background: #f9fafb; }
        .negative { color: #dc2626; }
        .ratio-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-top: 16px; }
        .ratio-box { text-align: center; padding: 8px; border: 1px solid #e5e7eb; border-radius: 6px; }
        .ratio-label { font-size: 0.7rem; color: #6b7280; text-transform: uppercase; }
        .ratio-value { font-size: 1.1rem; font-weight: 700; }
        .no-print { display: none !important; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <p class="subtitle">Generated: ${new Date().toLocaleString()}</p>
      ${htmlContent}
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
}

/**
 * Export data as CSV and trigger download
 */
export function downloadCSV(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
