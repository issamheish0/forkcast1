// components/booking/BookingTableInfo.tsx
import React from "react";
import { View } from "react-native";
import { TableIcon, Users, Combine } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { getTableTypeDisplayName } from "@/lib/tableManagementUtils";

interface TableInfo {
  id: string;
  table_number: string;
  table_type: string;
  capacity: number;
}

interface BookingTableInfoProps {
  tables: TableInfo[];
  partySize: number;
  loading?: boolean;
}

export const BookingTableInfo: React.FC<BookingTableInfoProps> = ({
  tables,
  partySize,
  loading = false,
}) => {
  if (loading) {
    return (
      <View className="p-4 border-b border-border">
        <Text className="text-lg font-bold mb-3">Table Assignment</Text>
        <View className="bg-muted/30 rounded-lg p-4">
          <Text className="text-muted-foreground">
            Loading table information...
          </Text>
        </View>
      </View>
    );
  }

  if (tables.length === 0) {
    return (
      <View className="p-4 border-b border-border">
        <Text className="text-lg font-bold mb-3">Table Assignment</Text>
        <View className="bg-muted/30 rounded-lg p-4">
          <View className="flex-row items-center gap-2">
            <TableIcon size={20} color="#666" />
            <Text className="text-muted-foreground">
              Table assignment pending
            </Text>
          </View>
          <Text className="text-sm text-muted-foreground mt-2">
            The restaurant will assign your table closer to your booking time
          </Text>
        </View>
      </View>
    );
  }

  const isCombined = tables.length > 1;
  const totalCapacity = tables.reduce(
    (sum, table) => sum + (table.capacity || 0),
    0,
  );

  const formatTableNumbers = (tables: TableInfo[]) => {
    return tables
      .map((t) => t.table_number || `Table ${t.id.slice(0, 6)}`)
      .join(" + ");
  };

  return (
    <View className="p-4 border-b border-border">
      <Text className="text-lg font-bold mb-3">Table Assignment</Text>

      {isCombined ? (
        <View className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <View className="flex-row items-center gap-2 mb-3">
            <Combine size={20} color="#3b82f6" />
            <Text className="font-semibold text-blue-800 dark:text-blue-200">
              Combined Tables Arrangement
            </Text>
          </View>

          <View className="space-y-2">
            {tables.map((table, index) => (
              <View
                key={table.id}
                className="flex-row items-center justify-between"
              >
                <View className="flex-row items-center gap-2">
                  <TableIcon size={16} color="#666" />
                  <Text className="font-medium">
                    {table.table_number || `Table ${index + 1}`}
                  </Text>
                </View>
                <Text className="text-sm text-muted-foreground">
                  {`${getTableTypeDisplayName(table.table_type || "standard")} • Seats ${table.capacity || 0}`}
                </Text>
              </View>
            ))}
          </View>

          <View className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Users size={16} color="#3b82f6" />
                <Text className="font-medium text-blue-800 dark:text-blue-200">
                  Total Capacity
                </Text>
              </View>
              <Text className="font-semibold text-blue-800 dark:text-blue-200">
                {`${totalCapacity} seats for ${partySize} guests`}
              </Text>
            </View>
          </View>

          <Text className="text-xs text-blue-700 dark:text-blue-300 mt-3">
            These tables will be arranged together for your party
          </Text>
        </View>
      ) : tables.length > 0 ? (
        <View className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-2">
              <TableIcon size={20} color="#10b981" />
              <Text className="font-semibold text-green-800 dark:text-green-200">
                {tables[0].table_number || "Assigned Table"}
              </Text>
            </View>
            <View className="bg-green-200 dark:bg-green-800 rounded-full px-3 py-1">
              <Text className="text-green-800 dark:text-green-200 text-sm font-medium">
                {getTableTypeDisplayName(tables[0].table_type || "standard")}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-green-700 dark:text-green-300">
              {`Capacity: ${tables[0].capacity || 0} seats`}
            </Text>
            <Text className="text-sm text-green-700 dark:text-green-300">
              {`Party size: ${partySize}`}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
};
