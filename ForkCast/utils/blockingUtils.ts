import { supabase } from "@/config/supabase";

/**
 * Get list of user IDs that the current user has blocked
 * This can be used to filter content from blocked users
 */
export async function getBlockedUserIds(
  currentUserId?: string,
): Promise<string[]> {
  if (!currentUserId) return [];

  try {
    const { data, error } = await supabase
      .from("blocked_users")
      .select("blocked_id")
      .eq("blocker_id", currentUserId);

    if (error) {
      console.warn("Failed to fetch blocked users:", error);
      return [];
    }

    return data?.map((row) => row.blocked_id) || [];
  } catch (error) {
    console.warn("Error fetching blocked users:", error);
    return [];
  }
}

/**
 * Get list of user IDs who have blocked the current user
 * This can be used to prevent the current user's content from being shown to those users
 */
export async function getBlockingUserIds(
  currentUserId?: string,
): Promise<string[]> {
  if (!currentUserId) return [];

  try {
    const { data, error } = await supabase
      .from("blocked_users")
      .select("blocker_id")
      .eq("blocked_id", currentUserId);

    if (error) {
      console.warn("Failed to fetch blocking users:", error);
      return [];
    }

    return data?.map((row) => row.blocker_id) || [];
  } catch (error) {
    console.warn("Error fetching blocking users:", error);
    return [];
  }
}

/**
 * Check if a user is blocked by the current user
 */
export async function isUserBlocked(
  currentUserId?: string,
  targetUserId?: string,
): Promise<boolean> {
  if (!currentUserId || !targetUserId) return false;

  try {
    const { data, error } = await supabase
      .from("blocked_users")
      .select("id")
      .eq("blocker_id", currentUserId)
      .eq("blocked_id", targetUserId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.warn("Failed to check if user is blocked:", error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.warn("Error checking if user is blocked:", error);
    return false;
  }
}

/**
 * Filter an array of items that have a user_id property to exclude blocked users
 */
export function filterBlockedUsers<T extends { user_id?: string }>(
  items: T[],
  blockedUserIds: string[],
): T[] {
  if (blockedUserIds.length === 0) return items;

  return items.filter(
    (item) => item.user_id && !blockedUserIds.includes(item.user_id),
  );
}

/**
 * Filter an array of items with nested user objects to exclude blocked users
 */
export function filterBlockedUsersNested<T extends { user?: { id: string } }>(
  items: T[],
  blockedUserIds: string[],
): T[] {
  if (blockedUserIds.length === 0) return items;

  return items.filter(
    (item) => !item.user || !blockedUserIds.includes(item.user.id),
  );
}

/**
 * Add blocked users filter to a Supabase query builder
 * This modifies the query to exclude content from blocked users
 */
export function addBlockedUsersFilter(
  queryBuilder: any,
  currentUserId?: string,
  userIdColumn = "user_id",
) {
  if (!currentUserId) return queryBuilder;

  // Use the .not() method with 'in' operator and a properly formatted subquery
  return queryBuilder.not(
    userIdColumn,
    "in",
    `(SELECT blocked_id FROM blocked_users WHERE blocker_id = ${currentUserId})`,
  );
}

/**
 * Create a WHERE condition to exclude blocked users in raw SQL
 */
export function getBlockedUsersWhereCondition(
  currentUserId?: string,
  userIdColumn = "user_id",
): string {
  if (!currentUserId) return "";

  return `AND ${userIdColumn} NOT IN (
    SELECT blocked_id 
    FROM blocked_users 
    WHERE blocker_id = '${currentUserId}'
  )`;
}
