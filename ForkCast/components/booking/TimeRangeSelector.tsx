import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Modal,
  ActivityIndicator,
  Alert,
  TouchableWithoutFeedback,
} from "react-native";
import {
  Clock,
  Search,
  X,
  Calendar,
  Users,
  MapPin,
  ChevronDown,
  ChevronUp,
  Timer,
  Info,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { H3, Muted } from "@/components/ui/typography";
import { Table, TableOption } from "@/lib/AvailabilityService";
import {
  WaitlistConfirmationModal,
  WaitlistEntry,
} from "./WaitlistConfirmationModal";
import { useWaitlist } from "@/hooks/useWaitlist";
import { useAuth } from "@/context/supabase-provider";
import { formatDateShort } from "@/utils/birthday";

// Table type definitions with user-friendly labels
export const TABLE_TYPES = {
  any: { label: "Any", icon: "🍽️", description: "No preference" },
  indoor: { label: "Indoor", icon: "🏠", description: "Indoor dining area" },
  outdoor: {
    label: "Outdoor",
    icon: "🌿",
    description: "Outdoor/patio dining",
  },
  bar: { label: "Bar", icon: "🍷", description: "Bar counter seating" },
  private: { label: "Private", icon: "🔒", description: "Private dining room" },
  standard: { label: "Standard", icon: "🪑", description: "Standard table" },
  booth: { label: "Booth", icon: "🛋️", description: "Cozy enclosed seating" },
  window: { label: "Window", icon: "🪟", description: "Tables with a view" },
  patio: { label: "Patio", icon: "🌿", description: "Outdoor patio" },
} as const;

// Database table_type enum values
export type TableType = "any" | "indoor" | "outdoor" | "bar" | "private" | "standard" | "booth" | "window" | "patio";

export interface TimeRange {
  startTime: string;
  endTime: string;
}

export interface TimeRangeSearchParams {
  timeRange: TimeRange;
  partySize: number;
  date: Date;
}

export interface TimeRangeResult {
  timeSlot: string;
  tables: Table[];
  tableOptions: TableOption[];
  allTableTypes: TableType[]; // All table types available in this slot
  totalCapacity: number;
  requiresCombination: boolean;
  isWaitlistTime?: boolean; // Indicates if this is a scheduled waitlist time slot for basic tier restaurants
}

interface TimeRangeSelectorProps {
  visible: boolean;
  onClose: () => void;
  onSearch: (params: TimeRangeSearchParams) => Promise<TimeRangeResult[]>;
  onSelectResult: (result: TimeRangeResult) => void;
  initialPartySize: number;
  selectedDate: Date;
  restaurantName: string;
  restaurantId: string;
  loading?: boolean;
}

// Time options for the range selector
const TIME_OPTIONS = [
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
  "22:00",
  "22:30",
];

const TimeSelector = React.memo<{
  label: string;
  value: string;
  onSelect: (time: string) => void;
  options: string[];
  minTime?: string;
  onExpandedChange?: (expanded: boolean) => void;
}>(({ label, value, onSelect, options, minTime, onExpandedChange }) => {
  const [expanded, setExpanded] = useState(false);

  const availableOptions = useMemo(() => {
    if (!minTime) return options;
    return options.filter((time) => time > minTime);
  }, [options, minTime]);

  const handleToggleExpanded = useCallback(() => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    onExpandedChange?.(newExpanded);
  }, [expanded, onExpandedChange]);

  const handleSelect = useCallback(
    (time: string) => {
      onSelect(time);
      setExpanded(false);
      onExpandedChange?.(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [onSelect, onExpandedChange],
  );

  // Close dropdown when component receives signal
  useEffect(() => {
    if (onExpandedChange && !expanded) {
      setExpanded(false);
    }
  }, [expanded, onExpandedChange]);

  return (
    <View className="flex-1" style={{ zIndex: expanded ? 9999 : 1 }}>
      <Text className="text-sm font-medium mb-2 text-muted-foreground">
        {label}
      </Text>
      <View className="relative" style={{ zIndex: expanded ? 9999 : 1 }}>
        <Pressable
          onPress={handleToggleExpanded}
          className="bg-card border border-border rounded-lg p-3 flex-row items-center justify-between"
        >
          <Text className="font-medium">{value}</Text>
          {expanded ? (
            <ChevronUp size={16} color="#666" />
          ) : (
            <ChevronDown size={16} color="#666" />
          )}
        </Pressable>

        {expanded && (
          <View
            className="absolute left-0 right-0 bg-card border border-border rounded-lg mt-1 shadow-lg"
            style={{
              top: "100%",
              zIndex: 99999,
              elevation: 50, // Maximum elevation for Android
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.5,
              shadowRadius: 12,
              backgroundColor: "white", // Ensure solid background
            }}
          >
            <ScrollView
              style={{ maxHeight: 160 }}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
              bounces={false}
              scrollEventThrottle={16}
              contentContainerStyle={{ backgroundColor: "white" }}
            >
              {availableOptions.map((time, index) => (
                <Pressable
                  key={time}
                  onPress={() => handleSelect(time)}
                  className={`p-3 ${
                    index < availableOptions.length - 1
                      ? "border-b border-border/50"
                      : ""
                  } ${time === value ? "bg-primary/10" : "bg-white"}`}
                  style={{ minHeight: 44 }}
                >
                  <Text
                    className={`${time === value ? "text-primary font-medium" : ""}`}
                  >
                    {time}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );
});

TimeSelector.displayName = "TimeSelector";

const TableTypeSelector = React.memo<{
  selectedTypes: TableType[];
  onToggleType: (type: TableType) => void;
  searchResults?: TimeRangeResult[]; // Add search results to show counts
}>(({ selectedTypes, onToggleType, searchResults = [] }) => {
  // Calculate how many time slots have each table type
  const getTableTypeCount = useCallback(
    (type: TableType) => {
      return searchResults.filter((result) =>
        result.allTableTypes.includes(type),
      ).length;
    },
    [searchResults],
  );

  return (
    <View>
      <Text className="text-sm font-medium mb-3 text-muted-foreground">
        Table Types{" "}
        {selectedTypes.length > 0
          ? `(${selectedTypes.length} selected)`
          : "(optional)"}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {(Object.keys(TABLE_TYPES) as TableType[]).map((type) => {
          const isSelected = selectedTypes.includes(type);
          const typeInfo = TABLE_TYPES[type];
          const availableCount = getTableTypeCount(type);
          const hasResults = searchResults.length > 0;
          const isAvailable = !hasResults || availableCount > 0;

          return (
            <Pressable
              key={type}
              onPress={() => {
                onToggleType(type);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              disabled={hasResults && !isAvailable} // Disable if searched and no results
              className={`flex-row items-center gap-2 px-3 py-2 rounded-full border ${
                isSelected
                  ? "bg-primary border-primary"
                  : isAvailable
                    ? "bg-card border-border"
                    : "bg-muted border-border opacity-50"
              }`}
            >
              <Text className="text-sm">{typeInfo.icon}</Text>
              <Text
                className={`text-sm font-medium ${
                  isSelected
                    ? "text-primary-foreground"
                    : isAvailable
                      ? "text-foreground"
                      : "text-muted-foreground"
                }`}
              >
                {typeInfo.label}
                {hasResults && (
                  <Text className="text-xs ml-1">({availableCount})</Text>
                )}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Muted className="text-xs mt-2">
        {selectedTypes.length > 0
          ? `Filtering by: ${selectedTypes.map((type) => TABLE_TYPES[type].label).join(", ")}`
          : searchResults.length > 0
            ? "Select table types to filter results instantly"
            : "Leave empty to see all table types"}
      </Muted>
    </View>
  );
});

TableTypeSelector.displayName = "TableTypeSelector";

const PartySizeSelector = React.memo<{
  selectedSize: number;
  onSizeChange: (size: number) => void;
  maxSize?: number;
  onExpandedChange?: (expanded: boolean) => void;
}>(({ selectedSize, onSizeChange, maxSize = 12, onExpandedChange }) => {
  const [expanded, setExpanded] = useState(false);

  const sizeOptions = useMemo(
    () => Array.from({ length: maxSize }, (_, i) => i + 1),
    [maxSize],
  );

  const handleToggleExpanded = useCallback(() => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    onExpandedChange?.(newExpanded);
  }, [expanded, onExpandedChange]);

  const handleSizeChange = useCallback(
    (size: number) => {
      onSizeChange(size);
      setExpanded(false);
      onExpandedChange?.(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [onSizeChange, onExpandedChange],
  );

  // Close dropdown when component receives signal
  useEffect(() => {
    if (onExpandedChange && !expanded) {
      setExpanded(false);
    }
  }, [expanded, onExpandedChange]);

  return (
    <View style={{ zIndex: expanded ? 9998 : 1 }}>
      <Text className="text-sm font-medium mb-2 text-muted-foreground">
        Party Size
      </Text>
      <View className="relative" style={{ zIndex: expanded ? 9998 : 1 }}>
        <Pressable
          onPress={handleToggleExpanded}
          className="bg-card border border-border rounded-lg p-3 flex-row items-center justify-between"
        >
          <View className="flex-row items-center gap-2">
            <Users size={16} color="#666" />
            <Text className="font-medium">
              {selectedSize} {selectedSize === 1 ? "guest" : "guests"}
            </Text>
          </View>
          {expanded ? (
            <ChevronUp size={16} color="#666" />
          ) : (
            <ChevronDown size={16} color="#666" />
          )}
        </Pressable>

        {expanded && (
          <View
            className="absolute left-0 right-0 bg-card border border-border rounded-lg mt-1 shadow-lg"
            style={{
              top: "100%",
              zIndex: 99998,
              elevation: 45,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.5,
              shadowRadius: 12,
              backgroundColor: "white", // Ensure solid background
            }}
          >
            <ScrollView
              style={{ maxHeight: 160 }}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
              bounces={false}
              scrollEventThrottle={16}
              contentContainerStyle={{ backgroundColor: "white" }}
            >
              {sizeOptions.map((size, index) => (
                <Pressable
                  key={size}
                  onPress={() => handleSizeChange(size)}
                  className={`p-3 ${
                    index < sizeOptions.length - 1
                      ? "border-b border-border/50"
                      : ""
                  } flex-row items-center gap-2 ${
                    size === selectedSize ? "bg-primary/10" : "bg-white"
                  }`}
                  style={{ minHeight: 44 }}
                >
                  <Users
                    size={14}
                    color={size === selectedSize ? "#3b82f6" : "#666"}
                  />
                  <Text
                    className={`${size === selectedSize ? "text-primary font-medium" : ""}`}
                  >
                    {size} {size === 1 ? "guest" : "guests"}
                  </Text>
                  {size > 8 && (
                    <Text className="text-xs text-amber-600 ml-auto">
                      Large party
                    </Text>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );
});

PartySizeSelector.displayName = "PartySizeSelector";

const SearchResultCard = React.memo<{
  result: TimeRangeResult;
  onSelect: () => void;
  partySize: number;
}>(({ result, onSelect, partySize }) => {
  const primaryOption = result.tableOptions[0];
  const hasMultipleOptions = result.tableOptions.length > 1;

  return (
    <Pressable
      onPress={onSelect}
      className={`bg-card rounded-xl p-4 mb-3 ${
        result.isWaitlistTime
          ? "border-2 border-amber-200 dark:border-amber-800"
          : "border border-border"
      }`}
    >
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-2">
          <Clock
            size={16}
            color={result.isWaitlistTime ? "#f59e0b" : "#3b82f6"}
          />
          <Text className="font-bold text-lg">{result.timeSlot}</Text>
          {result.requiresCombination && (
            <View className="bg-amber-100 dark:bg-amber-900/30 rounded-full px-2 py-1">
              <Text className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                Combined
              </Text>
            </View>
          )}
          {result.isWaitlistTime && (
            <View className="bg-amber-100 dark:bg-amber-900/30 rounded-full px-2 py-1">
              <Text className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                Waitlist
              </Text>
            </View>
          )}
        </View>
        {result.isWaitlistTime ? (
          <View className="bg-amber-100 dark:bg-amber-900/30 rounded-full px-2 py-1">
            <Text className="text-xs text-amber-700 dark:text-amber-300 font-bold">
              Join Waitlist
            </Text>
          </View>
        ) : (
          <View className="bg-green-100 dark:bg-green-900/30 rounded-full px-2 py-1">
            <Text className="text-xs text-green-700 dark:text-green-300 font-bold">
              Available
            </Text>
          </View>
        )}
      </View>

      <View className="flex-row items-center gap-4 mb-3">
        <View className="flex-row items-center gap-1">
          <Users size={14} color="#666" />
          <Text className="text-sm text-muted-foreground">
            Seats {result.totalCapacity}
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <MapPin size={14} color="#666" />
          <Text className="text-sm text-muted-foreground">
            {result.tables.length} table{result.tables.length > 1 ? "s" : ""}
          </Text>
        </View>
        {/* Show ALL table types available, not just matching ones */}
        {primaryOption && primaryOption.tableTypes.length > 0 && (
          <View className="flex-row items-center gap-1">
            <Text className="text-sm text-muted-foreground">
              {result.allTableTypes
                .map((type) => TABLE_TYPES[type as TableType]?.icon || "🪑")
                .join(" ")}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {result.allTableTypes
                .map((type) => TABLE_TYPES[type as TableType]?.label || type)
                .join(", ")}
            </Text>
          </View>
        )}
      </View>

      {primaryOption && (
        <View className="bg-muted/30 rounded-lg p-2">
          <Text className="font-medium text-sm mb-1">
            {primaryOption.experienceTitle}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {primaryOption.experienceDescription}
          </Text>
          {hasMultipleOptions && (
            <Text className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              +{result.tableOptions.length - 1} more seating option
              {result.tableOptions.length > 2 ? "s" : ""}
            </Text>
          )}
        </View>
      )}

      {result.isWaitlistTime && (
        <View className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mt-3">
          <View className="flex-row items-center gap-2 mb-1">
            <Timer size={14} color="#f59e0b" />
            <Text className="font-medium text-sm text-amber-800 dark:text-amber-200">
              Scheduled Waitlist Time
            </Text>
          </View>
          <Text className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            This restaurant offers waitlist slots during peak hours. You&apos;ll
            be automatically notified when a table becomes available during your
            selected time.
          </Text>
        </View>
      )}
    </Pressable>
  );
});

SearchResultCard.displayName = "SearchResultCard";

export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  visible,
  onClose,
  onSearch,
  onSelectResult,
  initialPartySize,
  selectedDate,
  restaurantName,
  restaurantId,
  loading = false,
}) => {
  const { user } = useAuth();
  const { joinWaitlist } = useWaitlist();

  // State management
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("20:00");
  const [partySize, setPartySize] = useState(initialPartySize);
  const [selectedTableTypes, setSelectedTableTypes] = useState<TableType[]>([]);
  const [allSearchResults, setAllSearchResults] = useState<TimeRangeResult[]>(
    [],
  ); // Store all results
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [anyDropdownExpanded, setAnyDropdownExpanded] = useState(false);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);

  // Filtered results based on selected table types
  const filteredResults = useMemo(() => {
    if (selectedTableTypes.length === 0) {
      return allSearchResults; // Show all if no filters selected
    }

    return allSearchResults.filter((result) =>
      // Show result if ANY of the available table types match selected filters
      result.allTableTypes.some((type) => selectedTableTypes.includes(type)),
    );
  }, [allSearchResults, selectedTableTypes]);

  // Validation
  const isValidTimeRange = useMemo(() => {
    return startTime < endTime;
  }, [startTime, endTime]);

  // Reset state when modal opens
  const handleModalOpen = useCallback(() => {
    if (visible) {
      setAllSearchResults([]);
      setHasSearched(false);
      setSearching(false);
      setPartySize(initialPartySize); // Reset to initial party size
    }
  }, [visible, initialPartySize]);

  React.useEffect(handleModalOpen, [handleModalOpen]);

  // Handlers
  const handleTableTypeToggle = useCallback((type: TableType) => {
    setSelectedTableTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }, []);

  const handleDropdownExpandedChange = useCallback((expanded: boolean) => {
    setAnyDropdownExpanded(expanded);
  }, []);

  const handleCloseAllDropdowns = useCallback(() => {
    if (anyDropdownExpanded) {
      setAnyDropdownExpanded(false);
      // Force re-render to close all dropdowns
      setTimeout(() => setAnyDropdownExpanded(false), 50);
    }
  }, [anyDropdownExpanded]);

  const handleSearch = useCallback(async () => {
    if (!isValidTimeRange) {
      Alert.alert("Invalid Time Range", "End time must be after start time");
      return;
    }

    setSearching(true);
    setHasSearched(false);

    try {
      const results = await onSearch({
        timeRange: { startTime, endTime },
        partySize,
        date: selectedDate,
      });

      setAllSearchResults(results);
      setHasSearched(true);

      if (results.length === 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Time range search error:", error);
      Alert.alert(
        "Search Error",
        "Failed to search for available times. Please try again.",
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSearching(false);
    }
  }, [isValidTimeRange, startTime, endTime, partySize, selectedDate, onSearch]);

  const handleSelectResult = useCallback(
    (result: TimeRangeResult) => {
      onSelectResult(result);
      onClose();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    [onSelectResult, onClose],
  );

  const handleJoinWaitlist = useCallback(() => {
    // Direct check for user instead of relying on canJoinWaitlist
    if (!user) {
      Alert.alert(
        "Authentication Required",
        "Please sign in to join the waitlist",
      );
      return;
    }
    setShowWaitlistModal(true);
  }, [user]);

  const handleWaitlistConfirm = useCallback(
    async (entry: WaitlistEntry) => {
      try {
        await joinWaitlist(entry);
        Alert.alert(
          "Added to Waitlist",
          "We'll notify you if a table becomes available during your preferred time.",
          [{ text: "OK", onPress: onClose }],
        );
      } catch (error) {
        // Error already handled in the hook
        throw error;
      }
    },
    [joinWaitlist, onClose],
  );

  const formatDate = useCallback((date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return formatDateShort(date);
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <View className="flex-1">
            <H3>Time Range Search</H3>
            <Muted numberOfLines={1}>{restaurantName}</Muted>
          </View>
          <Pressable onPress={onClose} className="p-2 -mr-2">
            <X size={24} color="#666" />
          </Pressable>
        </View>

        {/* Search Context */}
        <View className="bg-muted/30 p-4 border-b border-border">
          <View className="flex-row items-center gap-4">
            <View className="flex-row items-center gap-2">
              <Calendar size={16} color="#666" />
              <Text className="font-medium">{formatDate(selectedDate)}</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Search size={16} color="#666" />
              <Text className="font-medium">Advanced Search</Text>
            </View>
          </View>
        </View>

        <TouchableWithoutFeedback onPress={handleCloseAllDropdowns}>
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={!anyDropdownExpanded}
            style={{ zIndex: 1 }}
          >
            <View
              className="p-4 gap-6"
              style={{ zIndex: anyDropdownExpanded ? 1000 : 1 }}
            >
              {/* Party Size Selection */}
              <PartySizeSelector
                selectedSize={partySize}
                onSizeChange={setPartySize}
                maxSize={12}
                onExpandedChange={handleDropdownExpandedChange}
              />

              {/* Time Range Selection */}
              <View style={{ zIndex: anyDropdownExpanded ? 5000 : 1 }}>
                <Text className="font-semibold text-lg mb-3">
                  Select Time Range
                </Text>
                <View className="flex-row gap-3">
                  <TimeSelector
                    label="From"
                    value={startTime}
                    onSelect={setStartTime}
                    options={TIME_OPTIONS}
                    onExpandedChange={handleDropdownExpandedChange}
                  />
                  <TimeSelector
                    label="To"
                    value={endTime}
                    onSelect={setEndTime}
                    options={TIME_OPTIONS}
                    minTime={startTime}
                    onExpandedChange={handleDropdownExpandedChange}
                  />
                </View>
                {!isValidTimeRange && (
                  <Text className="text-red-500 text-sm mt-2">
                    End time must be after start time
                  </Text>
                )}
              </View>

              {/* Table Type Selection */}
              <TableTypeSelector
                selectedTypes={selectedTableTypes}
                onToggleType={handleTableTypeToggle}
                searchResults={allSearchResults}
              />

              {/* Educational Note about Waitlist Times */}
              <View className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <View className="flex-row items-center gap-2 mb-2">
                  <Info size={16} color="#3b82f6" />
                  <Text className="font-medium text-blue-800 dark:text-blue-200">
                    About Scheduled Waitlist Times
                  </Text>
                </View>
                <Text className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                  Some restaurants offer waitlist-only time slots during peak
                  hours. These appear in amber and automatically add you to the
                  waitlist with priority notifications when tables become
                  available.
                </Text>
              </View>

              {/* Search Button */}
              <Button
                onPress={handleSearch}
                disabled={!isValidTimeRange || searching}
                className="flex-row items-center justify-center gap-2"
              >
                {searching ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Search size={16} color="white" />
                )}
                <Text className="text-primary-foreground font-medium">
                  {searching ? "Searching..." : "Search Available Times"}
                </Text>
              </Button>

              {/* Search Results */}
              {hasSearched && (
                <View>
                  <View className="flex-row items-center justify-between mb-4">
                    <Text className="font-semibold text-lg">
                      Search Results
                    </Text>
                    <View className="flex-row items-center gap-2">
                      {/* Clear Filters Button */}
                      {selectedTableTypes.length > 0 && (
                        <Pressable
                          onPress={() => setSelectedTableTypes([])}
                          className="bg-muted rounded-full px-3 py-1 mr-2"
                        >
                          <Text className="text-muted-foreground font-medium text-sm">
                            Clear filters
                          </Text>
                        </Pressable>
                      )}
                      <View className="bg-primary/10 rounded-full px-3 py-1">
                        <Text className="text-primary font-bold text-sm">
                          {filteredResults.length} found
                          {selectedTableTypes.length > 0 &&
                            allSearchResults.length !==
                              filteredResults.length && (
                              <Text className="text-muted-foreground">
                                {" "}
                                of {allSearchResults.length}
                              </Text>
                            )}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {filteredResults.length === 0 ? (
                    <View className="bg-muted/30 rounded-xl p-6 items-center">
                      <Timer size={32} color="#666" className="mb-3" />
                      <Text className="font-medium text-center mb-2">
                        {selectedTableTypes.length > 0
                          ? `No tables available for selected table types in this time range`
                          : `No tables available in this time range`}
                      </Text>
                      <Text className="text-sm text-muted-foreground text-center mb-4">
                        {selectedTableTypes.length > 0
                          ? `Try removing some table type filters or adjusting your time range`
                          : `Try adjusting your time range or join the waitlist to be notified`}
                      </Text>

                      {/* Join Waitlist Button - only show if no filters applied and no results from original search */}
                      {selectedTableTypes.length === 0 &&
                        allSearchResults.length === 0 && (
                          <Button
                            onPress={handleJoinWaitlist}
                            className="flex-row items-center justify-center gap-2 mt-2"
                            variant="outline"
                          >
                            <Users size={16} color="#3b82f6" />
                            <Text className="text-primary font-medium">
                              Join Waitlist
                            </Text>
                          </Button>
                        )}
                    </View>
                  ) : (
                    <View>
                      {filteredResults.map(
                        (result: TimeRangeResult, index: number) => (
                          <SearchResultCard
                            key={`${result.timeSlot}-${index}`}
                            result={result}
                            onSelect={() => handleSelectResult(result)}
                            partySize={partySize}
                          />
                        ),
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </View>

      {/* Waitlist Confirmation Modal */}
      <WaitlistConfirmationModal
        visible={showWaitlistModal}
        onClose={() => setShowWaitlistModal(false)}
        onConfirm={handleWaitlistConfirm}
        searchParams={{
          timeRange: { startTime, endTime },
          partySize,
          date: selectedDate,
        }}
        restaurantId={restaurantId}
        restaurantName={restaurantName}
        userId={user?.id || ""}
      />
    </Modal>
  );
};
