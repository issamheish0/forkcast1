// Review tag options for Lebanese restaurants
export const REVIEW_TAGS = {
  positive: [
    "Authentic Lebanese",
    "Great Mezze",
    "Fresh Ingredients",
    "Excellent Service",
    "Cozy Atmosphere",
    "Good Value",
    "Fast Service",
    "Family Friendly",
    "Romantic",
    "Great Views",
    "Live Music",
    "Outdoor Seating",
    "Traditional Decor",
    "Friendly Staff",
    "Clean Environment",
    "Perfect Portions",
    "Fresh Bread",
    "Great Hummus",
    "Excellent Tabbouleh",
    "Beautiful Presentation",
  ],
  negative: [
    "Long Wait",
    "Overpriced",
    "Poor Service",
    "Noisy",
    "Limited Menu",
    "Parking Issues",
    "Not Authentic",
    "Small Portions",
    "Cold Food",
    "Slow Service",
    "Unfriendly Staff",
    "Dirty Tables",
    "No Atmosphere",
    "Overcooked",
    "Bland Taste",
    "Poor Quality",
  ],
};

// Review validation constraints
export const REVIEW_VALIDATION = {
  MIN_COMMENT_LENGTH: 0, // Optional - user can skip writing a comment
  MAX_COMMENT_LENGTH: 1000,
  MAX_PHOTOS: 5,
  MAX_TAGS: 10,
  MIN_TAGS: 0, // Optional - user can skip tags
};

// Point calculation constants
export const REVIEW_POINTS = {
  BASE_POINTS: 50,
  PHOTO_BONUS: 10,
  COMMENT_LENGTH_BONUSES: [
    { minLength: 50, points: 10 },
    { minLength: 100, points: 20 },
    { minLength: 200, points: 15 },
    { minLength: 300, points: 10 },
  ],
  TAG_BONUS_THRESHOLD: 3,
  TAG_BONUS_POINTS: 10,
  EXCELLENT_TAG_BONUS_THRESHOLD: 5,
  EXCELLENT_TAG_BONUS_POINTS: 5,
  ALL_RATINGS_BONUS: 15,
  MAX_POINTS: 150,
};
