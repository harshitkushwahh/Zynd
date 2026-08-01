export type AddInvestorSignatureTab = "draw" | "upload";

export const ADD_INVESTOR_SIGNATURE_ACCEPT = "image/png,image/jpeg,image/jpg";
export const ADD_INVESTOR_SIGNATURE_MAX_BYTES = 2 * 1024 * 1024;

export const ADD_INVESTOR_SIGNATURE_INK_COLOR = "#171717";
export const ADD_INVESTOR_SIGNATURE_PAPER_COLOR = "#ffffff";

export function isSignatureCanvasBlank(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) return true;

  const { width, height } = canvas;
  if (width === 0 || height === 0) return true;

  const pixels = context.getImageData(0, 0, width, height).data;
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];

    if (red < 245 || green < 245 || blue < 245) {
      return false;
    }
  }

  return true;
}

export function fillSignatureCanvasPaper(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) return;

  context.fillStyle = ADD_INVESTOR_SIGNATURE_PAPER_COLOR;
  context.fillRect(0, 0, canvas.width, canvas.height);
}
