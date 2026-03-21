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
