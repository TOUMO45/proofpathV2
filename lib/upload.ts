// Reading an uploaded .md / .txt file. Read locally in the browser with
// FileReader; nothing is sent anywhere. The text then goes through the same
// normalize() and screens as pasted text.

export const MAX_UPLOAD_BYTES = 200 * 1024;
const ALLOWED = /\.(md|markdown|txt)$/i;

export type UploadCheck = { ok: true } | { ok: false; error: string };

/** Validate name, type and size before reading. Pure, so it's testable without a browser. */
export function checkUpload(file: { name: string; size: number; type?: string }): UploadCheck {
  if (!ALLOWED.test(file.name)) {
    return { ok: false, error: `"${file.name}" isn't a .md or .txt file. Upload a Markdown or plain-text file, or paste the text.` };
  }
  if (file.type && !/^(text\/|$)/.test(file.type) && file.type !== "application/octet-stream") {
    return { ok: false, error: `"${file.name}" isn't plain text (${file.type}). Upload a .md or .txt file, or paste the text.` };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `"${file.name}" is ${Math.ceil(file.size / 1024)} KB; the limit is 200 KB. Paste the relevant part instead.` };
  }
  return { ok: true };
}

/** Check, then read the file as text in the browser. */
export function readTextFile(file: File): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const check = checkUpload(file);
  if (!check.ok) return Promise.resolve(check);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ ok: true, text: String(reader.result ?? "") });
    reader.onerror = () => resolve({ ok: false, error: `"${file.name}" couldn't be read. Paste the text instead.` });
    reader.readAsText(file);
  });
}
