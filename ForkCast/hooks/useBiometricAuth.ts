import * as LocalAuthentication from "expo-local-authentication";

export const useBiometricAuth = () => {
  const authenticate = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return {
        success: false,
        error: "Biometric authentication not available",
      };
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) {
      return { success: false, error: "No biometrics enrolled" };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Authenticate to confirm booking",
    });

    return result;
  };

  return { authenticate };
};
