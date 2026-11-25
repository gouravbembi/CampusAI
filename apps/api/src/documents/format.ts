import { extname, basename } from "node:path";
import { fromBuffer, type Entry, type ZipFile } from "yauzl";
import { HttpError } from "../identity/security.js";

export const maxResumeBytes = 5 * 1024 * 1024;
const invalid = () => new HttpError(400, "invalid_resume_format");

async function validateDocx(buffer: Buffer) {
  const zip = await new Promise<ZipFile>((resolve, reject) => {
    fromBuffer(
      buffer,
      { lazyEntries: true, validateEntrySizes: true, strictFileNames: true },
      (error, opened) => {
        if (error || !opened) reject(invalid());
        else resolve(opened);
      },
    );
  });
  try {
    await new Promise<void>((resolve, reject) => {
      let total = 0;
      const names = new Set<string>();
      const required = new Map([
        [
          "[Content_Types].xml",
          /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document\.main\+xml/,
        ],
        ["_rels/.rels", /relationships\/officeDocument/],
        ["word/document.xml", /<\w*:?(?:document)(?:\s|>)/],
      ]);
      if (zip.entryCount > 1000) {
        reject(invalid());
        return;
      }
      zip.once("error", () => reject(invalid()));
      zip.once("end", () => (required.size ? reject(invalid()) : resolve()));
      zip.on("entry", (entry: Entry) => {
        total += entry.uncompressedSize;
        const path = entry.fileName;
        const name = path.toLowerCase();
        if (
          total > 30 * 1024 * 1024 ||
          names.has(name) ||
          entry.isEncrypted() ||
          name.includes("vbaproject") ||
          name.startsWith("word/embeddings/") ||
          ((entry.externalFileAttributes >>> 16) & 0xf000) === 0xa000
        ) {
          reject(invalid());
          return;
        }
        names.add(name);
        const pattern = required.get(path);
        if (!pattern) {
          zip.readEntry();
          return;
        }
        if (entry.uncompressedSize > maxResumeBytes) {
          reject(invalid());
          return;
        }
        zip.openReadStream(entry, (error, stream) => {
          if (error || !stream) {
            reject(invalid());
            return;
          }
          const chunks: Buffer[] = [];
          stream.on("data", (chunk: Buffer) => chunks.push(chunk));
          stream.once("error", () => reject(invalid()));
          stream.once("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            if (!pattern.test(text) || /<!DOCTYPE|<!ENTITY|macroEnabled/i.test(text))
              reject(invalid());
            else {
              required.delete(path);
              zip.readEntry();
            }
          });
        });
      });
      zip.readEntry();
    });
  } finally {
    zip.close();
  }
}

export async function inspectResume(file: Express.Multer.File | undefined) {
  if (!file || !file.size || file.size > maxResumeBytes) throw invalid();
  const filename = basename(file.originalname.replaceAll("\\", "/")).replace(
    /[^a-zA-Z0-9 ._()-]/g,
    "_",
  );
  if (!filename || filename.length > 120 || filename.startsWith(".")) throw invalid();
  const extension = extname(filename).toLowerCase();
  if (extension === ".pdf") {
    const header = file.buffer.subarray(0, 9).toString("ascii");
    const trailer = file.buffer.subarray(-2048).toString("latin1");
    const pointer = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(trailer);
    const offset = Number(pointer?.[1]);
    if (
      !/^%PDF-[12]\.\d/.test(header) ||
      !Number.isSafeInteger(offset) ||
      offset <= 0 ||
      offset >= file.size
    ) {
      throw invalid();
    }
    const crossReference = file.buffer.subarray(offset, offset + 2048).toString("latin1");
    if (
      !/^xref[\r\n\t ]/.test(crossReference) &&
      !/^\d+\s+\d+\s+obj\s*<<[\s\S]{0,1800}\/Type\s*\/XRef\b/.test(crossReference)
    )
      throw invalid();
    return { filename, contentType: "application/pdf" };
  }
  if (extension === ".docx") {
    await validateDocx(file.buffer);
    return {
      filename,
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }
  throw invalid();
}
