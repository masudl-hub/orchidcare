// Shared type definitions for orchid-agent and call-session

export interface HierarchicalContext {
  recentMessages: any[];
  summaries: any[];
  userInsights: any[];
  recentIdentifications: any[];
  activeReminders: any[];
}

export interface PlantResolutionResult {
  plants: any[];
  isBulk: boolean;
  filter?: { type: "all" | "location" | "species"; value?: string };
  error?: string;
}

export interface StoreRecommendation {
  name: string;
  fullName?: string;
  type: string;
  distance?: string;
  driveTime?: string;
  address?: string;
  phone?: string;
  reasoning: string;
  likelyHasProduct: boolean;
  productNotes?: string;
  placeId?: string;
  mapsUri?: string;
  addressVerified: boolean;
  neighborhood?: string;
}

export interface StoreSearchResult {
  stores: StoreRecommendation[];
  searchedFor: string;
  location: string;
  callAheadAdvice?: string;
  noResultsReason?: string;
  suggestedAction?: string;
  onlineAlternatives?: string;
}

export interface StoreVerification {
  storeName: string;
  product: string;
  availability: "likely_in_stock" | "call_ahead" | "probably_not" | "unknown";
  confidence: "high" | "medium" | "low";
  department?: string;
  brands?: string[];
  priceRange?: string;
  notes: string;
  source?: string;
  alternatives?: string[];
}
