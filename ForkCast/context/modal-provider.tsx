// context/modal-provider.tsx
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";

interface ModalState {
  isAnyModalOpen: boolean;
  currentModal: string | null;
}

interface ModalContextType {
  modalState: ModalState;
  openModal: (modalId: string) => boolean;
  closeModal: (modalId: string) => void;
  closeAllModals: () => void;
  isModalOpen: (modalId: string) => boolean;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

interface ModalProviderProps {
  children: React.ReactNode;
}

export function ModalProvider({ children }: ModalProviderProps) {
  const [modalState, setModalState] = useState<ModalState>({
    isAnyModalOpen: false,
    currentModal: null,
  });

  const openModal = useCallback((modalId: string): boolean => {
    let wasOpened = false;
    setModalState((prev) => {
      // If any modal is already open, prevent opening another one
      if (prev.isAnyModalOpen) {
        return prev;
      }

      wasOpened = true;
      return {
        isAnyModalOpen: true,
        currentModal: modalId,
      };
    });

    return wasOpened;
  }, []);

  const closeModal = useCallback((modalId: string) => {
    setModalState((prev) => {
      if (prev.currentModal === modalId) {
        return {
          isAnyModalOpen: false,
          currentModal: null,
        };
      }
      return prev;
    });
  }, []);

  const closeAllModals = useCallback(() => {
    setModalState({
      isAnyModalOpen: false,
      currentModal: null,
    });
  }, []);

  const isModalOpen = useCallback(
    (modalId: string) => {
      return modalState.currentModal === modalId;
    },
    [modalState.currentModal],
  );

  const value = useMemo(
    () => ({
      modalState,
      openModal,
      closeModal,
      closeAllModals,
      isModalOpen,
    }),
    [modalState, openModal, closeModal, closeAllModals, isModalOpen],
  );

  return (
    <ModalContext.Provider value={value}>{children}</ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
}

// Hook specifically for navigation-based modals (like cuisine pages)
export function useNavigationModal() {
  const { openModal, closeModal, modalState } = useModal();
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const autoCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const openNavigationModal = useCallback(
    (modalId: string, navigationCallback: () => void) => {
      const wasOpened = openModal(modalId);

      if (wasOpened) {
        // Clear any existing timeouts
        if (navigationTimeoutRef.current) {
          clearTimeout(navigationTimeoutRef.current);
        }
        if (autoCloseTimeoutRef.current) {
          clearTimeout(autoCloseTimeoutRef.current);
        }

        // Execute navigation after a short delay to ensure modal state is set
        navigationTimeoutRef.current = setTimeout(() => {
          try {
            navigationCallback();

            // Auto-close modal after navigation completes (with a delay to allow page to load)
            autoCloseTimeoutRef.current = setTimeout(() => {
              closeModal(modalId);
            }, 1000); // Close after 1 second to allow page transition
          } catch (error) {
            console.error("Navigation error:", error);
            // Close modal if navigation fails
            closeModal(modalId);
          }
        }, 50);
      }

      return wasOpened;
    },
    [openModal, closeModal],
  );

  const closeNavigationModal = useCallback(
    (modalId: string) => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
        navigationTimeoutRef.current = null;
      }
      if (autoCloseTimeoutRef.current) {
        clearTimeout(autoCloseTimeoutRef.current);
        autoCloseTimeoutRef.current = null;
      }
      closeModal(modalId);
    },
    [closeModal],
  );

  return {
    openNavigationModal,
    closeNavigationModal,
    isAnyModalOpen: modalState.isAnyModalOpen,
  };
}
