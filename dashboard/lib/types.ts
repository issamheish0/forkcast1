export type Restaurant = {
  id: string;
  owner_id: string | null;
  name: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  cuisine_type: string | null;
  price_range: number | null;
  average_rating: number | null;
  main_image_url: string | null;
  phone_number: string | null;
  booking_policy: "instant" | "request";
  min_party_size: number;
  max_party_size: number;
};

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  phone_number: string | null;
  avatar_url: string | null;
};

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "completed";

export type Booking = {
  id: string;
  user_id: string;
  restaurant_id: string;
  booking_time: string;
  party_size: number;
  status: BookingStatus;
  special_requests: string | null;
  confirmation_code: string;
  created_at: string;
  updated_at: string;
  // joined
  user?: Pick<Profile, "id" | "full_name" | "email" | "phone_number"> | null;
  restaurant?: Pick<Restaurant, "id" | "name"> | null;
};
