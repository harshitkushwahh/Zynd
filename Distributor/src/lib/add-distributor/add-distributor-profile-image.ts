export const PROFILE_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const PROFILE_IMAGE_MIN_DIMENSION = 128;

export const PROFILE_IMAGE_ACCEPT = "image/jpeg,image/jpg,image/png,image/webp";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

function loadImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions."));
    };
    image.src = url;
  });
}

export type ProfileImageValidationResult =
  | { ok: true; file: File }
  | { ok: false; message: string };

export async function prepareProfileImageFile(file: File): Promise<ProfileImageValidationResult> {
  if (!file) {
    return { ok: false, message: "Choose a photo to upload." };
  }

  const mime = (file.type || "").toLowerCase();
  if (mime && !ALLOWED_MIME_TYPES.has(mime)) {
    return { ok: false, message: "Use JPG, PNG, or WEBP." };
  }

  if (file.size > PROFILE_IMAGE_MAX_BYTES) {
    return { ok: false, message: "Photo must be 4 MB or smaller." };
  }

  try {
    const { width, height } = await loadImageDimensions(file);
    if (width < PROFILE_IMAGE_MIN_DIMENSION || height < PROFILE_IMAGE_MIN_DIMENSION) {
      return {
        ok: false,
        message: `Photo must be at least ${PROFILE_IMAGE_MIN_DIMENSION}x${PROFILE_IMAGE_MIN_DIMENSION} pixels.`,
      };
    }
  } catch {
    return { ok: false, message: "Could not read image file." };
  }

  return { ok: true, file };
}
