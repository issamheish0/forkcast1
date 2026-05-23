import React from "react";
import { View, Dimensions } from "react-native";
import { BarChart } from "react-native-chart-kit";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Award,
  Star,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { H3, P } from "@/components/ui/typography";
import { UserRating } from "./UserRating";
import { cn } from "@/lib/utils";

interface UserRatingStatsProps {
  stats: {
    current_rating: number;
    total_bookings: number;
    completed_bookings: number;
    cancelled_bookings: number;
    no_show_bookings: number;
    completion_rate: number;
    reliability_score: string;
    rating_trend: string;
  };
  className?: string;
}

const { width: screenWidth } = Dimensions.get("window");

export function UserRatingStats({ stats, className }: UserRatingStatsProps) {
  const chartData = {
    labels: ["Completed", "Cancelled", "No Show"],
    datasets: [
      {
        data: [
          stats.completed_bookings,
          stats.cancelled_bookings,
          stats.no_show_bookings,
        ],
      },
    ],
  };

  const chartConfig = {
    backgroundGradientFrom: "#ffffff",
    backgroundGradientTo: "#ffffff",
    color: (opacity = 1) => `rgba(121, 35, 57, ${opacity})`, // Mulberry Velvet
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
  };

  const getCompletionRateColor = (rate: number): string => {
    if (rate >= 90) return "text-primary"; // Golden Crust for excellent
    if (rate >= 80) return "text-accent"; // Lavender Fog for good
    if (rate >= 70) return "text-muted-foreground"; // Charcoal Mood for fair
    if (rate >= 60) return "text-foreground"; // Mulberry Velvet for poor
    return "text-destructive"; // Keep destructive for very poor
  };

  const getTrendColor = (trend: string): string => {
    switch (trend.toLowerCase()) {
      case "improving":
        return "text-green-600";
      case "declining":
        return "text-red-600";
      case "stable":
        return "text-blue-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <View className={cn("bg-card rounded-xl p-4", className)}>
      <H3 className="mb-4">Booking Reliability Score</H3>

      {/* Main Rating Display */}
      <View className="items-center mb-6 p-4 bg-muted rounded-lg">
        <UserRating
          rating={stats.current_rating}
          size="lg"
          showNumber={true}
          showLabel={false}
        />
        <Text className="text-lg font-bold mt-2 text-primary">
          {stats.reliability_score}
        </Text>
        <Text
          className={cn(
            "text-sm font-medium",
            getTrendColor(stats.rating_trend),
          )}
        >
          {stats.rating_trend === "new"
            ? "New User"
            : `${stats.rating_trend} Trend`}
        </Text>
      </View>

      {/* Key Stats */}
      <View className="grid grid-cols-2 gap-4 mb-6">
        <View className="bg-background rounded-lg p-3">
          <View className="flex-row items-center gap-2 mb-1">
            <CheckCircle size={16} color="#10b981" />
            <Text className="text-sm font-medium">Completion Rate</Text>
          </View>
          <Text
            className={cn(
              "text-lg font-bold",
              getCompletionRateColor(stats.completion_rate),
            )}
          >
            {stats.completion_rate.toFixed(1)}%
          </Text>
        </View>

        <View className="bg-background rounded-lg p-3">
          <View className="flex-row items-center gap-2 mb-1">
            <Award size={16} color="#3b82f6" />
            <Text className="text-sm font-medium">Total Bookings</Text>
          </View>
          <Text className="text-lg font-bold text-primary">
            {stats.total_bookings}
          </Text>
        </View>
      </View>

      {/* Booking Breakdown */}
      {stats.total_bookings > 0 && (
        <View className="mb-4">
          <Text className="font-medium mb-3">Booking History</Text>

          <View className="space-y-2">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <CheckCircle size={16} color="#10b981" />
                <Text className="text-sm">Completed</Text>
              </View>
              <Text className="font-medium text-green-600">
                {stats.completed_bookings}
              </Text>
            </View>

            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <XCircle size={16} color="#6b7280" />
                <Text className="text-sm">Cancelled</Text>
              </View>
              <Text className="font-medium text-gray-600">
                {stats.cancelled_bookings}
              </Text>
            </View>

            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <AlertTriangle size={16} color="#ef4444" />
                <Text className="text-sm">No Show</Text>
              </View>
              <Text className="font-medium text-red-600">
                {stats.no_show_bookings}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Visual Chart */}
      {stats.total_bookings > 0 && (
        <View className="mt-4">
          <Text className="font-medium mb-2">Booking Distribution</Text>
          <BarChart
            data={chartData}
            width={screenWidth - 80}
            height={160}
            chartConfig={chartConfig}
            style={{
              marginVertical: 8,
              borderRadius: 8,
            }}
            yAxisSuffix=""
            showValuesOnTopOfBars={true}
            yAxisLabel={""}
          />
        </View>
      )}

      {/* Tips for Improvement */}
      {stats.current_rating < 4.0 && (
        <View className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <Text className="font-medium text-blue-800 mb-2">
            💡 Tips to Improve Your Rating
          </Text>
          <Text className="text-blue-700 text-sm">
            • Always show up for confirmed bookings{"\n"}• Cancel bookings at
            least 24 hours in advance{"\n"}• Communicate with restaurants if
            plans change{"\n"}• Complete your dining experiences
          </Text>
        </View>
      )}
    </View>
  );
}
