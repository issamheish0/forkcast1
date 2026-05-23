import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { InvitationNotification } from "./InvitationNotification";
import { BookingInvitation } from "@/hooks/useBookingInvitations";

export const NotificationManager = React.memo(() => {
  const { profile } = useAuth();
  const [currentInvitation, setCurrentInvitation] =
    useState<BookingInvitation | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [processedInvitations, setProcessedInvitations] = useState<Set<string>>(
    new Set(),
  );

  const handleNewInvitation = useCallback(
    (invitation: BookingInvitation) => {
      // Only show notifications for pending invitations we haven't seen yet
      if (
        invitation.status === "pending" &&
        !processedInvitations.has(invitation.id)
      ) {
        setCurrentInvitation(invitation);
        setShowNotification(true);
        setProcessedInvitations((prev) => new Set(prev).add(invitation.id));
      }
    },
    [processedInvitations],
  );

  const handleCloseNotification = useCallback(() => {
    setShowNotification(false);
    setTimeout(() => setCurrentInvitation(null), 300); // Wait for animation
  }, []);

  const handleNotificationResponse = useCallback(() => {
    // Refresh any relevant data after user responds to invitation
    // This could trigger refetches in other components
  }, []);

  useEffect(() => {
    if (!profile?.id) return;

    // Set up real-time subscription for new invitations
    const newInvitationsChannel = supabase
      .channel("new_invitations_notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "booking_invites",
          filter: `to_user_id=eq.${profile.id}`,
        },
        async (payload) => {
          // Fetch the complete invitation data with relations
          const { data: invitation, error } = await supabase
            .from("booking_invites")
            .select(
              `
              *,
              booking:bookings(
                id,
                booking_time,
                party_size,
                status,
                restaurant:restaurants(
                  id,
                  name,
                  main_image_url,
                  address
                )
              ),
              from_user:from_user_id(
                id,
                full_name,
                avatar_url
              )
            `,
            )
            .eq("id", payload.new.id)
            .single();

          if (!error && invitation) {
            handleNewInvitation(invitation as BookingInvitation);
          }
        },
      )
      .subscribe();

    // Also listen for invitation status updates (acceptances, declines)
    const statusUpdateChannel = supabase
      .channel("invitation_status_updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "booking_invites",
          filter: `from_user_id=eq.${profile.id}`,
        },
        (payload) => {
          // Could show notification to sender that their invitation was accepted/declined
          // For now, we'll just log it
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(newInvitationsChannel);
      supabase.removeChannel(statusUpdateChannel);
    };
  }, [profile?.id, handleNewInvitation]);

  return (
    <InvitationNotification
      visible={showNotification}
      invitation={currentInvitation}
      onClose={handleCloseNotification}
      onResponse={handleNotificationResponse}
    />
  );
});
