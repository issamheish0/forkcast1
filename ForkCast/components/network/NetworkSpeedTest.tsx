import React, { useState } from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import { Zap, Download, Clock } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { useNetwork } from "@/context/network-provider";
import { useColorScheme } from "@/lib/useColorScheme";

interface NetworkSpeedTestProps {
  onTestComplete?: (results: {
    downloadSpeed: number;
    latency: number;
    quality: string;
  }) => void;
}

export function NetworkSpeedTest({ onTestComplete }: NetworkSpeedTestProps) {
  const { testConnectionSpeed, isOnline } = useNetwork();
  const { colorScheme } = useColorScheme();
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<{
    downloadSpeed: number;
    latency: number;
    quality: string;
  } | null>(null);

  const runSpeedTest = async () => {
    if (!isOnline || testing) return;

    setTesting(true);
    setResults(null);

    try {
      const testResults = await testConnectionSpeed!();
      setResults(testResults);
      onTestComplete?.(testResults);
    } catch (error) {
      console.error("Speed test failed:", error);
    } finally {
      setTesting(false);
    }
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case "excellent":
        return "text-green-600 dark:text-green-400";
      case "good":
        return "text-blue-600 dark:text-blue-400";
      case "fair":
        return "text-yellow-600 dark:text-yellow-400";
      case "poor":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  return (
    <View className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <Zap size={20} color={colorScheme === "dark" ? "#fff" : "#000"} />
          <Text className="font-semibold ml-2">Connection Speed Test</Text>
        </View>

        <Button
          onPress={runSpeedTest}
          disabled={!isOnline || testing}
          size="sm"
          variant="outline"
        >
          {testing ? (
            <ActivityIndicator size="small" />
          ) : (
            <Text className="text-sm">Test Speed</Text>
          )}
        </Button>
      </View>

      {results && (
        <View className="space-y-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Download
                size={16}
                color={colorScheme === "dark" ? "#fff" : "#000"}
              />
              <Text className="ml-2 text-gray-600 dark:text-gray-400">
                Download Speed
              </Text>
            </View>
            <Text className="font-semibold">
              {results.downloadSpeed.toFixed(2)} Mbps
            </Text>
          </View>

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Clock
                size={16}
                color={colorScheme === "dark" ? "#fff" : "#000"}
              />
              <Text className="ml-2 text-gray-600 dark:text-gray-400">
                Latency
              </Text>
            </View>
            <Text className="font-semibold">{results.latency}ms</Text>
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="text-gray-600 dark:text-gray-400">Quality</Text>
            <Text
              className={`font-semibold capitalize ${getQualityColor(results.quality)}`}
            >
              {results.quality}
            </Text>
          </View>
        </View>
      )}

      {!isOnline && (
        <View className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
          <Text className="text-red-600 dark:text-red-400 text-center">
            No internet connection available
          </Text>
        </View>
      )}
    </View>
  );
}
