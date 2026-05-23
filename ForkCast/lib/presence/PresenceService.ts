// Stub: Presence service — not implemented in ForkCastApp
export const PresenceService = {
  join: async (_channelName: string, _userId: string) => {},
  leave: async () => {},
  track: async (_userId: string, _data?: any) => {},
  untrack: async () => {},
  onPresenceSync: (_callback: (presences: any[]) => void) => () => {},
};
