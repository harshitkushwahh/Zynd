export const PROFILE_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const PROFILE_IMAGE_MIN_DIMENSION = 128;
export const PROFILE_IMAGE_MAX_DIMENSION = 2048;

export const PROFILE_IMAGE_ACCEPT =
  "image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const HEIC_MIME_TYPES = new Set(["image/heic", "image/heif"]);

function isHeicFile(file: File) {
  const type = file.type.toLowerCase();
  if (HEIC_MIME_TYPES.has(type)) return true;
  const name = file.name.toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif");
}

async function convertHeicToJpeg(file: File): Promise<File> {
  const heic2any = (await import("heic2any")).default;
  const converted = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.88,
  });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  const baseName = file.name.replace(/\.[^.]+$/, "") || "profile-photo";
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
}

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

  let workingFile = file;
  const mime = (workingFile.type || "").toLowerCase();

  if (isHeicFile(workingFile)) {
    try {
      workingFile = await convertHeicToJpeg(workingFile);
    } catch {
      return {
        ok: false,
        message: "Could not convert HEIC photo. Try exporting as JPEG from your device.",
      };
    }
  } else if (mime && !ALLOWED_MIME_TYPES.has(mime)) {
    return { ok: false, message: "Use JPG, PNG, WEBP, or HEIC." };
  }

  if (workingFile.size > PROFILE_IMAGE_MAX_BYTES) {
    return { ok: false, message: "Photo must be 4 MB or smaller." };
  }

  try {
    const { width, height } = await loadImageDimensions(workingFile);
    if (width < PROFILE_IMAGE_MIN_DIMENSION || height < PROFILE_IMAGE_MIN_DIMENSION) {
      return {
        ok: false,
        message: `Photo must be at least ${PROFILE_IMAGE_MIN_DIMENSION}x${PROFILE_IMAGE_MIN_DIMENSION} pixels.`,
      };
    }
  } catch {
    return { ok: false, message: "Could not read image file." };
  }

  return { ok: true, file: workingFile };
}
