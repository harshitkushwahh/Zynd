export function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(",");
  if (!header || !base64) {
    throw new Error("Invalid data URL.");
  }

  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], filename, { type: mimeType });
}
