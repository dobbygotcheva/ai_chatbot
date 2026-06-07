import { exec } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { Connector, ConnectorContext, ToolCallResult } from "../types";

const execAsync = promisify(exec);

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = join(
    tmpdir(),
    `lo-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await mkdir(dir, { recursive: true });
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function checkLibreOffice(): Promise<string> {
  for (const binary of ["libreoffice", "soffice"]) {
    try {
      await execAsync(`which ${binary}`);
      return binary;
    } catch {
      // not found
    }
  }
  throw new Error(
    "LibreOffice is not installed. Install it with: sudo apt-get install libreoffice"
  );
}

const FORMAT_EXTENSIONS: Record<string, string> = {
  docx: "docx",
  odt: "odt",
  xlsx: "xlsx",
  ods: "ods",
  pptx: "pptx",
  odp: "odp",
  pdf: "pdf",
  html: "html",
  txt: "txt",
};

async function convertDocument(
  params: Record<string, unknown>,
  _ctx: ConnectorContext
): Promise<ToolCallResult> {
  const sourceFormat = String(params.sourceFormat).toLowerCase();
  const targetFormat = String(params.targetFormat).toLowerCase();
  const contentB64 = String(params.content);

  if (!FORMAT_EXTENSIONS[sourceFormat] || !FORMAT_EXTENSIONS[targetFormat]) {
    return {
      success: false,
      error: `Unsupported format. Supported: ${Object.keys(FORMAT_EXTENSIONS).join(", ")}`,
    };
  }

  try {
    const binary = await checkLibreOffice();

    return await withTempDir(async (dir) => {
      const inputPath = join(dir, `input.${sourceFormat}`);
      const inputBuffer = Buffer.from(contentB64, "base64");
      await writeFile(inputPath, inputBuffer);

      const filterMap: Record<string, string> = {
        pdf: "writer_pdf_Export",
        html: "HTML (StarWriter)",
        docx: "MS Word 2007 XML",
        xlsx: "Calc MS Excel 2007 XML",
        odt: "writer8",
        ods: "calc8",
      };

      const filterFlag = filterMap[targetFormat]
        ? `--infilter="${filterMap[sourceFormat] ?? ""}" `
        : "";

      await execAsync(
        `${binary} --headless ${filterFlag}--convert-to ${targetFormat} --outdir ${dir} ${inputPath}`
      );

      const outputPath = join(dir, `input.${targetFormat}`);
      const outputBuffer = await readFile(outputPath);

      return {
        success: true,
        data: {
          content: outputBuffer.toString("base64"),
          format: targetFormat,
          mimeType: getMimeType(targetFormat),
        },
      };
    });
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function extractText(
  params: Record<string, unknown>,
  _ctx: ConnectorContext
): Promise<ToolCallResult> {
  const format = String(params.format).toLowerCase();
  const contentB64 = String(params.content);

  try {
    const binary = await checkLibreOffice();

    return await withTempDir(async (dir) => {
      const inputPath = join(dir, `input.${format}`);
      await writeFile(inputPath, Buffer.from(contentB64, "base64"));

      await execAsync(
        `${binary} --headless --convert-to txt:Text --outdir ${dir} ${inputPath}`
      );

      const outputPath = join(dir, "input.txt");
      const text = await readFile(outputPath, "utf-8");

      return {
        success: true,
        data: { text: text.trim(), charCount: text.length },
      };
    });
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function createTextDocument(
  params: Record<string, unknown>,
  _ctx: ConnectorContext
): Promise<ToolCallResult> {
  const title = String(params.title);
  const content = String(params.content);
  const format = String(params.format ?? "odt").toLowerCase();

  try {
    const binary = await checkLibreOffice();

    return await withTempDir(async (dir) => {
      const txtPath = join(dir, `${title}.txt`);
      await writeFile(txtPath, content, "utf-8");

      if (format === "txt") {
        const buffer = await readFile(txtPath);
        return {
          success: true,
          data: {
            content: buffer.toString("base64"),
            format: "txt",
            mimeType: "text/plain",
            title,
          },
        };
      }

      await execAsync(
        `${binary} --headless --convert-to ${format} --outdir ${dir} ${txtPath}`
      );

      const outputPath = join(dir, `${title}.${format}`);
      const outputBuffer = await readFile(outputPath);

      return {
        success: true,
        data: {
          content: outputBuffer.toString("base64"),
          format,
          mimeType: getMimeType(format),
          title,
        },
      };
    });
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

function getMimeType(format: string): string {
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    odt: "application/vnd.oasis.opendocument.text",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ods: "application/vnd.oasis.opendocument.spreadsheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    odp: "application/vnd.oasis.opendocument.presentation",
    html: "text/html",
    txt: "text/plain",
  };
  return mimeTypes[format] ?? "application/octet-stream";
}

export const libreofficeConnector: Connector = {
  appId: "libreoffice",
  tools: {
    convert_document: convertDocument,
    extract_text: extractText,
    create_text_document: createTextDocument,
  },
};
