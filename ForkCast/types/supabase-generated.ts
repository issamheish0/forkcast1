export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4";
  };
  public: {
    Tables: {
      booking_archive: {
        Row: {
          applied_offer_id: string | null;
          archived_at: string | null;
          archived_by: string | null;
          attendees: number | null;
          booking_time: string;
          checked_in_at: string | null;
          confirmation_code: string | null;
          created_at: string | null;
          dietary_notes: string[] | null;
          expected_loyalty_points: number | null;
          guest_email: string | null;
          guest_name: string | null;
          guest_phone: string | null;
          id: string;
          is_group_booking: boolean | null;
          loyalty_points_earned: number | null;
          occasion: string | null;
          organizer_id: string | null;
          party_size: number;
          reminder_sent: boolean | null;
          restaurant_id: string;
          special_requests: string | null;
          status: string;
          table_preferences: string[] | null;
          turn_time_minutes: number;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          applied_offer_id?: string | null;
          archived_at?: string | null;
          archived_by?: string | null;
          attendees?: number | null;
          booking_time: string;
          checked_in_at?: string | null;
          confirmation_code?: string | null;
          created_at?: string | null;
          dietary_notes?: string[] | null;
          expected_loyalty_points?: number | null;
          guest_email?: string | null;
          guest_name?: string | null;
          guest_phone?: string | null;
          id?: string;
          is_group_booking?: boolean | null;
          loyalty_points_earned?: number | null;
          occasion?: string | null;
          organizer_id?: string | null;
          party_size: number;
          reminder_sent?: boolean | null;
          restaurant_id: string;
          special_requests?: string | null;
          status: string;
          table_preferences?: string[] | null;
          turn_time_minutes?: number;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          applied_offer_id?: string | null;
          archived_at?: string | null;
          archived_by?: string | null;
          attendees?: number | null;
          booking_time?: string;
          checked_in_at?: string | null;
          confirmation_code?: string | null;
          created_at?: string | null;
          dietary_notes?: string[] | null;
          expected_loyalty_points?: number | null;
          guest_email?: string | null;
          guest_name?: string | null;
          guest_phone?: string | null;
          id?: string;
          is_group_booking?: boolean | null;
          loyalty_points_earned?: number | null;
          occasion?: string | null;
          organizer_id?: string | null;
          party_size?: number;
          reminder_sent?: boolean | null;
          restaurant_id?: string;
          special_requests?: string | null;
          status?: string;
          table_preferences?: string[] | null;
          turn_time_minutes?: number;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_archive_archived_by_fkey";
            columns: ["archived_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_attendees: {
        Row: {
          booking_id: string;
          created_at: string | null;
          id: string;
          is_organizer: boolean | null;
          status: string;
          user_id: string;
        };
        Insert: {
          booking_id: string;
          created_at?: string | null;
          id?: string;
          is_organizer?: boolean | null;
          status?: string;
          user_id: string;
        };
        Update: {
          booking_id?: string;
          created_at?: string | null;
          id?: string;
          is_organizer?: boolean | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_attendees_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "active_dining_bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_attendees_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_attendees_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["booking_id"];
          },
          {
            foreignKeyName: "booking_attendees_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      banners: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          image_url: string | null;
          is_active: boolean;
          display_order: number | null;
          valid_from: string | null;
          valid_until: string | null;
          created_at: string | null;
          updated_at: string | null;
          special_offer_id: string | null;
          restaurant_id: string | null;
          special_event_id: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          image_url?: string | null;
          is_active?: boolean;
          display_order?: number | null;
          valid_from?: string | null;
          valid_until?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          special_offer_id?: string | null;
          restaurant_id?: string | null;
          special_event_id?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          image_url?: string | null;
          is_active?: boolean;
          display_order?: number | null;
          valid_from?: string | null;
          valid_until?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          special_offer_id?: string | null;
          restaurant_id?: string | null;
          special_event_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "banners_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "banners_special_offer_id_fkey";
            columns: ["special_offer_id"];
            isOneToOne: false;
            referencedRelation: "special_offers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "banners_special_event_id_fkey";
            columns: ["special_event_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_events";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_invites: {
        Row: {
          booking_id: string;
          created_at: string | null;
          from_user_id: string;
          id: string;
          message: string | null;
          responded_at: string | null;
          status: string;
          to_user_id: string;
        };
        Insert: {
          booking_id: string;
          created_at?: string | null;
          from_user_id: string;
          id?: string;
          message?: string | null;
          responded_at?: string | null;
          status?: string;
          to_user_id: string;
        };
        Update: {
          booking_id?: string;
          created_at?: string | null;
          from_user_id?: string;
          id?: string;
          message?: string | null;
          responded_at?: string | null;
          status?: string;
          to_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_invites_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "active_dining_bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_invites_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_invites_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["booking_id"];
          },
          {
            foreignKeyName: "booking_invites_from_user_id_fkey";
            columns: ["from_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_invites_to_user_id_fkey";
            columns: ["to_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_status_history: {
        Row: {
          booking_id: string;
          changed_at: string | null;
          changed_by: string | null;
          id: string;
          metadata: Json | null;
          new_status: string;
          old_status: string | null;
          reason: string | null;
        };
        Insert: {
          booking_id: string;
          changed_at?: string | null;
          changed_by?: string | null;
          id?: string;
          metadata?: Json | null;
          new_status: string;
          old_status?: string | null;
          reason?: string | null;
        };
        Update: {
          booking_id?: string;
          changed_at?: string | null;
          changed_by?: string | null;
          id?: string;
          metadata?: Json | null;
          new_status?: string;
          old_status?: string | null;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "booking_status_history_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "active_dining_bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_status_history_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_status_history_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["booking_id"];
          },
          {
            foreignKeyName: "booking_status_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_tables: {
        Row: {
          booking_id: string;
          created_at: string | null;
          id: string;
          table_id: string;
        };
        Insert: {
          booking_id: string;
          created_at?: string | null;
          id?: string;
          table_id: string;
        };
        Update: {
          booking_id?: string;
          created_at?: string | null;
          id?: string;
          table_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_tables_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "active_dining_bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_tables_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_tables_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["booking_id"];
          },
          {
            foreignKeyName: "booking_tables_table_id_fkey";
            columns: ["table_id"];
            isOneToOne: false;
            referencedRelation: "mv_table_availability";
            referencedColumns: ["table_id"];
          },
          {
            foreignKeyName: "booking_tables_table_id_fkey";
            columns: ["table_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_tables";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          acceptance_attempted_at: string | null;
          acceptance_failed_reason: string | null;
          actual_end_time: string | null;
          applied_loyalty_rule_id: string | null;
          applied_offer_id: string | null;
          attendees: number | null;
          auto_declined: boolean | null;
          booking_time: string;
          checked_in_at: string | null;
          confirmation_code: string | null;
          created_at: string | null;
          dietary_notes: string[] | null;
          expected_loyalty_points: number | null;
          guest_email: string | null;
          guest_name: string | null;
          guest_phone: string | null;
          id: string;
          is_group_booking: boolean | null;
          loyalty_points_earned: number | null;
          meal_progress: Json | null;
          occasion: string | null;
          organizer_id: string | null;
          party_size: number;
          reminder_sent: boolean | null;
          request_expires_at: string | null;
          restaurant_id: string;
          seated_at: string | null;
          special_requests: string | null;
          status: string;
          suggested_alternative_tables: string[] | null;
          suggested_alternative_time: string | null;
          table_preferences: string[] | null;
          turn_time_minutes: number;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          acceptance_attempted_at?: string | null;
          acceptance_failed_reason?: string | null;
          actual_end_time?: string | null;
          applied_loyalty_rule_id?: string | null;
          applied_offer_id?: string | null;
          attendees?: number | null;
          auto_declined?: boolean | null;
          booking_time: string;
          checked_in_at?: string | null;
          confirmation_code?: string | null;
          created_at?: string | null;
          dietary_notes?: string[] | null;
          expected_loyalty_points?: number | null;
          guest_email?: string | null;
          guest_name?: string | null;
          guest_phone?: string | null;
          id?: string;
          is_group_booking?: boolean | null;
          loyalty_points_earned?: number | null;
          meal_progress?: Json | null;
          occasion?: string | null;
          organizer_id?: string | null;
          party_size: number;
          reminder_sent?: boolean | null;
          request_expires_at?: string | null;
          restaurant_id: string;
          seated_at?: string | null;
          special_requests?: string | null;
          status: string;
          suggested_alternative_tables?: string[] | null;
          suggested_alternative_time?: string | null;
          table_preferences?: string[] | null;
          turn_time_minutes?: number;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          acceptance_attempted_at?: string | null;
          acceptance_failed_reason?: string | null;
          actual_end_time?: string | null;
          applied_loyalty_rule_id?: string | null;
          applied_offer_id?: string | null;
          attendees?: number | null;
          auto_declined?: boolean | null;
          booking_time?: string;
          checked_in_at?: string | null;
          confirmation_code?: string | null;
          created_at?: string | null;
          dietary_notes?: string[] | null;
          expected_loyalty_points?: number | null;
          guest_email?: string | null;
          guest_name?: string | null;
          guest_phone?: string | null;
          id?: string;
          is_group_booking?: boolean | null;
          loyalty_points_earned?: number | null;
          meal_progress?: Json | null;
          occasion?: string | null;
          organizer_id?: string | null;
          party_size?: number;
          reminder_sent?: boolean | null;
          request_expires_at?: string | null;
          restaurant_id?: string;
          seated_at?: string | null;
          special_requests?: string | null;
          status?: string;
          suggested_alternative_tables?: string[] | null;
          suggested_alternative_time?: string | null;
          table_preferences?: string[] | null;
          turn_time_minutes?: number;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_applied_loyalty_rule_id_fkey";
            columns: ["applied_loyalty_rule_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_rules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_applied_offer_id_fkey";
            columns: ["applied_offer_id"];
            isOneToOne: false;
            referencedRelation: "special_offers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_organizer_id_fkey";
            columns: ["organizer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "bookings_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "bookings_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "bookings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_notes: {
        Row: {
          category: string | null;
          created_at: string | null;
          created_by: string;
          customer_id: string;
          id: string;
          is_important: boolean | null;
          note: string;
          updated_at: string | null;
        };
        Insert: {
          category?: string | null;
          created_at?: string | null;
          created_by: string;
          customer_id: string;
          id?: string;
          is_important?: boolean | null;
          note: string;
          updated_at?: string | null;
        };
        Update: {
          category?: string | null;
          created_at?: string | null;
          created_by?: string;
          customer_id?: string;
          id?: string;
          is_important?: boolean | null;
          note?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customer_notes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_notes_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_customers";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_preferences: {
        Row: {
          created_at: string | null;
          customer_id: string;
          id: string;
          preference_type: string;
          preference_value: Json;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          customer_id: string;
          id?: string;
          preference_type: string;
          preference_value: Json;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          customer_id?: string;
          id?: string;
          preference_type?: string;
          preference_value?: Json;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customer_preferences_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_customers";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_relationships: {
        Row: {
          created_at: string | null;
          created_by: string;
          customer_id: string;
          id: string;
          related_customer_id: string;
          relationship_details: string | null;
          relationship_type: string;
        };
        Insert: {
          created_at?: string | null;
          created_by: string;
          customer_id: string;
          id?: string;
          related_customer_id: string;
          relationship_details?: string | null;
          relationship_type: string;
        };
        Update: {
          created_at?: string | null;
          created_by?: string;
          customer_id?: string;
          id?: string;
          related_customer_id?: string;
          relationship_details?: string | null;
          relationship_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_relationships_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_relationships_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_relationships_related_customer_id_fkey";
            columns: ["related_customer_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_customers";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_tag_assignments: {
        Row: {
          assigned_at: string | null;
          assigned_by: string;
          customer_id: string;
          id: string;
          tag_id: string;
        };
        Insert: {
          assigned_at?: string | null;
          assigned_by: string;
          customer_id: string;
          id?: string;
          tag_id: string;
        };
        Update: {
          assigned_at?: string | null;
          assigned_by?: string;
          customer_id?: string;
          id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_tag_assignments_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_tag_assignments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_tag_assignments_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "customer_tags";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_tags: {
        Row: {
          color: string;
          created_at: string | null;
          description: string | null;
          id: string;
          name: string;
          restaurant_id: string;
        };
        Insert: {
          color?: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          restaurant_id: string;
        };
        Update: {
          color?: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          restaurant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_tags_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "customer_tags_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "customer_tags_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_tags_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
        ];
      };
      data_export_requests: {
        Row: {
          completed_at: string | null;
          download_url: string | null;
          id: string;
          requested_at: string | null;
          status: string | null;
          user_id: string | null;
        };
        Insert: {
          completed_at?: string | null;
          download_url?: string | null;
          id?: string;
          requested_at?: string | null;
          status?: string | null;
          user_id?: string | null;
        };
        Update: {
          completed_at?: string | null;
          download_url?: string | null;
          id?: string;
          requested_at?: string | null;
          status?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "data_export_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      favorites: {
        Row: {
          created_at: string | null;
          id: string;
          restaurant_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          restaurant_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          restaurant_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "favorites_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "favorites_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "favorites_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "favorites_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "favorites_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      floor_plans: {
        Row: {
          created_at: string | null;
          height: number | null;
          id: string;
          is_default: boolean | null;
          name: string;
          restaurant_id: string;
          svg_layout: string | null;
          width: number | null;
        };
        Insert: {
          created_at?: string | null;
          height?: number | null;
          id?: string;
          is_default?: boolean | null;
          name: string;
          restaurant_id: string;
          svg_layout?: string | null;
          width?: number | null;
        };
        Update: {
          created_at?: string | null;
          height?: number | null;
          id?: string;
          is_default?: boolean | null;
          name?: string;
          restaurant_id?: string;
          svg_layout?: string | null;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "floor_plans_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "floor_plans_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "floor_plans_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "floor_plans_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
        ];
      };
      friend_requests: {
        Row: {
          created_at: string | null;
          from_user_id: string;
          id: string;
          message: string | null;
          status: string;
          to_user_id: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          from_user_id: string;
          id?: string;
          message?: string | null;
          status?: string;
          to_user_id: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          from_user_id?: string;
          id?: string;
          message?: string | null;
          status?: string;
          to_user_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "friend_requests_from_user_id_fkey";
            columns: ["from_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "friend_requests_to_user_id_fkey";
            columns: ["to_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      friends: {
        Row: {
          friend_id: string;
          friendship_date: string | null;
          id: string;
          user_id: string;
        };
        Insert: {
          friend_id: string;
          friendship_date?: string | null;
          id?: string;
          user_id: string;
        };
        Update: {
          friend_id?: string;
          friendship_date?: string | null;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "friends_friend_id_fkey";
            columns: ["friend_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "friends_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      blocked_users: {
        Row: {
          blocked_at: string | null;
          blocked_id: string;
          blocker_id: string;
          id: string;
          reason: string | null;
        };
        Insert: {
          blocked_at?: string | null;
          blocked_id: string;
          blocker_id: string;
          id?: string;
          reason?: string | null;
        };
        Update: {
          blocked_at?: string | null;
          blocked_id?: string;
          blocker_id?: string;
          id?: string;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "blocked_users_blocker_id_fkey";
            columns: ["blocker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "blocked_users_blocked_id_fkey";
            columns: ["blocked_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      kitchen_assignments: {
        Row: {
          assigned_at: string | null;
          assigned_to: string | null;
          completed_at: string | null;
          id: string;
          notes: string | null;
          order_item_id: string;
          started_at: string | null;
          station_id: string;
        };
        Insert: {
          assigned_at?: string | null;
          assigned_to?: string | null;
          completed_at?: string | null;
          id?: string;
          notes?: string | null;
          order_item_id: string;
          started_at?: string | null;
          station_id: string;
        };
        Update: {
          assigned_at?: string | null;
          assigned_to?: string | null;
          completed_at?: string | null;
          id?: string;
          notes?: string | null;
          order_item_id?: string;
          started_at?: string | null;
          station_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "kitchen_assignments_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "kitchen_assignments_order_item_id_fkey";
            columns: ["order_item_id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "kitchen_assignments_station_id_fkey";
            columns: ["station_id"];
            isOneToOne: false;
            referencedRelation: "kitchen_stations";
            referencedColumns: ["id"];
          },
        ];
      };
      kitchen_display_settings: {
        Row: {
          auto_advance_orders: boolean | null;
          color_scheme: string | null;
          created_at: string | null;
          display_name: string;
          font_size: string | null;
          id: string;
          orders_per_page: number | null;
          restaurant_id: string;
          show_dietary_info: boolean | null;
          show_prep_times: boolean | null;
          show_special_instructions: boolean | null;
          sound_notifications: boolean | null;
          station_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          auto_advance_orders?: boolean | null;
          color_scheme?: string | null;
          created_at?: string | null;
          display_name: string;
          font_size?: string | null;
          id?: string;
          orders_per_page?: number | null;
          restaurant_id: string;
          show_dietary_info?: boolean | null;
          show_prep_times?: boolean | null;
          show_special_instructions?: boolean | null;
          sound_notifications?: boolean | null;
          station_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          auto_advance_orders?: boolean | null;
          color_scheme?: string | null;
          created_at?: string | null;
          display_name?: string;
          font_size?: string | null;
          id?: string;
          orders_per_page?: number | null;
          restaurant_id?: string;
          show_dietary_info?: boolean | null;
          show_prep_times?: boolean | null;
          show_special_instructions?: boolean | null;
          sound_notifications?: boolean | null;
          station_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "kitchen_display_settings_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "kitchen_display_settings_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "kitchen_display_settings_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "kitchen_display_settings_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "kitchen_display_settings_station_id_fkey";
            columns: ["station_id"];
            isOneToOne: false;
            referencedRelation: "kitchen_stations";
            referencedColumns: ["id"];
          },
        ];
      };
      kitchen_stations: {
        Row: {
          created_at: string | null;
          description: string | null;
          display_order: number | null;
          id: string;
          is_active: boolean | null;
          name: string;
          restaurant_id: string;
          station_type: string;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          display_order?: number | null;
          id?: string;
          is_active?: boolean | null;
          name: string;
          restaurant_id: string;
          station_type: string;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          display_order?: number | null;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          restaurant_id?: string;
          station_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "kitchen_stations_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "kitchen_stations_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "kitchen_stations_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "kitchen_stations_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
        ];
      };
      loyalty_activities: {
        Row: {
          activity_type: string;
          created_at: string | null;
          description: string | null;
          id: string;
          metadata: Json | null;
          points_earned: number;
          points_multiplier: number | null;
          related_booking_id: string | null;
          related_review_id: string | null;
          user_id: string;
        };
        Insert: {
          activity_type: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          metadata?: Json | null;
          points_earned: number;
          points_multiplier?: number | null;
          related_booking_id?: string | null;
          related_review_id?: string | null;
          user_id: string;
        };
        Update: {
          activity_type?: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          metadata?: Json | null;
          points_earned?: number;
          points_multiplier?: number | null;
          related_booking_id?: string | null;
          related_review_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "loyalty_activities_related_booking_id_fkey";
            columns: ["related_booking_id"];
            isOneToOne: false;
            referencedRelation: "active_dining_bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loyalty_activities_related_booking_id_fkey";
            columns: ["related_booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loyalty_activities_related_booking_id_fkey";
            columns: ["related_booking_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["booking_id"];
          },
          {
            foreignKeyName: "loyalty_activities_related_review_id_fkey";
            columns: ["related_review_id"];
            isOneToOne: false;
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loyalty_activities_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      loyalty_audit_log: {
        Row: {
          action: string;
          balance_after: number | null;
          balance_before: number | null;
          booking_id: string | null;
          created_at: string | null;
          id: string;
          metadata: Json | null;
          points_amount: number | null;
          restaurant_id: string | null;
          user_id: string | null;
        };
        Insert: {
          action: string;
          balance_after?: number | null;
          balance_before?: number | null;
          booking_id?: string | null;
          created_at?: string | null;
          id?: string;
          metadata?: Json | null;
          points_amount?: number | null;
          restaurant_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          balance_after?: number | null;
          balance_before?: number | null;
          booking_id?: string | null;
          created_at?: string | null;
          id?: string;
          metadata?: Json | null;
          points_amount?: number | null;
          restaurant_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      loyalty_redemptions: {
        Row: {
          booking_id: string | null;
          created_at: string | null;
          expires_at: string;
          id: string;
          metadata: Json | null;
          offer_id: string | null;
          points_cost: number;
          redemption_code: string | null;
          reward_id: string | null;
          status: string | null;
          updated_at: string | null;
          used_at: string | null;
          user_id: string;
        };
        Insert: {
          booking_id?: string | null;
          created_at?: string | null;
          expires_at: string;
          id?: string;
          metadata?: Json | null;
          offer_id?: string | null;
          points_cost: number;
          redemption_code?: string | null;
          reward_id?: string | null;
          status?: string | null;
          updated_at?: string | null;
          used_at?: string | null;
          user_id: string;
        };
        Update: {
          booking_id?: string | null;
          created_at?: string | null;
          expires_at?: string;
          id?: string;
          metadata?: Json | null;
          offer_id?: string | null;
          points_cost?: number;
          redemption_code?: string | null;
          reward_id?: string | null;
          status?: string | null;
          updated_at?: string | null;
          used_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "loyalty_redemptions_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "active_dining_bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loyalty_redemptions_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loyalty_redemptions_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["booking_id"];
          },
          {
            foreignKeyName: "loyalty_redemptions_offer_id_fkey";
            columns: ["offer_id"];
            isOneToOne: false;
            referencedRelation: "special_offers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loyalty_redemptions_reward_id_fkey";
            columns: ["reward_id"];
            isOneToOne: false;
            referencedRelation: "loyalty_rewards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loyalty_redemptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      loyalty_rewards: {
        Row: {
          category: string;
          created_at: string | null;
          description: string | null;
          id: string;
          is_active: boolean | null;
          max_redemptions_per_user: number | null;
          points_cost: number;
          restaurant_id: string | null;
          terms_conditions: string[] | null;
          tier_required: string;
          title: string;
          total_available: number | null;
          updated_at: string | null;
          valid_from: string | null;
          valid_until: string | null;
          value_description: string | null;
        };
        Insert: {
          category: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          max_redemptions_per_user?: number | null;
          points_cost: number;
          restaurant_id?: string | null;
          terms_conditions?: string[] | null;
          tier_required: string;
          title: string;
          total_available?: number | null;
          updated_at?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          value_description?: string | null;
        };
        Update: {
          category?: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          max_redemptions_per_user?: number | null;
          points_cost?: number;
          restaurant_id?: string | null;
          terms_conditions?: string[] | null;
          tier_required?: string;
          title?: string;
          total_available?: number | null;
          updated_at?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          value_description?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "loyalty_rewards_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "loyalty_rewards_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "loyalty_rewards_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loyalty_rewards_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
        ];
      };
      menu_categories: {
        Row: {
          created_at: string | null;
          description: string | null;
          display_order: number | null;
          id: string;
          is_active: boolean | null;
          name: string;
          restaurant_id: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          display_order?: number | null;
          id?: string;
          is_active?: boolean | null;
          name: string;
          restaurant_id: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          display_order?: number | null;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          restaurant_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
        ];
      };
      menu_item_stations: {
        Row: {
          estimated_time: number | null;
          id: string;
          is_primary: boolean | null;
          menu_item_id: string;
          preparation_order: number | null;
          station_id: string;
        };
        Insert: {
          estimated_time?: number | null;
          id?: string;
          is_primary?: boolean | null;
          menu_item_id: string;
          preparation_order?: number | null;
          station_id: string;
        };
        Update: {
          estimated_time?: number | null;
          id?: string;
          is_primary?: boolean | null;
          menu_item_id?: string;
          preparation_order?: number | null;
          station_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_item_stations_menu_item_id_fkey";
            columns: ["menu_item_id"];
            isOneToOne: false;
            referencedRelation: "menu_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_item_stations_station_id_fkey";
            columns: ["station_id"];
            isOneToOne: false;
            referencedRelation: "kitchen_stations";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_items: {
        Row: {
          allergens: string[] | null;
          calories: number | null;
          category_id: string;
          created_at: string | null;
          description: string | null;
          dietary_tags: string[] | null;
          display_order: number | null;
          id: string;
          image_url: string | null;
          is_available: boolean | null;
          is_featured: boolean | null;
          name: string;
          preparation_time: number | null;
          price: number;
          restaurant_id: string;
          updated_at: string | null;
        };
        Insert: {
          allergens?: string[] | null;
          calories?: number | null;
          category_id: string;
          created_at?: string | null;
          description?: string | null;
          dietary_tags?: string[] | null;
          display_order?: number | null;
          id?: string;
          image_url?: string | null;
          is_available?: boolean | null;
          is_featured?: boolean | null;
          name: string;
          preparation_time?: number | null;
          price: number;
          restaurant_id: string;
          updated_at?: string | null;
        };
        Update: {
          allergens?: string[] | null;
          calories?: number | null;
          category_id?: string;
          created_at?: string | null;
          description?: string | null;
          dietary_tags?: string[] | null;
          display_order?: number | null;
          id?: string;
          image_url?: string | null;
          is_available?: boolean | null;
          is_featured?: boolean | null;
          name?: string;
          preparation_time?: number | null;
          price?: number;
          restaurant_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "menu_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
        ];
      };
      notification_delivery_logs: {
        Row: {
          created_at: string | null;
          error: string | null;
          id: string;
          outbox_id: string;
          provider: string | null;
          provider_message_id: string | null;
          status: string | null;
        };
        Insert: {
          created_at?: string | null;
          error?: string | null;
          id?: string;
          outbox_id: string;
          provider?: string | null;
          provider_message_id?: string | null;
          status?: string | null;
        };
        Update: {
          created_at?: string | null;
          error?: string | null;
          id?: string;
          outbox_id?: string;
          provider?: string | null;
          provider_message_id?: string | null;
          status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notification_delivery_logs_outbox_id_fkey";
            columns: ["outbox_id"];
            isOneToOne: false;
            referencedRelation: "notification_outbox";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_outbox: {
        Row: {
          attempts: number;
          channel: string;
          created_at: string | null;
          error: string | null;
          id: string;
          notification_id: string;
          payload: Json;
          sent_at: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          attempts?: number;
          channel: string;
          created_at?: string | null;
          error?: string | null;
          id?: string;
          notification_id: string;
          payload: Json;
          sent_at?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          attempts?: number;
          channel?: string;
          created_at?: string | null;
          error?: string | null;
          id?: string;
          notification_id?: string;
          payload?: Json;
          sent_at?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_outbox_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: false;
            referencedRelation: "notifications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_outbox_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_preferences: {
        Row: {
          booking: boolean | null;
          booking_reminders: boolean | null;
          loyalty: boolean | null;
          marketing: boolean | null;
          offers: boolean | null;
          quiet_hours: Json | null;
          reviews: boolean | null;
          security: boolean | null;
          system: boolean | null;
          updated_at: string | null;
          user_id: string;
          waitlist: boolean | null;
        };
        Insert: {
          booking?: boolean | null;
          booking_reminders?: boolean | null;
          loyalty?: boolean | null;
          marketing?: boolean | null;
          offers?: boolean | null;
          quiet_hours?: Json | null;
          reviews?: boolean | null;
          security?: boolean | null;
          system?: boolean | null;
          updated_at?: string | null;
          user_id: string;
          waitlist?: boolean | null;
        };
        Update: {
          booking?: boolean | null;
          booking_reminders?: boolean | null;
          loyalty?: boolean | null;
          marketing?: boolean | null;
          offers?: boolean | null;
          quiet_hours?: Json | null;
          reviews?: boolean | null;
          security?: boolean | null;
          system?: boolean | null;
          updated_at?: string | null;
          user_id?: string;
          waitlist?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          category: string | null;
          created_at: string | null;
          data: Json | null;
          deeplink: string | null;
          id: string;
          message: string;
          read: boolean | null;
          read_at: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string | null;
          data?: Json | null;
          deeplink?: string | null;
          id?: string;
          message: string;
          read?: boolean | null;
          read_at?: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          category?: string | null;
          created_at?: string | null;
          data?: Json | null;
          deeplink?: string | null;
          id?: string;
          message?: string;
          read?: boolean | null;
          read_at?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          actual_prep_time: number | null;
          created_at: string | null;
          dietary_modifications: string[] | null;
          estimated_prep_time: number | null;
          id: string;
          menu_item_id: string;
          order_id: string;
          quantity: number;
          ready_at: string | null;
          served_at: string | null;
          special_instructions: string | null;
          started_preparing_at: string | null;
          status: string;
          total_price: number;
          unit_price: number;
          updated_at: string | null;
        };
        Insert: {
          actual_prep_time?: number | null;
          created_at?: string | null;
          dietary_modifications?: string[] | null;
          estimated_prep_time?: number | null;
          id?: string;
          menu_item_id: string;
          order_id: string;
          quantity: number;
          ready_at?: string | null;
          served_at?: string | null;
          special_instructions?: string | null;
          started_preparing_at?: string | null;
          status?: string;
          total_price: number;
          unit_price: number;
          updated_at?: string | null;
        };
        Update: {
          actual_prep_time?: number | null;
          created_at?: string | null;
          dietary_modifications?: string[] | null;
          estimated_prep_time?: number | null;
          id?: string;
          menu_item_id?: string;
          order_id?: string;
          quantity?: number;
          ready_at?: string | null;
          served_at?: string | null;
          special_instructions?: string | null;
          started_preparing_at?: string | null;
          status?: string;
          total_price?: number;
          unit_price?: number;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey";
            columns: ["menu_item_id"];
            isOneToOne: false;
            referencedRelation: "menu_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_modifications: {
        Row: {
          created_at: string | null;
          created_by: string;
          description: string;
          id: string;
          modification_type: string;
          order_item_id: string;
          price_adjustment: number | null;
        };
        Insert: {
          created_at?: string | null;
          created_by: string;
          description: string;
          id?: string;
          modification_type: string;
          order_item_id: string;
          price_adjustment?: number | null;
        };
        Update: {
          created_at?: string | null;
          created_by?: string;
          description?: string;
          id?: string;
          modification_type?: string;
          order_item_id?: string;
          price_adjustment?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_modifications_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_modifications_order_item_id_fkey";
            columns: ["order_item_id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
        ];
      };
      order_status_history: {
        Row: {
          changed_at: string | null;
          changed_by: string;
          estimated_completion: string | null;
          id: string;
          new_status: string;
          notes: string | null;
          old_status: string | null;
          order_id: string;
          order_item_id: string | null;
          station_id: string | null;
        };
        Insert: {
          changed_at?: string | null;
          changed_by: string;
          estimated_completion?: string | null;
          id?: string;
          new_status: string;
          notes?: string | null;
          old_status?: string | null;
          order_id: string;
          order_item_id?: string | null;
          station_id?: string | null;
        };
        Update: {
          changed_at?: string | null;
          changed_by?: string;
          estimated_completion?: string | null;
          id?: string;
          new_status?: string;
          notes?: string | null;
          old_status?: string | null;
          order_id?: string;
          order_item_id?: string | null;
          station_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_status_history_order_item_id_fkey";
            columns: ["order_item_id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_status_history_station_id_fkey";
            columns: ["station_id"];
            isOneToOne: false;
            referencedRelation: "kitchen_stations";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          actual_prep_time: number | null;
          booking_id: string;
          completed_at: string | null;
          confirmed_at: string | null;
          course_type: string | null;
          created_at: string | null;
          created_by: string;
          dietary_requirements: string[] | null;
          estimated_prep_time: number | null;
          id: string;
          order_number: string;
          order_type: string;
          priority_level: number | null;
          ready_at: string | null;
          restaurant_id: string;
          served_at: string | null;
          special_instructions: string | null;
          started_preparing_at: string | null;
          status: string;
          subtotal: number;
          table_id: string | null;
          tax_amount: number;
          total_amount: number;
          updated_at: string | null;
        };
        Insert: {
          actual_prep_time?: number | null;
          booking_id: string;
          completed_at?: string | null;
          confirmed_at?: string | null;
          course_type?: string | null;
          created_at?: string | null;
          created_by: string;
          dietary_requirements?: string[] | null;
          estimated_prep_time?: number | null;
          id?: string;
          order_number: string;
          order_type?: string;
          priority_level?: number | null;
          ready_at?: string | null;
          restaurant_id: string;
          served_at?: string | null;
          special_instructions?: string | null;
          started_preparing_at?: string | null;
          status?: string;
          subtotal?: number;
          table_id?: string | null;
          tax_amount?: number;
          total_amount?: number;
          updated_at?: string | null;
        };
        Update: {
          actual_prep_time?: number | null;
          booking_id?: string;
          completed_at?: string | null;
          confirmed_at?: string | null;
          course_type?: string | null;
          created_at?: string | null;
          created_by?: string;
          dietary_requirements?: string[] | null;
          estimated_prep_time?: number | null;
          id?: string;
          order_number?: string;
          order_type?: string;
          priority_level?: number | null;
          ready_at?: string | null;
          restaurant_id?: string;
          served_at?: string | null;
          special_instructions?: string | null;
          started_preparing_at?: string | null;
          status?: string;
          subtotal?: number;
          table_id?: string | null;
          tax_amount?: number;
          total_amount?: number;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "orders_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "active_dining_bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["booking_id"];
          },
          {
            foreignKeyName: "orders_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "orders_table_id_fkey";
            columns: ["table_id"];
            isOneToOne: false;
            referencedRelation: "mv_table_availability";
            referencedColumns: ["table_id"];
          },
          {
            foreignKeyName: "orders_table_id_fkey";
            columns: ["table_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_tables";
            referencedColumns: ["id"];
          },
        ];
      };
      playlist_collaborators: {
        Row: {
          accepted_at: string | null;
          id: string;
          invited_at: string | null;
          invited_by: string;
          permission: string;
          playlist_id: string;
          user_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          id?: string;
          invited_at?: string | null;
          invited_by: string;
          permission?: string;
          playlist_id: string;
          user_id: string;
        };
        Update: {
          accepted_at?: string | null;
          id?: string;
          invited_at?: string | null;
          invited_by?: string;
          permission?: string;
          playlist_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "playlist_collaborators_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "playlist_collaborators_playlist_id_fkey";
            columns: ["playlist_id"];
            isOneToOne: false;
            referencedRelation: "playlist_stats";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "playlist_collaborators_playlist_id_fkey";
            columns: ["playlist_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_playlists";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "playlist_collaborators_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      playlist_items: {
        Row: {
          added_by: string;
          created_at: string | null;
          id: string;
          note: string | null;
          playlist_id: string;
          position: number;
          restaurant_id: string;
        };
        Insert: {
          added_by: string;
          created_at?: string | null;
          id?: string;
          note?: string | null;
          playlist_id: string;
          position?: number;
          restaurant_id: string;
        };
        Update: {
          added_by?: string;
          created_at?: string | null;
          id?: string;
          note?: string | null;
          playlist_id?: string;
          position?: number;
          restaurant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "playlist_items_added_by_fkey";
            columns: ["added_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "playlist_items_playlist_id_fkey";
            columns: ["playlist_id"];
            isOneToOne: false;
            referencedRelation: "playlist_stats";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "playlist_items_playlist_id_fkey";
            columns: ["playlist_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_playlists";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "playlist_items_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "playlist_items_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "playlist_items_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "playlist_items_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
        ];
      };
      post_comments: {
        Row: {
          comment: string;
          created_at: string | null;
          id: string;
          post_id: string | null;
          user_id: string | null;
        };
        Insert: {
          comment: string;
          created_at?: string | null;
          id?: string;
          post_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          comment?: string;
          created_at?: string | null;
          id?: string;
          post_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts_with_details";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_comments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      post_images: {
        Row: {
          created_at: string | null;
          id: string;
          image_order: number | null;
          image_url: string;
          post_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          image_order?: number | null;
          image_url: string;
          post_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          image_order?: number | null;
          image_url?: string;
          post_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "post_images_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_images_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts_with_details";
            referencedColumns: ["id"];
          },
        ];
      };
      post_likes: {
        Row: {
          created_at: string | null;
          id: string;
          post_id: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          post_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          post_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_likes_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts_with_details";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_likes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      post_tags: {
        Row: {
          created_at: string | null;
          id: string;
          post_id: string | null;
          tagged_user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          post_id?: string | null;
          tagged_user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          post_id?: string | null;
          tagged_user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "post_tags_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_tags_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts_with_details";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_tags_tagged_user_id_fkey";
            columns: ["tagged_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: {
          booking_id: string | null;
          content: string | null;
          created_at: string | null;
          id: string;
          restaurant_id: string | null;
          updated_at: string | null;
          user_id: string | null;
          visibility: string | null;
        };
        Insert: {
          booking_id?: string | null;
          content?: string | null;
          created_at?: string | null;
          id?: string;
          restaurant_id?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
          visibility?: string | null;
        };
        Update: {
          booking_id?: string | null;
          content?: string | null;
          created_at?: string | null;
          id?: string;
          restaurant_id?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
          visibility?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "posts_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "active_dining_bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["booking_id"];
          },
          {
            foreignKeyName: "posts_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "posts_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "posts_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "posts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          allergies: string[] | null;
          avatar_url: string | null;
          cancelled_bookings: number | null;
          completed_bookings: number | null;
          created_at: string | null;
          dietary_restrictions: string[] | null;
          email: string | null;
          favorite_cuisines: string[] | null;
          full_name: string;
          id: string;
          loyalty_points: number | null;
          membership_tier: string | null;
          no_show_bookings: number | null;
          notification_preferences: Json | null;
          phone_number: string | null;
          preferred_party_size: number | null;
          privacy_settings: Json | null;
          rating_last_updated: string | null;
          total_bookings: number | null;
          updated_at: string | null;
          user_rating: number | null;
        };
        Insert: {
          allergies?: string[] | null;
          avatar_url?: string | null;
          cancelled_bookings?: number | null;
          completed_bookings?: number | null;
          created_at?: string | null;
          dietary_restrictions?: string[] | null;
          email?: string | null;
          favorite_cuisines?: string[] | null;
          full_name: string;
          id: string;
          loyalty_points?: number | null;
          membership_tier?: string | null;
          no_show_bookings?: number | null;
          notification_preferences?: Json | null;
          phone_number?: string | null;
          preferred_party_size?: number | null;
          privacy_settings?: Json | null;
          rating_last_updated?: string | null;
          total_bookings?: number | null;
          updated_at?: string | null;
          user_rating?: number | null;
        };
        Update: {
          allergies?: string[] | null;
          avatar_url?: string | null;
          cancelled_bookings?: number | null;
          completed_bookings?: number | null;
          created_at?: string | null;
          dietary_restrictions?: string[] | null;
          email?: string | null;
          favorite_cuisines?: string[] | null;
          full_name?: string;
          id?: string;
          loyalty_points?: number | null;
          membership_tier?: string | null;
          no_show_bookings?: number | null;
          notification_preferences?: Json | null;
          phone_number?: string | null;
          preferred_party_size?: number | null;
          privacy_settings?: Json | null;
          rating_last_updated?: string | null;
          total_bookings?: number | null;
          updated_at?: string | null;
          user_rating?: number | null;
        };
        Relationships: [];
      };
      restaurant_availability: {
        Row: {
          available_capacity: number;
          date: string;
          id: string;
          restaurant_id: string;
          time_slot: string;
          total_capacity: number;
        };
        Insert: {
          available_capacity: number;
          date: string;
          id?: string;
          restaurant_id: string;
          time_slot: string;
          total_capacity: number;
        };
        Update: {
          available_capacity?: number;
          date?: string;
          id?: string;
          restaurant_id?: string;
          time_slot?: string;
          total_capacity?: number;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_availability_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_availability_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_availability_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_availability_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
        ];
      };
      restaurant_closures: {
        Row: {
          created_at: string | null;
          created_by: string;
          end_date: string;
          id: string;
          reason: string;
          restaurant_id: string;
          start_date: string;
        };
        Insert: {
          created_at?: string | null;
          created_by: string;
          end_date: string;
          id?: string;
          reason: string;
          restaurant_id: string;
          start_date: string;
        };
        Update: {
          created_at?: string | null;
          created_by?: string;
          end_date?: string;
          id?: string;
          reason?: string;
          restaurant_id?: string;
          start_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_closures_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_closures_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_closures_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_closures_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_closures_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
        ];
      };
      restaurant_customers: {
        Row: {
          average_party_size: number | null;
          blacklist_reason: string | null;
          blacklisted: boolean | null;
          cancelled_count: number | null;
          created_at: string | null;
          first_visit: string | null;
          guest_email: string | null;
          guest_name: string | null;
          guest_phone: string | null;
          id: string;
          last_visit: string | null;
          no_show_count: number | null;
          preferred_table_types: string[] | null;
          preferred_time_slots: string[] | null;
          restaurant_id: string;
          total_bookings: number | null;
          total_spent: number | null;
          updated_at: string | null;
          user_id: string | null;
          vip_status: boolean | null;
        };
        Insert: {
          average_party_size?: number | null;
          blacklist_reason?: string | null;
          blacklisted?: boolean | null;
          cancelled_count?: number | null;
          created_at?: string | null;
          first_visit?: string | null;
          guest_email?: string | null;
          guest_name?: string | null;
          guest_phone?: string | null;
          id?: string;
          last_visit?: string | null;
          no_show_count?: number | null;
          preferred_table_types?: string[] | null;
          preferred_time_slots?: string[] | null;
          restaurant_id: string;
          total_bookings?: number | null;
          total_spent?: number | null;
          updated_at?: string | null;
          user_id?: string | null;
          vip_status?: boolean | null;
        };
        Update: {
          average_party_size?: number | null;
          blacklist_reason?: string | null;
          blacklisted?: boolean | null;
          cancelled_count?: number | null;
          created_at?: string | null;
          first_visit?: string | null;
          guest_email?: string | null;
          guest_name?: string | null;
          guest_phone?: string | null;
          id?: string;
          last_visit?: string | null;
          no_show_count?: number | null;
          preferred_table_types?: string[] | null;
          preferred_time_slots?: string[] | null;
          restaurant_id?: string;
          total_bookings?: number | null;
          total_spent?: number | null;
          updated_at?: string | null;
          user_id?: string | null;
          vip_status?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_customers_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_customers_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_customers_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_customers_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_customers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      restaurant_hours: {
        Row: {
          close_time: string | null;
          created_at: string | null;
          day_of_week: string;
          id: string;
          is_open: boolean | null;
          open_time: string | null;
          restaurant_id: string;
          updated_at: string | null;
        };
        Insert: {
          close_time?: string | null;
          created_at?: string | null;
          day_of_week: string;
          id?: string;
          is_open?: boolean | null;
          open_time?: string | null;
          restaurant_id: string;
          updated_at?: string | null;
        };
        Update: {
          close_time?: string | null;
          created_at?: string | null;
          day_of_week?: string;
          id?: string;
          is_open?: boolean | null;
          open_time?: string | null;
          restaurant_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_hours_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_hours_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_hours_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_hours_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
        ];
      };
      restaurant_loyalty_balance: {
        Row: {
          created_at: string | null;
          current_balance: number;
          id: string;
          last_purchase_at: string | null;
          restaurant_id: string;
          total_purchased: number;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          current_balance?: number;
          id?: string;
          last_purchase_at?: string | null;
          restaurant_id: string;
          total_purchased?: number;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          current_balance?: number;
          id?: string;
          last_purchase_at?: string | null;
          restaurant_id?: string;
          total_purchased?: number;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_loyalty_balance_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: true;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_loyalty_balance_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: true;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_loyalty_balance_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: true;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_loyalty_balance_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: true;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
        ];
      };
      restaurant_loyalty_rules: {
        Row: {
          applicable_days: number[] | null;
          created_at: string | null;
          current_uses: number | null;
          end_time_minutes: number | null;
          id: string;
          is_active: boolean | null;
          max_uses_per_user: number | null;
          max_uses_total: number | null;
          maximum_party_size: number | null;
          minimum_party_size: number | null;
          points_to_award: number;
          priority: number | null;
          restaurant_id: string;
          rule_name: string;
          start_time_minutes: number | null;
          updated_at: string | null;
          valid_from: string | null;
          valid_until: string | null;
        };
        Insert: {
          applicable_days?: number[] | null;
          created_at?: string | null;
          current_uses?: number | null;
          end_time_minutes?: number | null;
          id?: string;
          is_active?: boolean | null;
          max_uses_per_user?: number | null;
          max_uses_total?: number | null;
          maximum_party_size?: number | null;
          minimum_party_size?: number | null;
          points_to_award: number;
          priority?: number | null;
          restaurant_id: string;
          rule_name: string;
          start_time_minutes?: number | null;
          updated_at?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Update: {
          applicable_days?: number[] | null;
          created_at?: string | null;
          current_uses?: number | null;
          end_time_minutes?: number | null;
          id?: string;
          is_active?: boolean | null;
          max_uses_per_user?: number | null;
          max_uses_total?: number | null;
          maximum_party_size?: number | null;
          minimum_party_size?: number | null;
          points_to_award?: number;
          priority?: number | null;
          restaurant_id?: string;
          rule_name?: string;
          start_time_minutes?: number | null;
          updated_at?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_loyalty_rules_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_loyalty_rules_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_loyalty_rules_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_loyalty_rules_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
        ];
      };
      restaurant_loyalty_transactions: {
        Row: {
          balance_after: number;
          balance_before: number;
          booking_id: string | null;
          created_at: string | null;
          description: string | null;
          id: string;
          metadata: Json | null;
          points: number;
          restaurant_id: string;
          transaction_type: string;
          user_id: string | null;
        };
        Insert: {
          balance_after: number;
          balance_before: number;
          booking_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          metadata?: Json | null;
          points: number;
          restaurant_id: string;
          transaction_type: string;
          user_id?: string | null;
        };
        Update: {
          balance_after?: number;
          balance_before?: number;
          booking_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          metadata?: Json | null;
          points?: number;
          restaurant_id?: string;
          transaction_type?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_loyalty_transactions_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "active_dining_bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_loyalty_transactions_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_loyalty_transactions_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["booking_id"];
          },
          {
            foreignKeyName: "restaurant_loyalty_transactions_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_loyalty_transactions_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_loyalty_transactions_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_loyalty_transactions_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_loyalty_transactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      restaurant_playlists: {
        Row: {
          created_at: string | null;
          description: string | null;
          emoji: string | null;
          id: string;
          is_public: boolean | null;
          name: string;
          share_code: string | null;
          updated_at: string | null;
          user_id: string;
          view_count: number | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          emoji?: string | null;
          id?: string;
          is_public?: boolean | null;
          name: string;
          share_code?: string | null;
          updated_at?: string | null;
          user_id: string;
          view_count?: number | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          emoji?: string | null;
          id?: string;
          is_public?: boolean | null;
          name?: string;
          share_code?: string | null;
          updated_at?: string | null;
          user_id?: string;
          view_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_playlists_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      restaurant_special_hours: {
        Row: {
          close_time: string | null;
          created_at: string | null;
          created_by: string;
          date: string;
          id: string;
          is_closed: boolean | null;
          open_time: string | null;
          reason: string | null;
          restaurant_id: string;
        };
        Insert: {
          close_time?: string | null;
          created_at?: string | null;
          created_by: string;
          date: string;
          id?: string;
          is_closed?: boolean | null;
          open_time?: string | null;
          reason?: string | null;
          restaurant_id: string;
        };
        Update: {
          close_time?: string | null;
          created_at?: string | null;
          created_by?: string;
          date?: string;
          id?: string;
          is_closed?: boolean | null;
          open_time?: string | null;
          reason?: string | null;
          restaurant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_special_hours_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_special_hours_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_special_hours_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_special_hours_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_special_hours_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
        ];
      };
      restaurant_staff: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          hired_at: string | null;
          id: string;
          is_active: boolean | null;
          last_login_at: string | null;
          permissions: string[];
          restaurant_id: string;
          role: string;
          terminated_at: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          created_by?: string | null;
          hired_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          last_login_at?: string | null;
          permissions?: string[];
          restaurant_id: string;
          role: string;
          terminated_at?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          created_by?: string | null;
          hired_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          last_login_at?: string | null;
          permissions?: string[];
          restaurant_id?: string;
          role?: string;
          terminated_at?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_staff_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_staff_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_staff_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_staff_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_staff_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_staff_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      restaurant_tables: {
        Row: {
          capacity: number;
          combinable_with: string[] | null;
          created_at: string | null;
          features: string[] | null;
          height: number | null;
          id: string;
          is_active: boolean | null;
          is_combinable: boolean | null;
          max_capacity: number;
          min_capacity: number;
          priority_score: number | null;
          restaurant_id: string;
          shape: string | null;
          table_number: string;
          table_type: string;
          width: number | null;
          x_position: number;
          y_position: number;
        };
        Insert: {
          capacity: number;
          combinable_with?: string[] | null;
          created_at?: string | null;
          features?: string[] | null;
          height?: number | null;
          id?: string;
          is_active?: boolean | null;
          is_combinable?: boolean | null;
          max_capacity: number;
          min_capacity: number;
          priority_score?: number | null;
          restaurant_id: string;
          shape?: string | null;
          table_number: string;
          table_type: string;
          width?: number | null;
          x_position: number;
          y_position: number;
        };
        Update: {
          capacity?: number;
          combinable_with?: string[] | null;
          created_at?: string | null;
          features?: string[] | null;
          height?: number | null;
          id?: string;
          is_active?: boolean | null;
          is_combinable?: boolean | null;
          max_capacity?: number;
          min_capacity?: number;
          priority_score?: number | null;
          restaurant_id?: string;
          shape?: string | null;
          table_number?: string;
          table_type?: string;
          width?: number | null;
          x_position?: number;
          y_position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_tables_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_tables_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_tables_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_tables_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
        ];
      };
      restaurant_turn_times: {
        Row: {
          created_at: string | null;
          day_of_week: number | null;
          id: string;
          party_size: number;
          restaurant_id: string;
          turn_time_minutes: number;
        };
        Insert: {
          created_at?: string | null;
          day_of_week?: number | null;
          id?: string;
          party_size: number;
          restaurant_id: string;
          turn_time_minutes: number;
        };
        Update: {
          created_at?: string | null;
          day_of_week?: number | null;
          id?: string;
          party_size?: number;
          restaurant_id?: string;
          turn_time_minutes?: number;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_turn_times_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_turn_times_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_turn_times_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_turn_times_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
        ];
      };
      restaurant_vip_users: {
        Row: {
          created_at: string | null;
          extended_booking_days: number | null;
          id: string;
          priority_booking: boolean | null;
          restaurant_id: string;
          user_id: string;
          valid_until: string | null;
        };
        Insert: {
          created_at?: string | null;
          extended_booking_days?: number | null;
          id?: string;
          priority_booking?: boolean | null;
          restaurant_id: string;
          user_id: string;
          valid_until?: string | null;
        };
        Update: {
          created_at?: string | null;
          extended_booking_days?: number | null;
          id?: string;
          priority_booking?: boolean | null;
          restaurant_id?: string;
          user_id?: string;
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_vip_users_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_vip_users_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_vip_users_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_vip_users_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_vip_users_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      restaurants: {
        Row: {
          address: string;
          ai_featured: boolean;
          ambiance_tags: string[] | null;
          auto_decline_enabled: boolean | null;
          average_rating: number | null;
          booking_policy: string | null;
          booking_window_days: number | null;
          cancellation_window_hours: number | null;
          closing_time: string;
          created_at: string | null;
          cuisine_type: string;
          description: string | null;
          dietary_options: string[] | null;
          featured: boolean | null;
          happy_hour_times: Json | null;
          id: string;
          image_urls: string[] | null;
          instagram_handle: string | null;
          live_music_schedule: Json | null;
          location: unknown;
          main_image_url: string | null;
          max_party_size: number | null;
          menu_url: string | null;
          min_party_size: number | null;
          name: string;
          opening_time: string;
          outdoor_seating: boolean | null;
          parking_available: boolean | null;
          phone_number: string | null;
          price_range: number | null;
          request_expiry_hours: number | null;
          review_summary: Json | null;
          shisha_available: boolean | null;
          status: string | null;
          table_turnover_minutes: number | null;
          tags: string[] | null;
          total_reviews: number | null;
          updated_at: string | null;
          valet_parking: boolean | null;
          website_url: string | null;
          whatsapp_number: string | null;
        };
        Insert: {
          address: string;
          ai_featured?: boolean;
          ambiance_tags?: string[] | null;
          auto_decline_enabled?: boolean | null;
          average_rating?: number | null;
          booking_policy?: string | null;
          booking_window_days?: number | null;
          cancellation_window_hours?: number | null;
          closing_time: string;
          created_at?: string | null;
          cuisine_type: string;
          description?: string | null;
          dietary_options?: string[] | null;
          featured?: boolean | null;
          happy_hour_times?: Json | null;
          id?: string;
          image_urls?: string[] | null;
          instagram_handle?: string | null;
          live_music_schedule?: Json | null;
          location: unknown;
          main_image_url?: string | null;
          max_party_size?: number | null;
          menu_url?: string | null;
          min_party_size?: number | null;
          name: string;
          opening_time: string;
          outdoor_seating?: boolean | null;
          parking_available?: boolean | null;
          phone_number?: string | null;
          price_range?: number | null;
          request_expiry_hours?: number | null;
          review_summary?: Json | null;
          shisha_available?: boolean | null;
          status?: string | null;
          table_turnover_minutes?: number | null;
          tags?: string[] | null;
          total_reviews?: number | null;
          updated_at?: string | null;
          valet_parking?: boolean | null;
          website_url?: string | null;
          whatsapp_number?: string | null;
        };
        Update: {
          address?: string;
          ai_featured?: boolean;
          ambiance_tags?: string[] | null;
          auto_decline_enabled?: boolean | null;
          average_rating?: number | null;
          booking_policy?: string | null;
          booking_window_days?: number | null;
          cancellation_window_hours?: number | null;
          closing_time?: string;
          created_at?: string | null;
          cuisine_type?: string;
          description?: string | null;
          dietary_options?: string[] | null;
          featured?: boolean | null;
          happy_hour_times?: Json | null;
          id?: string;
          image_urls?: string[] | null;
          instagram_handle?: string | null;
          live_music_schedule?: Json | null;
          location?: unknown;
          main_image_url?: string | null;
          max_party_size?: number | null;
          menu_url?: string | null;
          min_party_size?: number | null;
          name?: string;
          opening_time?: string;
          outdoor_seating?: boolean | null;
          parking_available?: boolean | null;
          phone_number?: string | null;
          price_range?: number | null;
          request_expiry_hours?: number | null;
          review_summary?: Json | null;
          shisha_available?: boolean | null;
          status?: string | null;
          table_turnover_minutes?: number | null;
          tags?: string[] | null;
          total_reviews?: number | null;
          updated_at?: string | null;
          valet_parking?: boolean | null;
          website_url?: string | null;
          whatsapp_number?: string | null;
        };
        Relationships: [];
      };
      review_replies: {
        Row: {
          created_at: string | null;
          id: string;
          replied_by: string;
          reply_message: string;
          restaurant_id: string;
          review_id: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          replied_by: string;
          reply_message: string;
          restaurant_id: string;
          review_id: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          replied_by?: string;
          reply_message?: string;
          restaurant_id?: string;
          review_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "review_replies_replied_by_fkey";
            columns: ["replied_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_replies_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "review_replies_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "review_replies_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_replies_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "review_replies_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: true;
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          ambiance_rating: number | null;
          booking_id: string;
          comment: string | null;
          created_at: string | null;
          food_rating: number | null;
          id: string;
          photos: string[] | null;
          rating: number;
          recommend_to_friend: boolean | null;
          restaurant_id: string;
          service_rating: number | null;
          tags: string[] | null;
          updated_at: string | null;
          user_id: string;
          value_rating: number | null;
          visit_again: boolean | null;
        };
        Insert: {
          ambiance_rating?: number | null;
          booking_id: string;
          comment?: string | null;
          created_at?: string | null;
          food_rating?: number | null;
          id?: string;
          photos?: string[] | null;
          rating: number;
          recommend_to_friend?: boolean | null;
          restaurant_id: string;
          service_rating?: number | null;
          tags?: string[] | null;
          updated_at?: string | null;
          user_id: string;
          value_rating?: number | null;
          visit_again?: boolean | null;
        };
        Update: {
          ambiance_rating?: number | null;
          booking_id?: string;
          comment?: string | null;
          created_at?: string | null;
          food_rating?: number | null;
          id?: string;
          photos?: string[] | null;
          rating?: number;
          recommend_to_friend?: boolean | null;
          restaurant_id?: string;
          service_rating?: number | null;
          tags?: string[] | null;
          updated_at?: string | null;
          user_id?: string;
          value_rating?: number | null;
          visit_again?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: true;
            referencedRelation: "active_dining_bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: true;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: true;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["booking_id"];
          },
          {
            foreignKeyName: "reviews_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "reviews_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "reviews_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "reviews_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      spatial_ref_sys: {
        Row: {
          auth_name: string | null;
          auth_srid: number | null;
          proj4text: string | null;
          srid: number;
          srtext: string | null;
        };
        Insert: {
          auth_name?: string | null;
          auth_srid?: number | null;
          proj4text?: string | null;
          srid: number;
          srtext?: string | null;
        };
        Update: {
          auth_name?: string | null;
          auth_srid?: number | null;
          proj4text?: string | null;
          srid?: number;
          srtext?: string | null;
        };
        Relationships: [];
      };
      special_offers: {
        Row: {
          applicable_days: number[] | null;
          created_at: string | null;
          description: string | null;
          discount_percentage: number | null;
          id: string;
          img_url: string | null;
          is_clickable: boolean;
          minimum_party_size: number | null;
          restaurant_id: string;
          terms_conditions: string[] | null;
          title: string;
          valid_from: string;
          valid_until: string;
        };
        Insert: {
          applicable_days?: number[] | null;
          created_at?: string | null;
          description?: string | null;
          discount_percentage?: number | null;
          id?: string;
          img_url?: string | null;
          is_clickable?: boolean;
          minimum_party_size?: number | null;
          restaurant_id: string;
          terms_conditions?: string[] | null;
          title: string;
          valid_from: string;
          valid_until: string;
        };
        Update: {
          applicable_days?: number[] | null;
          created_at?: string | null;
          description?: string | null;
          discount_percentage?: number | null;
          id?: string;
          img_url?: string | null;
          is_clickable?: boolean;
          minimum_party_size?: number | null;
          restaurant_id?: string;
          terms_conditions?: string[] | null;
          title?: string;
          valid_from?: string;
          valid_until?: string;
        };
        Relationships: [
          {
            foreignKeyName: "special_offers_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "special_offers_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "special_offers_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "special_offers_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
        ];
      };
      staff_permission_templates: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: string;
          is_system_template: boolean | null;
          name: string;
          permissions: string[];
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_system_template?: boolean | null;
          name: string;
          permissions: string[];
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_system_template?: boolean | null;
          name?: string;
          permissions?: string[];
        };
        Relationships: [];
      };
      table_availability: {
        Row: {
          booking_id: string | null;
          date: string;
          id: string;
          is_available: boolean | null;
          table_id: string;
          time_slot: string;
        };
        Insert: {
          booking_id?: string | null;
          date: string;
          id?: string;
          is_available?: boolean | null;
          table_id: string;
          time_slot: string;
        };
        Update: {
          booking_id?: string | null;
          date?: string;
          id?: string;
          is_available?: boolean | null;
          table_id?: string;
          time_slot?: string;
        };
        Relationships: [
          {
            foreignKeyName: "table_availability_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "active_dining_bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "table_availability_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "table_availability_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["booking_id"];
          },
          {
            foreignKeyName: "table_availability_table_id_fkey";
            columns: ["table_id"];
            isOneToOne: false;
            referencedRelation: "mv_table_availability";
            referencedColumns: ["table_id"];
          },
          {
            foreignKeyName: "table_availability_table_id_fkey";
            columns: ["table_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_tables";
            referencedColumns: ["id"];
          },
        ];
      };
      table_combinations: {
        Row: {
          combined_capacity: number;
          created_at: string | null;
          id: string;
          is_active: boolean | null;
          primary_table_id: string;
          restaurant_id: string;
          secondary_table_id: string;
        };
        Insert: {
          combined_capacity: number;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          primary_table_id: string;
          restaurant_id: string;
          secondary_table_id: string;
        };
        Update: {
          combined_capacity?: number;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          primary_table_id?: string;
          restaurant_id?: string;
          secondary_table_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "table_combinations_primary_table_id_fkey";
            columns: ["primary_table_id"];
            isOneToOne: false;
            referencedRelation: "mv_table_availability";
            referencedColumns: ["table_id"];
          },
          {
            foreignKeyName: "table_combinations_primary_table_id_fkey";
            columns: ["primary_table_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_tables";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "table_combinations_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "table_combinations_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "table_combinations_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "table_combinations_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "table_combinations_secondary_table_id_fkey";
            columns: ["secondary_table_id"];
            isOneToOne: false;
            referencedRelation: "mv_table_availability";
            referencedColumns: ["table_id"];
          },
          {
            foreignKeyName: "table_combinations_secondary_table_id_fkey";
            columns: ["secondary_table_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_tables";
            referencedColumns: ["id"];
          },
        ];
      };
      tier_benefits: {
        Row: {
          benefit_type: string;
          benefit_value: string;
          created_at: string | null;
          description: string;
          id: string;
          is_active: boolean | null;
          tier: string;
        };
        Insert: {
          benefit_type: string;
          benefit_value: string;
          created_at?: string | null;
          description: string;
          id?: string;
          is_active?: boolean | null;
          tier: string;
        };
        Update: {
          benefit_type?: string;
          benefit_value?: string;
          created_at?: string | null;
          description?: string;
          id?: string;
          is_active?: boolean | null;
          tier?: string;
        };
        Relationships: [];
      };
      user_devices: {
        Row: {
          app_version: string | null;
          device_id: string;
          enabled: boolean | null;
          expo_push_token: string | null;
          id: string;
          last_seen: string | null;
          locale: string | null;
          platform: string | null;
          timezone: string | null;
          user_id: string;
        };
        Insert: {
          app_version?: string | null;
          device_id: string;
          enabled?: boolean | null;
          expo_push_token?: string | null;
          id?: string;
          last_seen?: string | null;
          locale?: string | null;
          platform?: string | null;
          timezone?: string | null;
          user_id: string;
        };
        Update: {
          app_version?: string | null;
          device_id?: string;
          enabled?: boolean | null;
          expo_push_token?: string | null;
          id?: string;
          last_seen?: string | null;
          locale?: string | null;
          platform?: string | null;
          timezone?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_devices_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_loyalty_rule_usage: {
        Row: {
          booking_id: string;
          id: string;
          rule_id: string;
          used_at: string | null;
          user_id: string;
        };
        Insert: {
          booking_id: string;
          id?: string;
          rule_id: string;
          used_at?: string | null;
          user_id: string;
        };
        Update: {
          booking_id?: string;
          id?: string;
          rule_id?: string;
          used_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_loyalty_rule_usage_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "active_dining_bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_loyalty_rule_usage_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_loyalty_rule_usage_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["booking_id"];
          },
          {
            foreignKeyName: "user_loyalty_rule_usage_rule_id_fkey";
            columns: ["rule_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_rules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_loyalty_rule_usage_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_offers: {
        Row: {
          booking_id: string | null;
          claimed_at: string | null;
          expires_at: string | null;
          id: string;
          metadata: Json | null;
          offer_id: string;
          redemption_code: string | null;
          status: string | null;
          used_at: string | null;
          user_id: string;
        };
        Insert: {
          booking_id?: string | null;
          claimed_at?: string | null;
          expires_at?: string | null;
          id?: string;
          metadata?: Json | null;
          offer_id: string;
          redemption_code?: string | null;
          status?: string | null;
          used_at?: string | null;
          user_id: string;
        };
        Update: {
          booking_id?: string | null;
          claimed_at?: string | null;
          expires_at?: string | null;
          id?: string;
          metadata?: Json | null;
          offer_id?: string;
          redemption_code?: string | null;
          status?: string | null;
          used_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_offers_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "active_dining_bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_offers_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_offers_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["booking_id"];
          },
          {
            foreignKeyName: "user_offers_offer_id_fkey";
            columns: ["offer_id"];
            isOneToOne: false;
            referencedRelation: "special_offers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_offers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_privacy_settings: {
        Row: {
          activity_sharing: boolean | null;
          data_analytics: boolean | null;
          location_sharing: boolean | null;
          marketing_emails: boolean | null;
          profile_visibility: string | null;
          push_notifications: boolean | null;
          review_visibility: boolean | null;
          third_party_sharing: boolean | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          activity_sharing?: boolean | null;
          data_analytics?: boolean | null;
          location_sharing?: boolean | null;
          marketing_emails?: boolean | null;
          profile_visibility?: string | null;
          push_notifications?: boolean | null;
          review_visibility?: boolean | null;
          third_party_sharing?: boolean | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          activity_sharing?: boolean | null;
          data_analytics?: boolean | null;
          location_sharing?: boolean | null;
          marketing_emails?: boolean | null;
          profile_visibility?: string | null;
          push_notifications?: boolean | null;
          review_visibility?: boolean | null;
          third_party_sharing?: boolean | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_privacy_settings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_push_tokens: {
        Row: {
          app_version: string | null;
          created_at: string | null;
          device_id: string | null;
          device_name: string | null;
          id: string;
          is_active: boolean | null;
          platform: string;
          push_token: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          app_version?: string | null;
          created_at?: string | null;
          device_id?: string | null;
          device_name?: string | null;
          id?: string;
          is_active?: boolean | null;
          platform: string;
          push_token: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          app_version?: string | null;
          created_at?: string | null;
          device_id?: string | null;
          device_name?: string | null;
          id?: string;
          is_active?: boolean | null;
          platform?: string;
          push_token?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_rating_history: {
        Row: {
          booking_id: string | null;
          change_reason: string;
          created_at: string | null;
          id: string;
          new_rating: number;
          old_rating: number | null;
          user_id: string;
        };
        Insert: {
          booking_id?: string | null;
          change_reason: string;
          created_at?: string | null;
          id?: string;
          new_rating: number;
          old_rating?: number | null;
          user_id: string;
        };
        Update: {
          booking_id?: string | null;
          change_reason?: string;
          created_at?: string | null;
          id?: string;
          new_rating?: number;
          old_rating?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_rating_history_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "active_dining_bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_rating_history_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_rating_history_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["booking_id"];
          },
          {
            foreignKeyName: "user_rating_history_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      waitlist: {
        Row: {
          created_at: string | null;
          desired_date: string;
          desired_time_range: unknown;
          id: string;
          party_size: number;
          restaurant_id: string;
          status: Database["public"]["Enums"]["waiting_status"];
          table_type: Database["public"]["Enums"]["table_type"];
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          desired_date: string;
          desired_time_range: unknown;
          id?: string;
          party_size: number;
          restaurant_id: string;
          status?: Database["public"]["Enums"]["waiting_status"];
          table_type?: Database["public"]["Enums"]["table_type"];
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          desired_date?: string;
          desired_time_range?: unknown;
          id?: string;
          party_size?: number;
          restaurant_id?: string;
          status?: Database["public"]["Enums"]["waiting_status"];
          table_type?: Database["public"]["Enums"]["table_type"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "waitlist_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "waitlist_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "waitlist_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "waitlist_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "waitlist_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      active_dining_bookings: {
        Row: {
          actual_end_time: string | null;
          applied_loyalty_rule_id: string | null;
          applied_offer_id: string | null;
          attendees: number | null;
          booking_time: string | null;
          checked_in_at: string | null;
          confirmation_code: string | null;
          created_at: string | null;
          dietary_notes: string[] | null;
          expected_loyalty_points: number | null;
          guest_email: string | null;
          guest_full_name: string | null;
          guest_name: string | null;
          guest_phone: string | null;
          guest_phone_number: string | null;
          id: string | null;
          is_group_booking: boolean | null;
          loyalty_points_earned: number | null;
          meal_progress: Json | null;
          occasion: string | null;
          organizer_id: string | null;
          party_size: number | null;
          reminder_sent: boolean | null;
          restaurant_id: string | null;
          seated_at: string | null;
          special_requests: string | null;
          status: string | null;
          table_count: number | null;
          table_numbers: string[] | null;
          table_preferences: string[] | null;
          turn_time_minutes: number | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_applied_loyalty_rule_id_fkey";
            columns: ["applied_loyalty_rule_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_rules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_applied_offer_id_fkey";
            columns: ["applied_offer_id"];
            isOneToOne: false;
            referencedRelation: "special_offers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_organizer_id_fkey";
            columns: ["organizer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "bookings_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "bookings_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "bookings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      geography_columns: {
        Row: {
          coord_dimension: number | null;
          f_geography_column: unknown | null;
          f_table_catalog: unknown | null;
          f_table_name: unknown | null;
          f_table_schema: unknown | null;
          srid: number | null;
          type: string | null;
        };
        Relationships: [];
      };
      geometry_columns: {
        Row: {
          coord_dimension: number | null;
          f_geometry_column: unknown | null;
          f_table_catalog: string | null;
          f_table_name: unknown | null;
          f_table_schema: unknown | null;
          srid: number | null;
          type: string | null;
        };
        Insert: {
          coord_dimension?: number | null;
          f_geometry_column?: unknown | null;
          f_table_catalog?: string | null;
          f_table_name?: unknown | null;
          f_table_schema?: unknown | null;
          srid?: number | null;
          type?: string | null;
        };
        Update: {
          coord_dimension?: number | null;
          f_geometry_column?: unknown | null;
          f_table_catalog?: string | null;
          f_table_name?: unknown | null;
          f_table_schema?: unknown | null;
          srid?: number | null;
          type?: string | null;
        };
        Relationships: [];
      };
      mv_table_availability: {
        Row: {
          bookings: Json | null;
          capacity: number | null;
          is_active: boolean | null;
          is_combinable: boolean | null;
          max_capacity: number | null;
          min_capacity: number | null;
          priority_score: number | null;
          restaurant_id: string | null;
          table_id: string | null;
          table_number: string | null;
          table_type: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_tables_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_tables_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "restaurant_tables_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_tables_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
        ];
      };
      playlist_stats: {
        Row: {
          collaborator_count: number | null;
          created_at: string | null;
          description: string | null;
          emoji: string | null;
          id: string | null;
          is_public: boolean | null;
          item_count: number | null;
          last_updated: string | null;
          name: string | null;
          share_code: string | null;
          updated_at: string | null;
          user_id: string | null;
          view_count: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_playlists_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      posts_with_details: {
        Row: {
          booking_id: string | null;
          comments_count: number | null;
          content: string | null;
          created_at: string | null;
          id: string | null;
          images: Json | null;
          images_count: number | null;
          likes_count: number | null;
          restaurant_id: string | null;
          restaurant_image: string | null;
          restaurant_name: string | null;
          tagged_friends: Json | null;
          updated_at: string | null;
          user_avatar: string | null;
          user_id: string | null;
          user_name: string | null;
          visibility: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "posts_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "active_dining_bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["booking_id"];
          },
          {
            foreignKeyName: "posts_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "posts_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "posts_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "posts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      restaurant_hours_summary: {
        Row: {
          restaurant_id: string | null;
          restaurant_name: string | null;
          weekly_hours: Json | null;
        };
        Relationships: [];
      };
      restaurant_loyalty_analytics: {
        Row: {
          active_rules: number | null;
          current_balance: number | null;
          restaurant_id: string | null;
          restaurant_name: string | null;
          total_awards: number | null;
          total_points_awarded: number | null;
          total_points_refunded: number | null;
          total_purchased: number | null;
        };
        Relationships: [];
      };
      v_bookings_with_tables: {
        Row: {
          assigned_tables: Json | null;
          booking_id: string | null;
          booking_time: string | null;
          confirmation_code: string | null;
          created_at: string | null;
          party_size: number | null;
          restaurant_id: string | null;
          restaurant_name: string | null;
          status: string | null;
          table_count: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      _http_post_edge: {
        Args: { path: string };
        Returns: undefined;
      };
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string };
        Returns: undefined;
      };
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown };
        Returns: unknown;
      };
      _postgis_pgsql_version: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      _postgis_scripts_pgsql_version: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown };
        Returns: number;
      };
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      _st_bestsrid: {
        Args: { "": unknown };
        Returns: number;
      };
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      _st_coveredby: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      _st_covers: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      _st_dwithin: {
        Args: {
          geog1: unknown;
          geog2: unknown;
          tolerance: number;
          use_spheroid?: boolean;
        };
        Returns: boolean;
      };
      _st_equals: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown };
        Returns: number;
      };
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      _st_pointoutside: {
        Args: { "": unknown };
        Returns: unknown;
      };
      _st_sortablehash: {
        Args: { geom: unknown };
        Returns: number;
      };
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      _st_voronoi: {
        Args: {
          clip?: unknown;
          g1: unknown;
          return_polygons?: boolean;
          tolerance?: number;
        };
        Returns: unknown;
      };
      _st_within: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      addauth: {
        Args: { "": string };
        Returns: boolean;
      };
      addgeometrycolumn: {
        Args:
          | {
              catalog_name: string;
              column_name: string;
              new_dim: number;
              new_srid_in: number;
              new_type: string;
              schema_name: string;
              table_name: string;
              use_typmod?: boolean;
            }
          | {
              column_name: string;
              new_dim: number;
              new_srid: number;
              new_type: string;
              schema_name: string;
              table_name: string;
              use_typmod?: boolean;
            }
          | {
              column_name: string;
              new_dim: number;
              new_srid: number;
              new_type: string;
              table_name: string;
              use_typmod?: boolean;
            };
        Returns: string;
      };
      archive_old_bookings: {
        Args:
          | { p_archive_user_id?: string; p_days_to_keep?: number }
          | { p_days_to_keep?: number };
        Returns: number;
      };
      auto_decline_expired_pending_bookings: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      auto_decline_expired_requests: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      award_loyalty_points: {
        Args: { p_points: number; p_user_id: string };
        Returns: undefined;
      };
      award_loyalty_points_with_tracking: {
        Args: {
          p_activity_type?: string;
          p_description?: string;
          p_metadata?: Json;
          p_points: number;
          p_related_booking_id?: string;
          p_related_review_id?: string;
          p_user_id: string;
        };
        Returns: {
          new_points: number;
          new_tier: string;
          tier_changed: boolean;
        }[];
      };
      award_restaurant_loyalty_points: {
        Args: { p_booking_id: string };
        Returns: boolean;
      };
      box: {
        Args: { "": unknown } | { "": unknown };
        Returns: unknown;
      };
      box2d: {
        Args: { "": unknown } | { "": unknown };
        Returns: unknown;
      };
      box2d_in: {
        Args: { "": unknown };
        Returns: unknown;
      };
      box2d_out: {
        Args: { "": unknown };
        Returns: unknown;
      };
      box2df_in: {
        Args: { "": unknown };
        Returns: unknown;
      };
      box2df_out: {
        Args: { "": unknown };
        Returns: unknown;
      };
      box3d: {
        Args: { "": unknown } | { "": unknown };
        Returns: unknown;
      };
      box3d_in: {
        Args: { "": unknown };
        Returns: unknown;
      };
      box3d_out: {
        Args: { "": unknown };
        Returns: unknown;
      };
      box3dtobox: {
        Args: { "": unknown };
        Returns: unknown;
      };
      bytea: {
        Args: { "": unknown } | { "": unknown };
        Returns: string;
      };
      calculate_offer_expiry: {
        Args: { p_claimed_at: string; p_offer_valid_until: string };
        Returns: string;
      };
      calculate_tier: {
        Args: { p_points: number };
        Returns: string;
      };
      calculate_user_rating: {
        Args: { p_user_id: string };
        Returns: number;
      };
      check_booking_overlap: {
        Args:
          | {
              p_end_time: string;
              p_exclude_booking_id?: string;
              p_exclude_user_id?: string;
              p_start_time: string;
              p_table_ids: string[];
            }
          | {
              p_end_time: string;
              p_exclude_booking_id?: string;
              p_start_time: string;
              p_table_ids: string[];
            };
        Returns: string;
      };
      check_booking_system_health: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      check_in_booking: {
        Args: { p_booking_id: string; p_checked_in_by?: string };
        Returns: boolean;
      };
      check_loyalty_rules_for_booking: {
        Args: { p_booking_id: string };
        Returns: {
          points_to_award: number;
          rule_id: string;
          rule_name: string;
        }[];
      };
      cleanup_expired_loyalty_rules: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      cleanup_old_notifications: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      complete_booking_and_finalize_loyalty: {
        Args: { p_booking_id: string };
        Returns: boolean;
      };
      create_booking_with_tables: {
        Args:
          | {
              p_applied_loyalty_rule_id?: string;
              p_applied_offer_id?: string;
              p_booking_policy?: string;
              p_booking_time: string;
              p_dietary_notes?: string[];
              p_expected_loyalty_points?: number;
              p_is_group_booking?: boolean;
              p_occasion?: string;
              p_party_size: number;
              p_restaurant_id: string;
              p_special_requests?: string;
              p_table_ids: string[];
              p_table_preferences?: string[];
              p_turn_time: number;
              p_user_id: string;
            }
          | {
              p_applied_offer_id?: string;
              p_booking_time: string;
              p_dietary_notes?: string[];
              p_is_group_booking?: boolean;
              p_occasion?: string;
              p_party_size: number;
              p_restaurant_id: string;
              p_special_requests?: string;
              p_table_ids: string[];
              p_table_preferences?: string[];
              p_turn_time: number;
              p_user_id: string;
            };
        Returns: Json;
      };
      create_booking_with_tables_debug: {
        Args: {
          p_applied_offer_id?: string;
          p_booking_time: string;
          p_dietary_notes?: string[];
          p_is_group_booking?: boolean;
          p_occasion?: string;
          p_party_size: number;
          p_restaurant_id: string;
          p_special_requests?: string;
          p_table_ids: string[];
          p_table_preferences?: string[];
          p_turn_time: number;
          p_user_id: string;
        };
        Returns: Json;
      };
      create_notification: {
        Args: {
          p_data?: Json;
          p_message: string;
          p_title: string;
          p_type: string;
          p_user_id: string;
        };
        Returns: string;
      };
      disablelongtransactions: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      dropgeometrycolumn: {
        Args:
          | {
              catalog_name: string;
              column_name: string;
              schema_name: string;
              table_name: string;
            }
          | { column_name: string; schema_name: string; table_name: string }
          | { column_name: string; table_name: string };
        Returns: string;
      };
      dropgeometrytable: {
        Args:
          | { catalog_name: string; schema_name: string; table_name: string }
          | { schema_name: string; table_name: string }
          | { table_name: string };
        Returns: string;
      };
      enablelongtransactions: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      enqueue_booking_reminders: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      enqueue_notification: {
        Args: {
          p_category: string;
          p_channels?: string[];
          p_data?: Json;
          p_deeplink?: string;
          p_message: string;
          p_title: string;
          p_type: string;
          p_user_id: string;
        };
        Returns: string;
      };
      enqueue_offer_expiry_notices: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      enqueue_review_reminders: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      equals: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      expire_old_redemptions: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      expire_old_user_offers: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      find_alternative_slots: {
        Args: {
          p_duration_minutes: number;
          p_original_time: string;
          p_party_size: number;
          p_restaurant_id: string;
        };
        Returns: {
          available_tables: number;
          suggested_time: string;
        }[];
      };
      fix_booking_without_tables: {
        Args: { p_booking_id: string };
        Returns: Json;
      };
      fix_customer_data_inconsistencies: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      generate_order_number: {
        Args: { restaurant_id: string };
        Returns: string;
      };
      generate_share_code: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      geography: {
        Args: { "": string } | { "": unknown };
        Returns: unknown;
      };
      geography_analyze: {
        Args: { "": unknown };
        Returns: boolean;
      };
      geography_gist_compress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      geography_gist_decompress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      geography_out: {
        Args: { "": unknown };
        Returns: unknown;
      };
      geography_send: {
        Args: { "": unknown };
        Returns: string;
      };
      geography_spgist_compress_nd: {
        Args: { "": unknown };
        Returns: unknown;
      };
      geography_typmod_in: {
        Args: { "": unknown[] };
        Returns: number;
      };
      geography_typmod_out: {
        Args: { "": number };
        Returns: unknown;
      };
      geometry: {
        Args:
          | { "": string }
          | { "": string }
          | { "": unknown }
          | { "": unknown }
          | { "": unknown }
          | { "": unknown }
          | { "": unknown }
          | { "": unknown };
        Returns: unknown;
      };
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_analyze: {
        Args: { "": unknown };
        Returns: boolean;
      };
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_gist_compress_2d: {
        Args: { "": unknown };
        Returns: unknown;
      };
      geometry_gist_compress_nd: {
        Args: { "": unknown };
        Returns: unknown;
      };
      geometry_gist_decompress_2d: {
        Args: { "": unknown };
        Returns: unknown;
      };
      geometry_gist_decompress_nd: {
        Args: { "": unknown };
        Returns: unknown;
      };
      geometry_gist_sortsupport_2d: {
        Args: { "": unknown };
        Returns: undefined;
      };
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_hash: {
        Args: { "": unknown };
        Returns: number;
      };
      geometry_in: {
        Args: { "": unknown };
        Returns: unknown;
      };
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_out: {
        Args: { "": unknown };
        Returns: unknown;
      };
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_recv: {
        Args: { "": unknown };
        Returns: unknown;
      };
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_send: {
        Args: { "": unknown };
        Returns: string;
      };
      geometry_sortsupport: {
        Args: { "": unknown };
        Returns: undefined;
      };
      geometry_spgist_compress_2d: {
        Args: { "": unknown };
        Returns: unknown;
      };
      geometry_spgist_compress_3d: {
        Args: { "": unknown };
        Returns: unknown;
      };
      geometry_spgist_compress_nd: {
        Args: { "": unknown };
        Returns: unknown;
      };
      geometry_typmod_in: {
        Args: { "": unknown[] };
        Returns: number;
      };
      geometry_typmod_out: {
        Args: { "": number };
        Returns: unknown;
      };
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometrytype: {
        Args: { "": unknown } | { "": unknown };
        Returns: string;
      };
      geomfromewkb: {
        Args: { "": string };
        Returns: unknown;
      };
      geomfromewkt: {
        Args: { "": string };
        Returns: unknown;
      };
      get_available_tables: {
        Args: {
          p_end_time: string;
          p_party_size: number;
          p_restaurant_id: string;
          p_start_time: string;
        };
        Returns: {
          capacity: number;
          is_combinable: boolean;
          max_capacity: number;
          min_capacity: number;
          priority_score: number;
          table_id: string;
          table_number: string;
          table_type: string;
        }[];
      };
      get_booked_tables_for_slot: {
        Args: {
          p_end_time: string;
          p_restaurant_id: string;
          p_start_time: string;
        };
        Returns: {
          table_id: string;
        }[];
      };
      get_friend_recommendations: {
        Args: { p_limit?: number; p_user_id: string };
        Returns: {
          avatar_url: string;
          email: string;
          full_name: string;
          mutual_friends_count: number;
          user_id: string;
        }[];
      };
      get_friend_suggestions: {
        Args: Record<PropertyKey, never>;
        Returns: {
          avatar_url: string;
          common_restaurants: number;
          full_name: string;
          id: string;
          mutual_friends_count: number;
        }[];
      };
      get_loyalty_summary: {
        Args: { p_user_id: string };
        Returns: {
          active_redemptions: number;
          current_tier: string;
          points_to_next_tier: number;
          tier_benefits: Json;
          total_earned: number;
          total_points: number;
          total_redeemed: number;
        }[];
      };
      get_max_turn_time: {
        Args: { p_restaurant_id: string };
        Returns: number;
      };
      get_pending_bookings_count: {
        Args: { p_restaurant_id: string };
        Returns: number;
      };
      get_proj4_from_srid: {
        Args: { "": number };
        Returns: string;
      };
      get_restaurant_menu: {
        Args: { p_restaurant_id: string };
        Returns: {
          category_description: string;
          category_id: string;
          category_name: string;
          category_order: number;
          items: Json;
        }[];
      };
      get_restaurant_status: {
        Args: { p_check_time?: string; p_restaurant_id: string };
        Returns: {
          close_time: string;
          is_open: boolean;
          open_time: string;
          reason: string;
        }[];
      };
      get_table_availability_by_hour: {
        Args: { p_date: string; p_restaurant_id: string };
        Returns: {
          available_tables: number;
          hour: number;
          total_tables: number;
          utilization_percentage: number;
        }[];
      };
      get_table_utilization_report: {
        Args: {
          p_end_date?: string;
          p_restaurant_id: string;
          p_start_date?: string;
        };
        Returns: Json;
      };
      get_turn_time: {
        Args: {
          p_booking_time?: string;
          p_party_size: number;
          p_restaurant_id: string;
        };
        Returns: number;
      };
      get_user_offer_stats: {
        Args: { p_user_id: string };
        Returns: {
          active_offers: number;
          expired_offers: number;
          total_claimed: number;
          total_savings: number;
          used_offers: number;
        }[];
      };
      get_user_rating_stats: {
        Args: { p_user_id: string };
        Returns: {
          cancelled_bookings: number;
          completed_bookings: number;
          completion_rate: number;
          current_rating: number;
          no_show_bookings: number;
          rating_trend: string;
          reliability_score: string;
          total_bookings: number;
        }[];
      };
      get_user_restaurant_loyalty_summary: {
        Args: { p_restaurant_id?: string; p_user_id: string };
        Returns: {
          last_earned_date: string;
          restaurant_name: string;
          total_bookings: number;
          total_points_earned: number;
        }[];
      };
      gettransactionid: {
        Args: Record<PropertyKey, never>;
        Returns: unknown;
      };
      gidx_in: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gidx_out: {
        Args: { "": unknown };
        Returns: unknown;
      };
      json: {
        Args: { "": unknown };
        Returns: Json;
      };
      jsonb: {
        Args: { "": unknown };
        Returns: Json;
      };
      lock_booking_for_update: {
        Args: { p_booking_id: string };
        Returns: Json;
      };
      longtransactionsenabled: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      migrate_existing_bookings_to_customers: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      path: {
        Args: { "": unknown };
        Returns: unknown;
      };
      perform_daily_maintenance: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      pgis_asflatgeobuf_finalfn: {
        Args: { "": unknown };
        Returns: string;
      };
      pgis_asgeobuf_finalfn: {
        Args: { "": unknown };
        Returns: string;
      };
      pgis_asmvt_finalfn: {
        Args: { "": unknown };
        Returns: string;
      };
      pgis_asmvt_serialfn: {
        Args: { "": unknown };
        Returns: string;
      };
      pgis_geometry_clusterintersecting_finalfn: {
        Args: { "": unknown };
        Returns: unknown[];
      };
      pgis_geometry_clusterwithin_finalfn: {
        Args: { "": unknown };
        Returns: unknown[];
      };
      pgis_geometry_collect_finalfn: {
        Args: { "": unknown };
        Returns: unknown;
      };
      pgis_geometry_makeline_finalfn: {
        Args: { "": unknown };
        Returns: unknown;
      };
      pgis_geometry_polygonize_finalfn: {
        Args: { "": unknown };
        Returns: unknown;
      };
      pgis_geometry_union_parallel_finalfn: {
        Args: { "": unknown };
        Returns: unknown;
      };
      pgis_geometry_union_parallel_serialfn: {
        Args: { "": unknown };
        Returns: string;
      };
      point: {
        Args: { "": unknown };
        Returns: unknown;
      };
      polygon: {
        Args: { "": unknown };
        Returns: unknown;
      };
      populate_geometry_columns: {
        Args:
          | { tbl_oid: unknown; use_typmod?: boolean }
          | { use_typmod?: boolean };
        Returns: string;
      };
      postgis_addbbox: {
        Args: { "": unknown };
        Returns: unknown;
      };
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string };
        Returns: number;
      };
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string };
        Returns: number;
      };
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string };
        Returns: string;
      };
      postgis_dropbbox: {
        Args: { "": unknown };
        Returns: unknown;
      };
      postgis_extensions_upgrade: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      postgis_full_version: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      postgis_geos_noop: {
        Args: { "": unknown };
        Returns: unknown;
      };
      postgis_geos_version: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      postgis_getbbox: {
        Args: { "": unknown };
        Returns: unknown;
      };
      postgis_hasbbox: {
        Args: { "": unknown };
        Returns: boolean;
      };
      postgis_index_supportfn: {
        Args: { "": unknown };
        Returns: unknown;
      };
      postgis_lib_build_date: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      postgis_lib_revision: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      postgis_lib_version: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      postgis_libjson_version: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      postgis_liblwgeom_version: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      postgis_libprotobuf_version: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      postgis_libxml_version: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      postgis_noop: {
        Args: { "": unknown };
        Returns: unknown;
      };
      postgis_proj_version: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      postgis_scripts_build_date: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      postgis_scripts_installed: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      postgis_scripts_released: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      postgis_svn_version: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      postgis_type_name: {
        Args: {
          coord_dimension: number;
          geomname: string;
          use_new_name?: boolean;
        };
        Returns: string;
      };
      postgis_typmod_dims: {
        Args: { "": number };
        Returns: number;
      };
      postgis_typmod_srid: {
        Args: { "": number };
        Returns: number;
      };
      postgis_typmod_type: {
        Args: { "": number };
        Returns: string;
      };
      postgis_version: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      postgis_wagyu_version: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      quick_availability_check: {
        Args: {
          p_end_time: string;
          p_party_size: number;
          p_restaurant_id: string;
          p_start_time: string;
        };
        Returns: boolean;
      };
      redeem_loyalty_reward: {
        Args: {
          p_offer_id?: string;
          p_points_cost?: number;
          p_reward_id?: string;
          p_user_id: string;
        };
        Returns: {
          expires_at: string;
          redemption_code: string;
          redemption_id: string;
        }[];
      };
      refresh_table_availability: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      refund_restaurant_loyalty_points: {
        Args: { p_booking_id: string };
        Returns: boolean;
      };
      run_notify: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      run_schedule_reminders: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      search_users: {
        Args: { search_query: string };
        Returns: {
          avatar_url: string;
          full_name: string;
          id: string;
          is_friend: boolean;
        }[];
      };
      send_push_notification: {
        Args: {
          p_body: string;
          p_data?: Json;
          p_notification_type?: string;
          p_priority?: string;
          p_title: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      should_block_pending_bookings: {
        Args: { p_restaurant_id: string };
        Returns: boolean;
      };
      should_send_notification: {
        Args: { p_notification_type: string; p_user_id: string };
        Returns: boolean;
      };
      spheroid_in: {
        Args: { "": unknown };
        Returns: unknown;
      };
      spheroid_out: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      st_3dlength: {
        Args: { "": unknown };
        Returns: number;
      };
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      st_3dperimeter: {
        Args: { "": unknown };
        Returns: number;
      };
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_angle: {
        Args:
          | { line1: unknown; line2: unknown }
          | { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown };
        Returns: number;
      };
      st_area: {
        Args:
          | { "": string }
          | { "": unknown }
          | { geog: unknown; use_spheroid?: boolean };
        Returns: number;
      };
      st_area2d: {
        Args: { "": unknown };
        Returns: number;
      };
      st_asbinary: {
        Args: { "": unknown } | { "": unknown };
        Returns: string;
      };
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number };
        Returns: string;
      };
      st_asewkb: {
        Args: { "": unknown };
        Returns: string;
      };
      st_asewkt: {
        Args: { "": string } | { "": unknown } | { "": unknown };
        Returns: string;
      };
      st_asgeojson: {
        Args:
          | { "": string }
          | { geog: unknown; maxdecimaldigits?: number; options?: number }
          | { geom: unknown; maxdecimaldigits?: number; options?: number }
          | {
              geom_column?: string;
              maxdecimaldigits?: number;
              pretty_bool?: boolean;
              r: Record<string, unknown>;
            };
        Returns: string;
      };
      st_asgml: {
        Args:
          | { "": string }
          | {
              geog: unknown;
              id?: string;
              maxdecimaldigits?: number;
              nprefix?: string;
              options?: number;
            }
          | {
              geog: unknown;
              id?: string;
              maxdecimaldigits?: number;
              nprefix?: string;
              options?: number;
              version: number;
            }
          | {
              geom: unknown;
              id?: string;
              maxdecimaldigits?: number;
              nprefix?: string;
              options?: number;
              version: number;
            }
          | { geom: unknown; maxdecimaldigits?: number; options?: number };
        Returns: string;
      };
      st_ashexewkb: {
        Args: { "": unknown };
        Returns: string;
      };
      st_askml: {
        Args:
          | { "": string }
          | { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
          | { geom: unknown; maxdecimaldigits?: number; nprefix?: string };
        Returns: string;
      };
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string };
        Returns: string;
      };
      st_asmarc21: {
        Args: { format?: string; geom: unknown };
        Returns: string;
      };
      st_asmvtgeom: {
        Args: {
          bounds: unknown;
          buffer?: number;
          clip_geom?: boolean;
          extent?: number;
          geom: unknown;
        };
        Returns: unknown;
      };
      st_assvg: {
        Args:
          | { "": string }
          | { geog: unknown; maxdecimaldigits?: number; rel?: number }
          | { geom: unknown; maxdecimaldigits?: number; rel?: number };
        Returns: string;
      };
      st_astext: {
        Args: { "": string } | { "": unknown } | { "": unknown };
        Returns: string;
      };
      st_astwkb: {
        Args:
          | {
              geom: unknown[];
              ids: number[];
              prec?: number;
              prec_m?: number;
              prec_z?: number;
              with_boxes?: boolean;
              with_sizes?: boolean;
            }
          | {
              geom: unknown;
              prec?: number;
              prec_m?: number;
              prec_z?: number;
              with_boxes?: boolean;
              with_sizes?: boolean;
            };
        Returns: string;
      };
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number };
        Returns: string;
      };
      st_azimuth: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      st_boundary: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown };
        Returns: unknown;
      };
      st_buffer: {
        Args:
          | { geom: unknown; options?: string; radius: number }
          | { geom: unknown; quadsegs: number; radius: number };
        Returns: unknown;
      };
      st_buildarea: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_centroid: {
        Args: { "": string } | { "": unknown };
        Returns: unknown;
      };
      st_cleangeometry: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown };
        Returns: unknown;
      };
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_clusterintersecting: {
        Args: { "": unknown[] };
        Returns: unknown[];
      };
      st_collect: {
        Args: { "": unknown[] } | { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_collectionextract: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_collectionhomogenize: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean;
          param_geom: unknown;
          param_pctconvex: number;
        };
        Returns: unknown;
      };
      st_contains: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      st_convexhull: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_coorddim: {
        Args: { geometry: unknown };
        Returns: number;
      };
      st_coveredby: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      st_covers: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      st_crosses: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number };
        Returns: unknown;
      };
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number };
        Returns: unknown;
      };
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number };
        Returns: unknown;
      };
      st_dimension: {
        Args: { "": unknown };
        Returns: number;
      };
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      st_distance: {
        Args:
          | { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
          | { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      st_distancesphere: {
        Args:
          | { geom1: unknown; geom2: unknown }
          | { geom1: unknown; geom2: unknown; radius: number };
        Returns: number;
      };
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      st_dump: {
        Args: { "": unknown };
        Returns: Database["public"]["CompositeTypes"]["geometry_dump"][];
      };
      st_dumppoints: {
        Args: { "": unknown };
        Returns: Database["public"]["CompositeTypes"]["geometry_dump"][];
      };
      st_dumprings: {
        Args: { "": unknown };
        Returns: Database["public"]["CompositeTypes"]["geometry_dump"][];
      };
      st_dumpsegments: {
        Args: { "": unknown };
        Returns: Database["public"]["CompositeTypes"]["geometry_dump"][];
      };
      st_dwithin: {
        Args: {
          geog1: unknown;
          geog2: unknown;
          tolerance: number;
          use_spheroid?: boolean;
        };
        Returns: boolean;
      };
      st_endpoint: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_envelope: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_equals: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      st_expand: {
        Args:
          | { box: unknown; dx: number; dy: number }
          | { box: unknown; dx: number; dy: number; dz?: number }
          | { dm?: number; dx: number; dy: number; dz?: number; geom: unknown };
        Returns: unknown;
      };
      st_exteriorring: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_flipcoordinates: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_force2d: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_force3d: {
        Args: { geom: unknown; zvalue?: number };
        Returns: unknown;
      };
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number };
        Returns: unknown;
      };
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number };
        Returns: unknown;
      };
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number };
        Returns: unknown;
      };
      st_forcecollection: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_forcecurve: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_forcepolygonccw: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_forcepolygoncw: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_forcerhr: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_forcesfs: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_generatepoints: {
        Args:
          | { area: unknown; npoints: number }
          | { area: unknown; npoints: number; seed: number };
        Returns: unknown;
      };
      st_geogfromtext: {
        Args: { "": string };
        Returns: unknown;
      };
      st_geogfromwkb: {
        Args: { "": string };
        Returns: unknown;
      };
      st_geographyfromtext: {
        Args: { "": string };
        Returns: unknown;
      };
      st_geohash: {
        Args:
          | { geog: unknown; maxchars?: number }
          | { geom: unknown; maxchars?: number };
        Returns: string;
      };
      st_geomcollfromtext: {
        Args: { "": string };
        Returns: unknown;
      };
      st_geomcollfromwkb: {
        Args: { "": string };
        Returns: unknown;
      };
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean;
          g: unknown;
          max_iter?: number;
          tolerance?: number;
        };
        Returns: unknown;
      };
      st_geometryfromtext: {
        Args: { "": string };
        Returns: unknown;
      };
      st_geometrytype: {
        Args: { "": unknown };
        Returns: string;
      };
      st_geomfromewkb: {
        Args: { "": string };
        Returns: unknown;
      };
      st_geomfromewkt: {
        Args: { "": string };
        Returns: unknown;
      };
      st_geomfromgeojson: {
        Args: { "": Json } | { "": Json } | { "": string };
        Returns: unknown;
      };
      st_geomfromgml: {
        Args: { "": string };
        Returns: unknown;
      };
      st_geomfromkml: {
        Args: { "": string };
        Returns: unknown;
      };
      st_geomfrommarc21: {
        Args: { marc21xml: string };
        Returns: unknown;
      };
      st_geomfromtext: {
        Args: { "": string };
        Returns: unknown;
      };
      st_geomfromtwkb: {
        Args: { "": string };
        Returns: unknown;
      };
      st_geomfromwkb: {
        Args: { "": string };
        Returns: unknown;
      };
      st_gmltosql: {
        Args: { "": string };
        Returns: unknown;
      };
      st_hasarc: {
        Args: { geometry: unknown };
        Returns: boolean;
      };
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      st_hexagon: {
        Args: {
          cell_i: number;
          cell_j: number;
          origin?: unknown;
          size: number;
        };
        Returns: unknown;
      };
      st_hexagongrid: {
        Args: { bounds: unknown; size: number };
        Returns: Record<string, unknown>[];
      };
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown };
        Returns: number;
      };
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number };
        Returns: unknown;
      };
      st_intersects: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      st_isclosed: {
        Args: { "": unknown };
        Returns: boolean;
      };
      st_iscollection: {
        Args: { "": unknown };
        Returns: boolean;
      };
      st_isempty: {
        Args: { "": unknown };
        Returns: boolean;
      };
      st_ispolygonccw: {
        Args: { "": unknown };
        Returns: boolean;
      };
      st_ispolygoncw: {
        Args: { "": unknown };
        Returns: boolean;
      };
      st_isring: {
        Args: { "": unknown };
        Returns: boolean;
      };
      st_issimple: {
        Args: { "": unknown };
        Returns: boolean;
      };
      st_isvalid: {
        Args: { "": unknown };
        Returns: boolean;
      };
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown };
        Returns: Database["public"]["CompositeTypes"]["valid_detail"];
      };
      st_isvalidreason: {
        Args: { "": unknown };
        Returns: string;
      };
      st_isvalidtrajectory: {
        Args: { "": unknown };
        Returns: boolean;
      };
      st_length: {
        Args:
          | { "": string }
          | { "": unknown }
          | { geog: unknown; use_spheroid?: boolean };
        Returns: number;
      };
      st_length2d: {
        Args: { "": unknown };
        Returns: number;
      };
      st_letters: {
        Args: { font?: Json; letters: string };
        Returns: unknown;
      };
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown };
        Returns: number;
      };
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string };
        Returns: unknown;
      };
      st_linefrommultipoint: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_linefromtext: {
        Args: { "": string };
        Returns: unknown;
      };
      st_linefromwkb: {
        Args: { "": string };
        Returns: unknown;
      };
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      st_linemerge: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_linestringfromwkb: {
        Args: { "": string };
        Returns: unknown;
      };
      st_linetocurve: {
        Args: { geometry: unknown };
        Returns: unknown;
      };
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number };
        Returns: unknown;
      };
      st_locatebetween: {
        Args: {
          frommeasure: number;
          geometry: unknown;
          leftrightoffset?: number;
          tomeasure: number;
        };
        Returns: unknown;
      };
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number };
        Returns: unknown;
      };
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_m: {
        Args: { "": unknown };
        Returns: number;
      };
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_makeline: {
        Args: { "": unknown[] } | { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_makepolygon: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_makevalid: {
        Args: { "": unknown } | { geom: unknown; params: string };
        Returns: unknown;
      };
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      st_maximuminscribedcircle: {
        Args: { "": unknown };
        Returns: Record<string, unknown>;
      };
      st_memsize: {
        Args: { "": unknown };
        Returns: number;
      };
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number };
        Returns: unknown;
      };
      st_minimumboundingradius: {
        Args: { "": unknown };
        Returns: Record<string, unknown>;
      };
      st_minimumclearance: {
        Args: { "": unknown };
        Returns: number;
      };
      st_minimumclearanceline: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_mlinefromtext: {
        Args: { "": string };
        Returns: unknown;
      };
      st_mlinefromwkb: {
        Args: { "": string };
        Returns: unknown;
      };
      st_mpointfromtext: {
        Args: { "": string };
        Returns: unknown;
      };
      st_mpointfromwkb: {
        Args: { "": string };
        Returns: unknown;
      };
      st_mpolyfromtext: {
        Args: { "": string };
        Returns: unknown;
      };
      st_mpolyfromwkb: {
        Args: { "": string };
        Returns: unknown;
      };
      st_multi: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_multilinefromwkb: {
        Args: { "": string };
        Returns: unknown;
      };
      st_multilinestringfromtext: {
        Args: { "": string };
        Returns: unknown;
      };
      st_multipointfromtext: {
        Args: { "": string };
        Returns: unknown;
      };
      st_multipointfromwkb: {
        Args: { "": string };
        Returns: unknown;
      };
      st_multipolyfromwkb: {
        Args: { "": string };
        Returns: unknown;
      };
      st_multipolygonfromtext: {
        Args: { "": string };
        Returns: unknown;
      };
      st_ndims: {
        Args: { "": unknown };
        Returns: number;
      };
      st_node: {
        Args: { g: unknown };
        Returns: unknown;
      };
      st_normalize: {
        Args: { geom: unknown };
        Returns: unknown;
      };
      st_npoints: {
        Args: { "": unknown };
        Returns: number;
      };
      st_nrings: {
        Args: { "": unknown };
        Returns: number;
      };
      st_numgeometries: {
        Args: { "": unknown };
        Returns: number;
      };
      st_numinteriorring: {
        Args: { "": unknown };
        Returns: number;
      };
      st_numinteriorrings: {
        Args: { "": unknown };
        Returns: number;
      };
      st_numpatches: {
        Args: { "": unknown };
        Returns: number;
      };
      st_numpoints: {
        Args: { "": unknown };
        Returns: number;
      };
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string };
        Returns: unknown;
      };
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      st_orientedenvelope: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      st_perimeter: {
        Args: { "": unknown } | { geog: unknown; use_spheroid?: boolean };
        Returns: number;
      };
      st_perimeter2d: {
        Args: { "": unknown };
        Returns: number;
      };
      st_pointfromtext: {
        Args: { "": string };
        Returns: unknown;
      };
      st_pointfromwkb: {
        Args: { "": string };
        Returns: unknown;
      };
      st_pointm: {
        Args: {
          mcoordinate: number;
          srid?: number;
          xcoordinate: number;
          ycoordinate: number;
        };
        Returns: unknown;
      };
      st_pointonsurface: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_points: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_pointz: {
        Args: {
          srid?: number;
          xcoordinate: number;
          ycoordinate: number;
          zcoordinate: number;
        };
        Returns: unknown;
      };
      st_pointzm: {
        Args: {
          mcoordinate: number;
          srid?: number;
          xcoordinate: number;
          ycoordinate: number;
          zcoordinate: number;
        };
        Returns: unknown;
      };
      st_polyfromtext: {
        Args: { "": string };
        Returns: unknown;
      };
      st_polyfromwkb: {
        Args: { "": string };
        Returns: unknown;
      };
      st_polygonfromtext: {
        Args: { "": string };
        Returns: unknown;
      };
      st_polygonfromwkb: {
        Args: { "": string };
        Returns: unknown;
      };
      st_polygonize: {
        Args: { "": unknown[] };
        Returns: unknown;
      };
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown };
        Returns: unknown;
      };
      st_quantizecoordinates: {
        Args: {
          g: unknown;
          prec_m?: number;
          prec_x: number;
          prec_y?: number;
          prec_z?: number;
        };
        Returns: unknown;
      };
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number };
        Returns: unknown;
      };
      st_relate: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: string;
      };
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number };
        Returns: unknown;
      };
      st_reverse: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number };
        Returns: unknown;
      };
      st_setsrid: {
        Args: { geog: unknown; srid: number } | { geom: unknown; srid: number };
        Returns: unknown;
      };
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_shiftlongitude: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number };
        Returns: unknown;
      };
      st_split: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_square: {
        Args: {
          cell_i: number;
          cell_j: number;
          origin?: unknown;
          size: number;
        };
        Returns: unknown;
      };
      st_squaregrid: {
        Args: { bounds: unknown; size: number };
        Returns: Record<string, unknown>[];
      };
      st_srid: {
        Args: { geog: unknown } | { geom: unknown };
        Returns: number;
      };
      st_startpoint: {
        Args: { "": unknown };
        Returns: unknown;
      };
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number };
        Returns: unknown[];
      };
      st_summary: {
        Args: { "": unknown } | { "": unknown };
        Returns: string;
      };
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown };
        Returns: unknown;
      };
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number };
        Returns: unknown;
      };
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_tileenvelope: {
        Args: {
          bounds?: unknown;
          margin?: number;
          x: number;
          y: number;
          zoom: number;
        };
        Returns: unknown;
      };
      st_touches: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      st_transform: {
        Args:
          | { from_proj: string; geom: unknown; to_proj: string }
          | { from_proj: string; geom: unknown; to_srid: number }
          | { geom: unknown; to_proj: string };
        Returns: unknown;
      };
      st_triangulatepolygon: {
        Args: { g1: unknown };
        Returns: unknown;
      };
      st_union: {
        Args:
          | { "": unknown[] }
          | { geom1: unknown; geom2: unknown }
          | { geom1: unknown; geom2: unknown; gridsize: number };
        Returns: unknown;
      };
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number };
        Returns: unknown;
      };
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number };
        Returns: unknown;
      };
      st_within: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      st_wkbtosql: {
        Args: { wkb: string };
        Returns: unknown;
      };
      st_wkttosql: {
        Args: { "": string };
        Returns: unknown;
      };
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number };
        Returns: unknown;
      };
      st_x: {
        Args: { "": unknown };
        Returns: number;
      };
      st_xmax: {
        Args: { "": unknown };
        Returns: number;
      };
      st_xmin: {
        Args: { "": unknown };
        Returns: number;
      };
      st_y: {
        Args: { "": unknown };
        Returns: number;
      };
      st_ymax: {
        Args: { "": unknown };
        Returns: number;
      };
      st_ymin: {
        Args: { "": unknown };
        Returns: number;
      };
      st_z: {
        Args: { "": unknown };
        Returns: number;
      };
      st_zmax: {
        Args: { "": unknown };
        Returns: number;
      };
      st_zmflag: {
        Args: { "": unknown };
        Returns: number;
      };
      st_zmin: {
        Args: { "": unknown };
        Returns: number;
      };
      suggest_optimal_tables: {
        Args: {
          p_end_time: string;
          p_party_size: number;
          p_restaurant_id: string;
          p_start_time: string;
        };
        Returns: {
          requires_combination: boolean;
          table_ids: string[];
          total_capacity: number;
        }[];
      };
      text: {
        Args: { "": unknown };
        Returns: string;
      };
      toggle_favorite: {
        Args: { restaurant_id: string };
        Returns: undefined;
      };
      unlockrows: {
        Args: { "": string };
        Returns: number;
      };
      update_all_customer_statistics: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      update_booking_statuses: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      update_playlist_positions: {
        Args: { updates: Json };
        Returns: undefined;
      };
      update_restaurant_availability: {
        Args: {
          p_date: string;
          p_party_size: number;
          p_restaurant_id: string;
          p_time_slot: string;
        };
        Returns: undefined;
      };
      update_user_rating: {
        Args: {
          p_booking_id?: string;
          p_change_reason?: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      updategeometrysrid: {
        Args: {
          catalogn_name: string;
          column_name: string;
          new_srid_in: number;
          schema_name: string;
          table_name: string;
        };
        Returns: string;
      };
      use_loyalty_redemption: {
        Args: {
          p_booking_id?: string;
          p_redemption_id: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      use_user_offer: {
        Args: {
          p_booking_id?: string;
          p_redemption_code: string;
          p_user_id: string;
        };
        Returns: {
          message: string;
          offer_details: Json;
          success: boolean;
        }[];
      };
      validate_booking_acceptance: {
        Args: { p_booking_id: string; p_table_ids: string[] };
        Returns: Json;
      };
      validate_table_combination: {
        Args: { p_table_ids: string[] };
        Returns: {
          is_valid: boolean;
          message: string;
          total_capacity: number;
        }[];
      };
      verify_customer_statistics: {
        Args: { p_restaurant_id?: string };
        Returns: {
          actual_cancelled: number;
          actual_no_shows: number;
          actual_total_bookings: number;
          customer_id: string;
          customer_name: string;
          needs_update: boolean;
          stored_cancelled: number;
          stored_no_shows: number;
          stored_total_bookings: number;
        }[];
      };
    };
    Enums: {
      notification_type:
        | "booking_confirmation"
        | "booking_reminder"
        | "waiting_list_available"
        | "promotional_offer"
        | "admin_message";
      table_type:
        | "any"
        | "booth"
        | "window"
        | "patio"
        | "standard"
        | "bar"
        | "private";
      waiting_status: "active" | "notified" | "booked" | "expired";
    };
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null;
        geom: unknown | null;
      };
      valid_detail: {
        valid: boolean | null;
        reason: string | null;
        location: unknown | null;
      };
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      notification_type: [
        "booking_confirmation",
        "booking_reminder",
        "waiting_list_available",
        "promotional_offer",
        "admin_message",
      ],
      table_type: [
        "any",
        "booth",
        "window",
        "patio",
        "standard",
        "bar",
        "private",
      ],
      waiting_status: ["active", "notified", "booked", "expired"],
    },
  },
} as const;
