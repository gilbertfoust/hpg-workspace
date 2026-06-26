import * as pdfjs from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

let workerInitialized = false;

export function initPdfWorker() {
  if (workerInitialized) return;
  pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  workerInitialized = true;
}

export { pdfjs };
