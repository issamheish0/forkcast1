// app/legal/[documentType].tsx
import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Alert,
  Share,
  Linking,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  Share2,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  FileText,
  Shield,
  Cookie,
  Users,
  Database,
  Calendar,
  AlertCircle,
} from "lucide-react-native";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, P, Muted } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";
import {
  getLegalDocument,
  LegalDocumentType,
  LegalSection,
  LEGAL_DOCUMENTS,
} from "@/constants/legalDocuments";
import { formatDateToDDMMYYYY } from "@/utils/birthday";

interface LegalDocumentInfo {
  icon: any;
  color: string;
  description: string;
}

const DOCUMENT_INFO: Record<LegalDocumentType, LegalDocumentInfo> = {
  PRIVACY_POLICY: {
    icon: Shield,
    color: "#3b82f6",
    description: "How we collect, use, and protect your personal information",
  },
  TERMS_OF_SERVICE: {
    icon: FileText,
    color: "#059669",
    description: "Rules and guidelines for using our service",
  },
  COOKIE_POLICY: {
    icon: Cookie,
    color: "#dc2626",
    description: "How we use cookies and similar technologies",
  },
  COMMUNITY_GUIDELINES: {
    icon: Users,
    color: "#7c3aed",
    description: "Standards for respectful community interaction",
  },
  DATA_PROCESSING_AGREEMENT: {
    icon: FileText,
    color: "#f59e0b",
    description:
      "Agreement between ForkCast and restaurant partners for data processing",
  },
  DATA_PROTECTION_POLICY: {
    icon: Database,
    color: "#ea580c",
    description: "Our commitment to data protection and security",
  },
};

export default function LegalDocumentScreen() {
  const { documentType } = useLocalSearchParams<{ documentType: string }>();
  const { colorScheme } = useColorScheme();
  const router = useRouter();

  // State for expanded sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(),
  );

  // Get the document data
  const document = useMemo(() => {
    if (!documentType || !(documentType as LegalDocumentType)) {
      return null;
    }
    try {
      return getLegalDocument(documentType as LegalDocumentType);
    } catch (error) {
      console.error("Error loading legal document:", error);
      return null;
    }
  }, [documentType]);

  const documentInfo = useMemo(() => {
    if (!documentType || !(documentType as LegalDocumentType)) {
      return null;
    }
    return DOCUMENT_INFO[documentType as LegalDocumentType];
  }, [documentType]);

  // Toggle section expansion
  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, []);

  // Expand all sections
  const expandAllSections = useCallback(() => {
    if (!document) return;
    const allSectionIds = new Set<string>();

    const addSectionIds = (sections: LegalSection[]) => {
      sections.forEach((section) => {
        allSectionIds.add(section.id);
        if (section.subsections) {
          addSectionIds(section.subsections);
        }
      });
    };

    addSectionIds(document.sections);
    setExpandedSections(allSectionIds);
  }, [document]);

  // Collapse all sections
  const collapseAllSections = useCallback(() => {
    setExpandedSections(new Set());
  }, []);

  // Share document
  const shareDocument = useCallback(async () => {
    if (!document) return;

    try {
      await Share.share({
        message: `Check out the ${document.title} from ForkCast`,
        url: `https://plate-app.com/legal/${documentType}`,
        title: document.title,
      });
    } catch (error) {
      console.error("Error sharing document:", error);
      Alert.alert("Error", "Could not share document");
    }
  }, [document, documentType]);

  // Open external link
  const openExternalLink = useCallback(async () => {
    if (!documentType) return;

    try {
      const url = `https://plate-app.com/legal/${documentType}`;
      await Linking.openURL(url);
    } catch (error) {
      console.error("Error opening external link:", error);
      Alert.alert("Error", "Could not open external link");
    }
  }, [documentType]);

  // Download document (placeholder)
  const downloadDocument = useCallback(() => {
    Alert.alert(
      "Download Document",
      "Document download feature will be available soon. You can share this document for now.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Share Instead", onPress: shareDocument },
      ],
    );
  }, [shareDocument]);

  // Render subsection
  const renderSubsection = useCallback(
    (subsection: LegalSection, level: number = 0) => {
      const isExpanded = expandedSections.has(subsection.id);
      const indentClass = level > 0 ? "ml-4" : "";

      return (
        <View key={subsection.id} className={`mb-3 ${indentClass}`}>
          <Pressable
            onPress={() => toggleSection(subsection.id)}
            className="flex-row items-center justify-between p-3 bg-card rounded-lg border border-border"
          >
            <View className="flex-1">
              <Text className="font-medium text-foreground">
                {subsection.title}
              </Text>
            </View>
            <View
              className={`transform ${isExpanded ? "rotate-180" : "rotate-0"}`}
            >
              <ChevronDown size={20} color="#666" />
            </View>
          </Pressable>

          {isExpanded && (
            <View className="mt-3 p-4 bg-muted/50 rounded-lg">
              <Text className="text-foreground leading-6 whitespace-pre-line">
                {subsection.content}
              </Text>

              {subsection.subsections && subsection.subsections.length > 0 && (
                <View className="mt-4">
                  {subsection.subsections.map((sub) =>
                    renderSubsection(sub, level + 1),
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      );
    },
    [expandedSections, toggleSection],
  );

  // Render main section
  const renderSection = useCallback(
    (section: LegalSection) => {
      const isExpanded = expandedSections.has(section.id);

      return (
        <View key={section.id} className="mb-4">
          <Pressable
            onPress={() => toggleSection(section.id)}
            className="flex-row items-center justify-between p-4 bg-card rounded-xl border border-border"
          >
            <View className="flex-1">
              <H3 className="mb-1">{section.title}</H3>
            </View>
            <View
              className={`transform ${isExpanded ? "rotate-180" : "rotate-0"}`}
            >
              <ChevronDown size={24} color="#666" />
            </View>
          </Pressable>

          {isExpanded && (
            <View className="mt-3 p-4 bg-background rounded-lg border border-border">
              <Text className="text-foreground leading-6 mb-4 whitespace-pre-line">
                {section.content}
              </Text>

              {section.subsections && section.subsections.length > 0 && (
                <View>
                  {section.subsections.map((subsection) =>
                    renderSubsection(subsection),
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      );
    },
    [expandedSections, toggleSection, renderSubsection],
  );

  // Show error if document not found
  if (!document || !documentInfo) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Pressable onPress={() => router.back()} className="p-2 -ml-2">
            <ArrowLeft
              size={24}
              color={colorScheme === "dark" ? "#fff" : "#000"}
            />
          </Pressable>
          <H2>Legal Document</H2>
          <View className="w-10" />
        </View>

        <View className="flex-1 items-center justify-center px-8">
          <AlertCircle size={64} color="#ef4444" strokeWidth={1} />
          <H2 className="mt-6 text-center">Document Not Found</H2>
          <P className="mt-3 text-center text-muted-foreground">
            The requested legal document could not be found. Please try again or
            contact support if the problem persists.
          </P>
          <Button
            variant="outline"
            className="mt-6"
            onPress={() => router.back()}
          >
            <Text>Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="border-b border-border">
        <View className="flex-row items-center justify-between px-4 py-3">
          <Pressable onPress={() => router.back()} className="p-2 -ml-2">
            <ArrowLeft
              size={24}
              color={colorScheme === "dark" ? "#fff" : "#000"}
            />
          </Pressable>
          <View className="flex-1 items-center">
            <Text className="font-semibold text-lg">{document.title}</Text>
          </View>
          <Pressable onPress={shareDocument} className="p-2 -mr-2">
            <Share2
              size={24}
              color={colorScheme === "dark" ? "#fff" : "#000"}
            />
          </Pressable>
        </View>

        {/* Document info */}
        <View className="px-4 pb-4">
          <View className="flex-row items-center gap-3 mb-3">
            <View
              className="w-12 h-12 rounded-full items-center justify-center"
              style={{ backgroundColor: `${documentInfo.color}20` }}
            >
              <documentInfo.icon size={24} color={documentInfo.color} />
            </View>
            <View className="flex-1">
              <Text className="text-sm text-muted-foreground">
                {documentInfo.description}
              </Text>
              <View className="flex-row items-center gap-4 mt-1">
                <Text className="text-xs text-muted-foreground">
                  Version {document.version}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Updated {formatDateToDDMMYYYY(new Date(document.lastUpdated))}
                </Text>
              </View>
            </View>
          </View>

          {/* Action buttons */}
          <View className="flex-row gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onPress={expandAllSections}
            >
              <Text className="text-sm">Expand All</Text>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onPress={collapseAllSections}
            >
              <Text className="text-sm">Collapse All</Text>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onPress={downloadDocument}
              className="px-3"
            >
              <Download
                size={16}
                color={colorScheme === "dark" ? "#fff" : "#000"}
              />
            </Button>
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Effective date notice */}
        <View className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 dark:bg-blue-950 dark:border-blue-800">
          <View className="flex-row items-center gap-2 mb-2">
            <Calendar size={16} color="#3b82f6" />
            <Text className="font-medium text-blue-900 dark:text-blue-100">
              Effective Date
            </Text>
          </View>
          <Text className="text-sm text-blue-800 dark:text-blue-200">
            This document is effective from{" "}
            {formatDateToDDMMYYYY(new Date(document.effectiveDate))}. By
            continuing to use our service, you agree to these terms.
          </Text>
        </View>

        {/* Document sections */}
        {document.sections.map(renderSection)}

        {/* Footer */}
        <View className="mt-8 pt-6 border-t border-border">
          <Text className="text-center text-sm text-muted-foreground mb-4">
            Have questions about this document?
          </Text>

          <View className="flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onPress={() => {
                Alert.alert(
                  "Contact Support",
                  "You can reach us at legal@plate-app.com or through the Help section in your profile.",
                );
              }}
            >
              <Text className="text-sm">Contact Support</Text>
            </Button>
            <Button
              variant="outline"
              onPress={openExternalLink}
              className="px-4"
            >
              <ExternalLink
                size={16}
                color={colorScheme === "dark" ? "#fff" : "#000"}
              />
            </Button>
          </View>
        </View>

        {/* Bottom spacing */}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
