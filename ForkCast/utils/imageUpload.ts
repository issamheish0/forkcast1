// utils/imageUpload.ts
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";
import { Alert, Platform } from "react-native";
import { supabase } from "@/config/supabase";

interface UploadImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  bucket?: string;
  folder?: string;
}

// Client-side cap; the authoritative per-bucket caps live in
// `supabase/migrations/20260424120151_restrict_image_upload_buckets.sql`
// (avatars 8 MiB, images 10 MiB, review-photos 10 MiB). We set the client
// cap to the most permissive server cap so we don't pre-reject uploads that
// the server would accept.
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MiB
export const ALLOWED_IMAGE_TYPES: string[] = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

// Strict whitelist used for server-trust validation (MA04 fix).
// `image/jpg` is intentionally excluded — it is non-standard.
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

// Extension whitelist. Always compare lowercased.
export const ALLOWED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;

// Extensions we must never accept as part of a filename, even as a non-final
// component (defends against double-extension tricks like `pic.png.js`).
const FORBIDDEN_EXTENSION_TOKENS = new Set([
  "exe",
  "sh",
  "bat",
  "cmd",
  "com",
  "msi",
  "app",
  "scr",
  "ps1",
  "js",
  "mjs",
  "cjs",
  "jsx",
  "ts",
  "tsx",
  "php",
  "phtml",
  "asp",
  "aspx",
  "jsp",
  "py",
  "rb",
  "pl",
  "cgi",
  "html",
  "htm",
  "svg",
  "xml",
  "dll",
  "so",
  "dylib",
  "jar",
  "war",
  "apk",
  "ipa",
]);

const EXTENSION_TO_MIME: Record<
  (typeof ALLOWED_IMAGE_EXTENSIONS)[number],
  AllowedImageMime
> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

// Canonical extension used on disk for each sniffed MIME (avoids `.jpg` vs
// `.jpeg` ambiguity and collapses any client-supplied extension).
const MIME_TO_EXTENSION: Record<AllowedImageMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Read the first `byteCount` bytes of a local file and return them as a
 * Uint8Array. Used for server-trust MIME sniffing; we never rely on the
 * client-reported Content-Type or the URI extension.
 */
const readFileHeader = async (
  uri: string,
  byteCount = 16,
): Promise<Uint8Array> => {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
    length: byteCount,
    position: 0,
  });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

/**
 * Magic-byte sniffer for the three image formats we accept. Returns the
 * canonical MIME type or null if the file is not one of the allowed formats.
 *
 * - JPEG: FF D8 FF
 * - PNG:  89 50 4E 47 0D 0A 1A 0A
 * - WebP: "RIFF" ???? "WEBP"
 */
export const sniffImageMime = (header: Uint8Array): AllowedImageMime | null => {
  if (
    header.length >= 3 &&
    header[0] === 0xff &&
    header[1] === 0xd8 &&
    header[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    header.length >= 8 &&
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47 &&
    header[4] === 0x0d &&
    header[5] === 0x0a &&
    header[6] === 0x1a &&
    header[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    header.length >= 12 &&
    header[0] === 0x52 &&
    header[1] === 0x49 &&
    header[2] === 0x46 &&
    header[3] === 0x46 &&
    header[8] === 0x57 &&
    header[9] === 0x45 &&
    header[10] === 0x42 &&
    header[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
};

/**
 * Strip any user-influenced filename down to a safe base. Rejects
 * double-extension payloads like `avatar.png.js` by refusing any non-final
 * segment that matches a forbidden executable extension.
 */
export const sanitizeFileBaseName = (name: string): string => {
  // Drop path separators and keep only the last path segment.
  const lastSegment = name.split(/[\\/]/).pop() ?? "";
  // Strip the final extension — we supply our own based on sniffed MIME.
  const withoutExt = lastSegment.replace(/\.[^.]*$/, "");
  // Replace everything that isn't ASCII alnum/dash/underscore with an
  // underscore. This also collapses any remaining dots, killing double
  // extensions entirely.
  return withoutExt.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 64) || "file";
};

/**
 * True if any segment of the filename (other than the final one we will
 * replace) looks like an executable extension. Used purely as a signal to
 * reject the upload outright rather than silently rename.
 */
export const hasDangerousExtensionToken = (uri: string): boolean => {
  const lastSegment = uri.split(/[\\/]/).pop() ?? "";
  const tokens = lastSegment.toLowerCase().split(".");
  // Ignore the very last token — that's the primary extension we validate
  // separately. Everything before it must not be an executable suffix.
  for (let i = 0; i < tokens.length - 1; i++) {
    if (FORBIDDEN_EXTENSION_TOKENS.has(tokens[i])) {
      return true;
    }
  }
  return false;
};

/**
 * Produce a cryptographically random, collision-resistant filename with a
 * canonical, whitelisted extension derived from the sniffed MIME type. Any
 * client-supplied basename is ignored; there is no path traversal surface.
 */
export const buildSecureStoragePath = (
  folder: string,
  mime: AllowedImageMime,
): string => {
  const ext = MIME_TO_EXTENSION[mime];
  const uuid = Crypto.randomUUID();
  const cleanFolder = folder
    .replace(/[^a-zA-Z0-9_\-/]+/g, "")
    .replace(/^\/+|\/+$/g, "");
  return `${cleanFolder}/${uuid}.${ext}`;
};

export interface StrictImageValidationResult {
  valid: boolean;
  error?: string;
  mime?: AllowedImageMime;
  extension?: string;
  size?: number;
}

/**
 * Server-trust image validation for MA04. Runs four independent checks and
 * requires every one of them to agree:
 *   1. Extension whitelist (lowercased, from URI)
 *   2. Picker-reported MIME whitelist (when available)
 *   3. Magic-byte sniff of the actual file bytes (authoritative)
 *   4. File size under `maxSize`
 *
 * Extension and picker MIME must both be consistent with the sniffed MIME;
 * any mismatch → reject. Any filename path segment matching a known
 * executable extension (`.png.js`, `pic.exe.jpg`, …) → reject.
 */
export const validateImageStrict = async (
  asset: ImagePicker.ImagePickerAsset,
  maxSize: number = MAX_IMAGE_SIZE,
): Promise<StrictImageValidationResult> => {
  if (!asset?.uri) {
    return { valid: false, error: "No image selected." };
  }

  if (hasDangerousExtensionToken(asset.uri)) {
    return {
      valid: false,
      error: "That filename is not allowed.",
    };
  }

  const rawExt =
    asset.uri.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase() ?? "";
  if (!(ALLOWED_IMAGE_EXTENSIONS as readonly string[]).includes(rawExt)) {
    return {
      valid: false,
      error: "Please choose a JPEG, PNG, or WebP image.",
    };
  }
  const extMime =
    EXTENSION_TO_MIME[rawExt as (typeof ALLOWED_IMAGE_EXTENSIONS)[number]];

  if (asset.mimeType) {
    const reported = asset.mimeType.toLowerCase();
    const normalized = reported === "image/jpg" ? "image/jpeg" : reported;
    if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(normalized)) {
      return {
        valid: false,
        error: "Please choose a JPEG, PNG, or WebP image.",
      };
    }
    if (normalized !== extMime) {
      return {
        valid: false,
        error: "This image's type does not match its extension.",
      };
    }
  }

  let size = asset.fileSize;
  if (size === undefined) {
    try {
      const info = await FileSystem.getInfoAsync(asset.uri);
      if (
        info.exists &&
        !info.isDirectory &&
        typeof (info as { size?: number }).size === "number"
      ) {
        size = (info as { size: number }).size;
      }
    } catch {
      // fall through — handled below
    }
  }
  if (typeof size === "number" && size > maxSize) {
    const mb = Math.round(maxSize / (1024 * 1024));
    return {
      valid: false,
      error: `Image is too large. Maximum size is ${mb}MB.`,
    };
  }

  let sniffedMime: AllowedImageMime | null = null;
  try {
    const header = await readFileHeader(asset.uri, 16);
    sniffedMime = sniffImageMime(header);
  } catch (err) {
    return {
      valid: false,
      error: "Could not read the selected image.",
    };
  }
  if (!sniffedMime) {
    return {
      valid: false,
      error: "That file is not a valid JPEG, PNG, or WebP image.",
    };
  }
  if (sniffedMime !== extMime) {
    return {
      valid: false,
      error: "This image's contents do not match its file type.",
    };
  }

  return {
    valid: true,
    mime: sniffedMime,
    extension: MIME_TO_EXTENSION[sniffedMime],
    size,
  };
};

// Convert base64 to blob
export const base64ToBlob = (
  base64: string,
  contentType: string = "image/jpeg",
): Blob => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
};

// Image size presets matching optimization utility
export const IMAGE_SIZE_PRESETS = {
  thumbnail: { maxWidth: 150, maxHeight: 150, quality: 0.7 },
  small: { maxWidth: 400, maxHeight: 400, quality: 0.75 },
  medium: { maxWidth: 800, maxHeight: 800, quality: 0.8 },
  large: { maxWidth: 1200, maxHeight: 1200, quality: 0.85 },
  original: { maxWidth: 1920, maxHeight: 1920, quality: 0.9 },
} as const;

// Compress and resize image
export const processImage = async (
  uri: string,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    format?: ImageManipulator.SaveFormat;
  } = {},
): Promise<ImageManipulator.ImageResult> => {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.8,
    format = ImageManipulator.SaveFormat.WEBP,
  } = options;

  // Get image info
  const imageInfo = await ImageManipulator.manipulateAsync(uri, [], {
    format: ImageManipulator.SaveFormat.JPEG,
  });

  // Calculate resize dimensions while maintaining aspect ratio
  const { width, height } = imageInfo;
  let resizeWidth = width;
  let resizeHeight = height;

  if (width > maxWidth || height > maxHeight) {
    const aspectRatio = width / height;

    if (width > height) {
      resizeWidth = Math.min(maxWidth, width);
      resizeHeight = resizeWidth / aspectRatio;
    } else {
      resizeHeight = Math.min(maxHeight, height);
      resizeWidth = resizeHeight * aspectRatio;
    }
  }

  // Process image with WebP format for better compression
  return await ImageManipulator.manipulateAsync(
    uri,
    [
      {
        resize: {
          width: Math.round(resizeWidth),
          height: Math.round(resizeHeight),
        },
      },
    ],
    {
      compress: quality,
      format,
      base64: true,
    },
  );
};

// Upload single image to Supabase with optimized compression
export const uploadImage = async (
  imageData: {
    uri: string;
    base64?: string;
  },
  userId: string,
  options: UploadImageOptions = {},
): Promise<{ url: string; path: string } | null> => {
  const {
    maxWidth = 1200, // Reduced from 1920 for better compression
    maxHeight = 1200,
    quality = 0.8,
    bucket = "images",
    folder = "posts",
  } = options;

  try {
    // Process image with WebP for 30-50% better compression than JPEG
    const processedImage = await processImage(imageData.uri, {
      maxWidth,
      maxHeight,
      quality,
      format: ImageManipulator.SaveFormat.WEBP,
    });

    if (!processedImage.base64) {
      throw new Error("Failed to process image");
    }

    // Generate unique filename with WebP extension
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 9);
    const fileName = `${timestamp}-${randomId}.webp`;
    const filePath = `${folder}/${userId}/${fileName}`;

    // Convert to blob and upload
    const blob = base64ToBlob(processedImage.base64, "image/webp");

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, blob, {
        contentType: "image/webp",
        cacheControl: "max-age=31536000, public", // 1 year cache (images are immutable)
        upsert: false,
      });

    if (error) throw error;

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(filePath);

    return {
      url: publicUrl,
      path: filePath,
    };
  } catch (error) {
    console.error("Error uploading image:", error);
    return null;
  }
};

// Upload multiple images
export const uploadImages = async (
  images: { uri: string; base64?: string }[],
  userId: string,
  options: UploadImageOptions = {},
): Promise<string[]> => {
  const uploadPromises = images.map((image) =>
    uploadImage(image, userId, options),
  );
  const results = await Promise.all(uploadPromises);

  return results
    .filter(
      (result): result is { url: string; path: string } => result !== null,
    )
    .map((result) => result.url);
};

/**
 * Upload image with multiple size variants for optimal bandwidth usage
 * Generates: thumbnail (150px), small (400px), medium (800px), large (1200px)
 * Use this for main restaurant images, gallery images, and other frequently accessed images
 *
 * Example bandwidth savings for 41,322 requests:
 * - Original (3MB): 124GB
 * - Thumbnail (50KB): 2GB (98% reduction)
 * - Small (150KB): 6GB (95% reduction)
 * - Medium (300KB): 12GB (90% reduction)
 * - Large (600KB): 25GB (80% reduction)
 */
export const uploadImageWithSizes = async (
  imageData: {
    uri: string;
    base64?: string;
  },
  userId: string,
  options: {
    bucket?: string;
    folder?: string;
    sizes?: (keyof typeof IMAGE_SIZE_PRESETS)[];
  } = {},
): Promise<{
  thumbnail?: string;
  small?: string;
  medium?: string;
  large?: string;
  original?: string;
} | null> => {
  const {
    bucket = "images",
    folder = "gallery",
    sizes = ["thumbnail", "small", "medium", "large"],
  } = options;

  try {
    const baseTimestamp = Date.now();
    const baseRandomId = Math.random().toString(36).substring(2, 9);

    const urls: Record<string, string> = {};

    // Generate and upload each size variant
    for (const size of sizes) {
      const preset = IMAGE_SIZE_PRESETS[size];

      const processedImage = await processImage(imageData.uri, {
        maxWidth: preset.maxWidth,
        maxHeight: preset.maxHeight,
        quality: preset.quality,
        format: ImageManipulator.SaveFormat.WEBP,
      });

      if (!processedImage.base64) {
        console.warn(`Failed to process ${size} variant, skipping`);
        continue;
      }

      const fileName = `${baseTimestamp}_${baseRandomId}_${size}.webp`;
      const filePath = `${folder}/${userId}/${fileName}`;

      const blob = base64ToBlob(processedImage.base64, "image/webp");

      const { error } = await supabase.storage
        .from(bucket)
        .upload(filePath, blob, {
          contentType: "image/webp",
          cacheControl: "max-age=31536000, public",
          upsert: false,
        });

      if (error) {
        console.error("Error uploading image variant:", size, error);
        continue;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(filePath);

      urls[size] = publicUrl;
    }

    if (Object.keys(urls).length === 0) {
      throw new Error("Failed to upload any image variants");
    }

    return urls as any;
  } catch (error) {
    console.error("Error uploading image with sizes:", error);
    return null;
  }
};

// Delete image from storage
export const deleteImage = async (
  imagePath: string,
  bucket: string = "images",
): Promise<boolean> => {
  try {
    const { error } = await supabase.storage.from(bucket).remove([imagePath]);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error deleting image:", error);
    return false;
  }
};

// Pick images from gallery
export const pickImagesFromGallery = async (
  options: {
    allowsMultipleSelection?: boolean;
    maxSelection?: number;
  } = {},
): Promise<ImagePicker.ImagePickerAsset[] | null> => {
  const { allowsMultipleSelection = true, maxSelection = 5 } = options;

  // Android 13+ uses the system Photo Picker — no READ_MEDIA_IMAGES needed.
  // Older Android and iOS still require an explicit permission grant.
  if (Platform.OS !== "android" || Platform.Version < 33) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library to upload images.",
      );
      return null;
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection,
    quality: 1,
    base64: true,
  });

  if (result.canceled) {
    return null;
  }

  // Limit selection
  if (result.assets.length > maxSelection) {
    Alert.alert(
      "Too Many Images",
      `You can only select up to ${maxSelection} images at once.`,
    );
    return result.assets.slice(0, maxSelection);
  }

  return result.assets;
};

// Take photo with camera
export const takePhotoWithCamera =
  async (): Promise<ImagePicker.ImagePickerAsset | null> => {
    // Request permission
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow access to your camera to take photos.",
      );
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
      base64: true,
    });

    if (result.canceled) {
      return null;
    }

    return result.assets[0];
  };

// Validate image
export const validateImage = (
  image: ImagePicker.ImagePickerAsset,
): { valid: boolean; error?: string } => {
  // Check file type
  if (image.type && !ALLOWED_IMAGE_TYPES.includes(image.type)) {
    return {
      valid: false,
      error: "Invalid file type. Please upload JPEG, PNG, or WebP images.",
    };
  }

  // Check file size (if available)
  if (image.fileSize && image.fileSize > MAX_IMAGE_SIZE) {
    return {
      valid: false,
      error: "Image is too large. Maximum size is 5MB.",
    };
  }

  return { valid: true };
};

// Get image dimensions
export const getImageDimensions = async (
  uri: string,
): Promise<{ width: number; height: number } | null> => {
  try {
    const info = await ImageManipulator.manipulateAsync(uri, [], {
      format: ImageManipulator.SaveFormat.JPEG,
    });

    return {
      width: info.width,
      height: info.height,
    };
  } catch (error) {
    console.error("Error getting image dimensions:", error);
    return null;
  }
};
