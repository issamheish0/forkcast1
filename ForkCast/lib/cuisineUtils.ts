/**
 * Cuisine display utilities.
 * Ramadan is a collection/section (Iftar/Suhoor), not a cuisine type - excluded from display.
 */
const CUISINES_TO_HIDE = ["ramadan"];

const capitalizeCuisine = (cuisine: string): string =>
  cuisine.charAt(0).toUpperCase() + cuisine.slice(1).toLowerCase();

function filterCuisinesForDisplay(
  cuisines: (string | null | undefined)[],
): string[] {
  return cuisines
    .filter((c): c is string => typeof c === "string" && !!c)
    .filter((c) => !CUISINES_TO_HIDE.includes(c.toLowerCase()));
}

/**
 * Format cuisines for display (e.g. "Italian · Lebanese · +1").
 * Excludes Ramadan from the list.
 */
export function formatCuisines(
  cuisineType: string | null,
  secondaryCuisines: string[] | null | undefined,
  maxVisible = 2,
): string {
  const allCuisines = filterCuisinesForDisplay([
    cuisineType,
    ...(secondaryCuisines || []),
  ]).map(capitalizeCuisine);

  if (allCuisines.length <= maxVisible) {
    return allCuisines.join(" · ");
  }

  const visible = allCuisines.slice(0, maxVisible);
  const remaining = allCuisines.length - maxVisible;
  return `${visible.join(" · ")} · +${remaining}`;
}

/**
 * Get display cuisine when showing a single cuisine (e.g. for cards, headers).
 * Falls back to "Restaurant" or "Cuisine" when primary is Ramadan or empty.
 */
export function getDisplayCuisine(
  cuisineType: string | null | undefined,
  secondaryCuisines?: string[] | null,
  fallback = "Restaurant",
): string {
  const filtered = filterCuisinesForDisplay([
    cuisineType,
    ...(secondaryCuisines || []),
  ]);
  return filtered.length > 0 ? capitalizeCuisine(filtered[0]) : fallback;
}
