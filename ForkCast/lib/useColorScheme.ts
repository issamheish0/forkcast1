import { useColorScheme as useNativewindColorScheme } from "nativewind";
import { useEffect, useMemo, useState } from "react";
import { Appearance } from "react-native";

type ColorScheme = "light" | "dark";

type NativeWindScheme = ReturnType<typeof useNativewindColorScheme>;

const resolveScheme = (
  scheme: NativeWindScheme["colorScheme"] | null | undefined,
  fallback: ColorScheme,
): ColorScheme => {
  if (scheme === "light" || scheme === "dark") {
    return scheme;
  }

  return fallback;
};

export function useColorScheme() {
  const nativeWindScheme = useNativewindColorScheme();
  const [fallbackScheme, setFallbackScheme] = useState<ColorScheme>(() => {
    const initial = Appearance.getColorScheme();
    return initial === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setFallbackScheme(colorScheme === "dark" ? "dark" : "light");
    });

    return () => subscription.remove();
  }, []);

  return useMemo(() => {
    const resolved = resolveScheme(
      nativeWindScheme?.colorScheme,
      fallbackScheme,
    );

    const safeSetColorScheme = (scheme: ColorScheme) => {
      if (nativeWindScheme?.setColorScheme) {
        nativeWindScheme.setColorScheme(scheme);
      }

      setFallbackScheme(scheme);
    };

    const safeToggleColorScheme = () => {
      if (nativeWindScheme?.toggleColorScheme) {
        nativeWindScheme.toggleColorScheme();
        const nextScheme = resolved === "dark" ? "light" : "dark";
        setFallbackScheme(nextScheme);
      } else {
        const nextScheme = resolved === "dark" ? "light" : "dark";
        setFallbackScheme(nextScheme);
      }
    };

    return {
      colorScheme: resolved,
      isDarkColorScheme: resolved === "dark",
      setColorScheme: safeSetColorScheme,
      toggleColorScheme: safeToggleColorScheme,
    };
  }, [nativeWindScheme, fallbackScheme]);
}
