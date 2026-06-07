import { marked } from "marked";

const WATERMARK_IMAGE_PATH = "/images/egt-icon-watermark.png";
const WATERMARK_WIDTH_PX = 400;
const WATERMARK_OPACITY = 0.15;
const PRINT_DELAY_MS = 800;
const CONTENT_MAX_WIDTH_PX = 800;
const CONTENT_PADDING_PX = 40;
const PRINT_MARGIN_MM = 15;

const PRINT_STYLES = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding: ${CONTENT_PADDING_PX}px;
    max-width: ${CONTENT_MAX_WIDTH_PX}px;
    margin: 0 auto;
    line-height: 1.6;
    color: #1a1a1a;
  }
  .print-watermark {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 0;
  }
  .print-watermark img {
    width: ${WATERMARK_WIDTH_PX}px;
    height: auto;
    opacity: ${WATERMARK_OPACITY};
  }
  pre {
    border-radius: 4px;
    overflow-x: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
    background: rgba(246, 248, 250, 0.5);
    padding: 16px;
  }
  pre code {
    background: transparent;
    padding: 0;
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 13px;
    line-height: 1.45;
  }
  code {
    background: rgba(245, 245, 245, 0.5);
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 13px;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 16px 0;
  }
  thead, tbody, tr {
    background: transparent;
  }
  th, td {
    border: 1px solid #ddd;
    padding: 8px 12px;
    text-align: left;
    background: transparent;
  }
  th {
    font-weight: 600;
  }
  blockquote {
    border-left: 4px solid #ddd;
    padding-left: 16px;
    margin: 16px 0;
    color: #666;
  }
  @media print {
    @page {
      margin: ${PRINT_MARGIN_MM}mm;
    }
    body {
      padding: 0;
    }
    pre, table, blockquote {
      break-inside: avoid;
    }
    pre {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 0;
    }
    .print-watermark img {
      opacity: ${WATERMARK_OPACITY};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
`.trim();

const PRINT_SCRIPT = `
  setTimeout(function() {
    window.print();
  }, ${PRINT_DELAY_MS});
`.trim();

export interface PrintOptions {
  content: string;
}

export function generatePrintHtml(options: PrintOptions): string {
  const { content } = options;

  const renderedHtml = marked.parse(content);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Print Preview</title>
    <style>${PRINT_STYLES}</style>
  </head>
  <body>
    <div class="print-watermark">
      <img src="${WATERMARK_IMAGE_PATH}" alt="" />
    </div>
    <div id="content">${renderedHtml}</div>
    <script>${PRINT_SCRIPT}</script>
  </body>
</html>`;
}
