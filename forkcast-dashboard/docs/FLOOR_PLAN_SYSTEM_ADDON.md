# Floor Plan & Advanced Booking System Add-on

## 1. Overview
The Floor Plan system is an add-on that introduces visual 2D layouts, section-based capacity management, and a highly configurable rules engine for determining booking types (Instant vs. Request). This document outlines the core architecture and database schema to guide mobile app implementation.

## 2. Database Schema Changes

### `restaurant_sections`
*   **`decor_items` (JSONB):** Stores visual elements (walls, plants, doors, etc.) for rendering the floor plan canvas.
*   **`max_covers` (Integer, Nullable):** A manual override for the maximum number of guests allowed in a section at one time. If `null`, the system auto-computes capacity by summing the capacities of all tables in the section.

### `restaurant_tables`
*   **`default_booking_type` (Text):** The baseline booking behavior for the table. Values are strictly `'instant'` (auto-confirm) or `'request'` (requires staff approval).

### `table_booking_rules` (New Table)
Stores conditional rules that override a table's `default_booking_type`.
*   **`table_id` (UUID):** The table this rule applies to.
*   **`booking_type` (Text):** The resulting type if the rule matches (`'instant'` or `'request'`).
*   **`conditions` (JSONB):** An array of conditions that must ALL be met (AND logic) for the rule to apply.
*   **`priority` (Integer):** Determines evaluation order (highest priority is evaluated first).
*   **`is_active` (Boolean):** Toggle to enable/disable the rule.

### `bookings`
*   **`section_id` (UUID, Nullable):** Links a booking directly to a section. This supports section-based bookings where a specific table hasn't been assigned yet.

## 3. Core Functionalities & Logic

### A. Visual Floor Plan (Canvas)
*   **Rendering:** Tables are rendered based on their `x_position`, `y_position`, `width`, `height`, and `shape` (rectangle, circle, square).
*   **Decor:** Non-interactive visual elements are rendered using the `decor_items` JSON array from the section.
*   **Status:** Tables are color-coded based on real-time status (available, occupied, reserved, etc.).

### B. Section Capacity Management
*   **Capacity Calculation:** A section's max capacity is either its `max_covers` override or the sum of the `max_capacity` of all active tables within it.
*   **Current Load:** The system calculates current covers by summing the `party_size` of all active bookings (confirmed, seated, etc.) in that section for a specific time slot.
*   **Impact Check:** Before confirming a booking, the system checks if adding the new party size exceeds the section's maximum capacity.
*   **Alternatives:** If capacity is exceeded, the system automatically finds and suggests alternative sections that have enough available covers.

### C. Conditional Booking Rules Engine
Determines whether a booking is automatically confirmed or requires staff approval.
*   **Evaluation Flow:**
    1. Fetch all active rules for the requested table(s), sorted by `priority` descending.
    2. Evaluate the booking context against the rule's `conditions`.
    3. The first matching rule dictates the booking type.
    4. If no rules match, it falls back to the table's `default_booking_type`.
*   **Supported Conditions:**
    *   `party_size` (e.g., `>= 6` guests)
    *   `day_of_week` (e.g., Fridays and Saturdays)
    *   `time_range` (e.g., `18:00` to `21:00`)
    *   `date_range` (e.g., specific holidays)
*   **Multi-Table Logic:** If a booking spans multiple tables, and *any* of those tables resolves to a `'request'` type, the entire booking becomes a `'request'`.

## 4. Mobile App Implementation Guidelines

When implementing this on the mobile app, focus on the following core areas:

1.  **Canvas Rendering:** Implement a 2D view that can parse and render tables (using X/Y coordinates and shapes) and `decor_items` for a given section.
2.  **Section-Based Booking:** Update the booking flow to allow users to select a `section_id` if they don't want to pick a specific table.
3.  **Capacity Validation:** Ensure the booking flow checks section capacity before submission. If the section is full, display the alternative sections returned by the backend.
4.  **Dynamic Booking Types:** The UI should clearly indicate to the user whether their booking will be instantly confirmed or if it is a request pending approval. This requires evaluating the `table_booking_rules` (or relying on the backend response) based on their selected party size, date, and time.