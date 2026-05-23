export function parsePostGISGeometry(hexString) {
  try {
    if (!hexString || typeof hexString !== "string") {
      throw new Error("Invalid hex string");
    }

    // Convert hex to bytes
    const bytes = [];
    for (let i = 0; i < hexString.length; i += 2) {
      bytes.push(parseInt(hexString.substr(i, 2), 16));
    }

    const dataView = new DataView(new Uint8Array(bytes).buffer);

    // Read endianness (1 byte)
    const endianness = dataView.getUint8(0);
    const isLittleEndian = endianness === 1;

    // Read geometry type (4 bytes)
    const geometryType = dataView.getUint32(1, isLittleEndian);

    // Read SRID (4 bytes) - starts at byte 5
    const srid = dataView.getUint32(5, isLittleEndian);

    // Read coordinates (8 bytes each, starting at byte 9)
    const longitude = dataView.getFloat64(9, isLittleEndian);
    const latitude = dataView.getFloat64(17, isLittleEndian);

    // Validate coordinates
    if (isNaN(latitude) || isNaN(longitude)) {
      throw new Error("Invalid coordinates");
    }

    return { latitude, longitude };
  } catch (error) {
    console.error("Error parsing PostGIS geometry:", error);
    return null;
  }
}

// Function to detect if text contains Arabic characters
function containsArabic(text) {
  const arabicRegex =
    /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return arabicRegex.test(text);
}

// Function to clean and validate address parts
function cleanAddressPart(part) {
  if (!part || typeof part !== "string") return null;

  // Remove Arabic characters completely
  const cleaned = part
    .replace(
      /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g,
      "",
    )
    .trim();

  // If nothing left after removing Arabic, return null
  if (!cleaned || cleaned.length === 0) return null;

  return cleaned;
}

export async function getAddressFromCoordinates(latitude, longitude) {
  try {
    // Add user agent header and FORCE English language aggressively
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16&addressdetails=1&accept-language=en-US,en&namedetails=1&extratags=1`,
      {
        signal: controller.signal,
        headers: {
          "User-Agent": "RestaurantApp/1.0",
          "Accept-Language": "en-US,en;q=1.0,ar;q=0.1",
          "Accept-Charset": "utf-8",
        },
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    // Build address from components, filtering out Arabic text
    const address = data.address;
    if (address) {
      const parts = [];

      // Try to get English names, clean them, and validate
      const roadName =
        cleanAddressPart(address.road) ||
        cleanAddressPart(address.street) ||
        cleanAddressPart(address.pedestrian);

      if (roadName) {
        parts.push(roadName);
      }

      // Add neighborhood or area (English only)
      const areaName =
        cleanAddressPart(address.neighbourhood) ||
        cleanAddressPart(address.suburb) ||
        cleanAddressPart(address.quarter) ||
        cleanAddressPart(address.district);

      if (areaName && !parts.includes(areaName)) {
        parts.push(areaName);
      }

      // Add city/town only if we don't have enough parts
      if (parts.length === 1) {
        const cityName =
          cleanAddressPart(address.city) ||
          cleanAddressPart(address.town) ||
          cleanAddressPart(address.municipality);

        if (cityName && !parts.includes(cityName)) {
          parts.push(cityName);
        }
      }

      // If we have clean English parts, return them
      if (parts.length > 0) {
        const result = parts.join(", ");
        // Double-check no Arabic made it through
        if (!containsArabic(result)) {
          return result;
        }
      }
    }

    // Try display_name as fallback, but clean it first
    if (data.display_name) {
      const displayParts = data.display_name.split(", ");
      const cleanParts = displayParts
        .map((part) => cleanAddressPart(part))
        .filter((part) => part && part.length > 0)
        .slice(0, 2); // Take first 2 clean parts

      if (cleanParts.length > 0) {
        const result = cleanParts.join(", ");
        if (!containsArabic(result)) {
          return result;
        }
      }
    }

    // If all else fails, return coordinates (guaranteed English)
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  } catch (error) {
    console.error("Geocoding error:", error);
    // Return formatted coordinates as fallback (always English)
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }
}

export async function postgisToAddress(postgisGeometry) {
  try {
    if (!postgisGeometry) {
      return "Location not available";
    }

    const coordinates = parsePostGISGeometry(postgisGeometry);
    if (!coordinates) {
      return "Invalid location format";
    }

    const { latitude, longitude } = coordinates;
    return await getAddressFromCoordinates(latitude, longitude);
  } catch (error) {
    console.error("Location conversion error:", error);
    return "Location unavailable";
  }
}

// Alternative function that just returns formatted coordinates
export function postgisToCoordinates(postgisGeometry) {
  try {
    const coordinates = parsePostGISGeometry(postgisGeometry);
    if (!coordinates) {
      return "Invalid location";
    }

    const { latitude, longitude } = coordinates;
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  } catch (error) {
    console.error("Location conversion error:", error);
    return "Invalid location";
  }
}
