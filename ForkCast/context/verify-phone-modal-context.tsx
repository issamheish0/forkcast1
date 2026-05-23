import React, { createContext, useContext, useCallback } from "react";

type VerifyPhoneModalContextType = {
  openVerifyPhoneModal: () => void;
};

const VerifyPhoneModalContext =
  createContext<VerifyPhoneModalContextType | null>(null);

export function VerifyPhoneModalProvider({
  children,
  openVerifyPhoneModal,
}: {
  children: React.ReactNode;
  openVerifyPhoneModal: () => void;
}) {
  const value = React.useMemo(
    () => ({ openVerifyPhoneModal }),
    [openVerifyPhoneModal],
  );
  return (
    <VerifyPhoneModalContext.Provider value={value}>
      {children}
    </VerifyPhoneModalContext.Provider>
  );
}

export function useVerifyPhoneModal(): VerifyPhoneModalContextType {
  const ctx = useContext(VerifyPhoneModalContext);
  if (ctx == null) {
    return {
      openVerifyPhoneModal: () => {},
    };
  }
  return ctx;
}
