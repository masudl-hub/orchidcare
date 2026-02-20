// Shared external API tool implementations (Perplexity, Gemini Maps Grounding)

import { GoogleGenAI } from "npm:@google/genai";
import type { StoreSearchResult, StoreVerification } from "./types.ts";

// Helper to parse distance strings for sorting
export function parseDistance(distStr: string | undefined): number {
  if (!distStr) return 999;
  const match = distStr.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 999;
}

// Geocode a location string (ZIP, city, address) to lat/lng using OpenStreetMap Nominatim
export async function geocodeLocation(
  locationStr: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    console.log(`[Geocode] Resolving coordinates for: "${locationStr}"`);
    const encoded = encodeURIComponent(locationStr);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
      {
        headers: {
          "User-Agent": "OrchidCareApp/1.0 (plant-care-assistant)",
        },
      },
    );

    if (!response.ok) {
      console.error(`[Geocode] Nominatim error: ${response.status}`);
      return null;
    }

    const results = await response.json();
    if (results.length === 0) {
      console.log(`[Geocode] No results for "${locationStr}"`);
      return null;
    }

    const lat = parseFloat(results[0].lat);
    const lng = parseFloat(results[0].lon);
    console.log(`[Geocode] Resolved "${locationStr}" -> ${lat}, ${lng}`);
    return { lat, lng };
  } catch (error) {
    console.error("[Geocode] Error:", error);
    return null;
  }
}

export async function callResearchAgent(
  query: string,
  PERPLEXITY_API_KEY: string,
): Promise<{ success: boolean; data?: string; citations?: string[]; error?: string }> {
  try {
    console.log(`Calling Perplexity for research: "${query}"`);
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content:
              "You are a plant care research assistant. Provide concise, accurate information. Focus on practical advice. Include any relevant recent developments or updates in plant care science.",
          },
          { role: "user", content: query },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Perplexity error:", response.status, errorText);
      return { success: false, error: `Research failed: ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";
    const citations = data.citations || [];

    console.log("Research result:", content.substring(0, 200) + "...");
    return { success: true, data: content, citations };
  } catch (error) {
    console.error("Research agent error:", error);
    return { success: false, error: String(error) };
  }
}

// Verify store addresses via Perplexity when Maps grounding doesn't provide them
export async function verifyStoreAddress(
  storeName: string,
  neighborhood: string,
  city: string,
  PERPLEXITY_API_KEY: string,
): Promise<{ address: string | null; phone: string | null; verified: boolean }> {
  try {
    console.log(`[AddressVerify] Looking up address for: ${storeName} in ${neighborhood}, ${city}`);

    const query = `What is the exact street address and phone number for "${storeName}" in ${neighborhood}, ${city}? I need the precise address for navigation.`;

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: `You are looking up store addresses. Return ONLY valid JSON:
{
  "address": "Full street address with city, state, zip",
  "phone": "Phone number if found",
  "verified": true/false (true if you found the exact address)
}

If you cannot find the exact address, set verified to false.`,
          },
          { role: "user", content: query },
        ],
        search_recency_filter: "month",
      }),
    });

    if (!response.ok) {
      console.error("[AddressVerify] Perplexity error:", response.status);
      return { address: null, phone: null, verified: false };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
      console.log(`[AddressVerify] Result for ${storeName}:`, result);
      return {
        address: result.address || null,
        phone: result.phone || null,
        verified: result.verified === true,
      };
    } catch {
      console.error("[AddressVerify] Failed to parse response");
      return { address: null, phone: null, verified: false };
    }
  } catch (error) {
    console.error("[AddressVerify] Error:", error);
    return { address: null, phone: null, verified: false };
  }
}

export async function callMapsShoppingAgent(
  productQuery: string,
  storeType: string,
  userLocation: string | null,
  GEMINI_API_KEY: string,
  PERPLEXITY_API_KEY?: string,
  latLng?: { lat: number; lng: number },
): Promise<{ success: boolean; data?: StoreSearchResult; error?: string; promptForLocation?: boolean }> {
  try {
    // Check if user has location
    if (!userLocation) {
      console.log("[MapsAgent] No location available - prompting user");
      return {
        success: false,
        error: "NO_LOCATION",
        promptForLocation: true,
      };
    }

    console.log(`[MapsAgent] Finding stores for "${productQuery}" near ${userLocation}`);

    // Resolve coordinates: use provided lat/lng, or geocode the location string
    let coordinates = latLng || null;
    if (!coordinates) {
      console.log("[MapsAgent] No cached coordinates, geocoding location...");
      coordinates = await geocodeLocation(userLocation);
    }

    if (!coordinates) {
      console.warn("[MapsAgent] Could not geocode location, proceeding without coordinates");
    } else {
      console.log(`[MapsAgent] Using coordinates: ${coordinates.lat}, ${coordinates.lng}`);
    }

    const storeTypePriority =
      storeType === "any"
        ? "Prioritize: local nurseries and garden centers first, then hardware stores like Home Depot or Lowe's."
        : `Focus on: ${storeType === "nursery" ? "local plant nurseries" : storeType === "garden_center" ? "garden centers" : "hardware stores with garden sections"}`;

    const prompt = `Find places near ${userLocation} where I can buy ${productQuery}.

${storeTypePriority}

For each store found, provide:
- Full store name with location identifier (e.g., "Swansons Nursery - Ballard")
- Store type (nursery, garden_center, hardware_store)
- Distance and drive time if available
- Why this store is a good choice for this product
- Whether they likely carry the product`;

    // Call Gemini directly with Maps grounding
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const config: Record<string, any> = {
      tools: [{ googleMaps: {} }],
      temperature: 0.3,
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config,
    });

    const textContent = response.text || "";
    console.log(`[MapsAgent] Gemini response text (first 500):`, textContent.substring(0, 500));

    // Extract grounding metadata from the response
    const candidate = response.candidates?.[0];
    const groundingMetadata = candidate?.groundingMetadata;
    const groundingChunks = groundingMetadata?.groundingChunks || [];

    console.log(`[MapsAgent] Grounding metadata present: ${!!groundingMetadata}`);
    console.log(`[MapsAgent] Grounding chunks: ${groundingChunks.length}`);

    if (groundingChunks.length > 0) {
      console.log(`[MapsAgent] Sample grounding chunk:`, JSON.stringify(groundingChunks[0], null, 2));
    }

    // Build store results primarily from grounding chunks (verified Maps data)
    const stores: StoreSearchResult["stores"] = [];

    for (const chunk of groundingChunks) {
      // Maps grounding chunks have a "maps" property with place data
      const mapsData = (chunk as any).maps;
      if (!mapsData) continue;

      const storeName = mapsData.title || "Unknown Store";
      const mapsUri = mapsData.uri || null;
      const placeId = mapsData.placeId || null;

      stores.push({
        name: storeName,
        fullName: storeName,
        type: storeType === "any" ? "nursery" : storeType,
        address: mapsData.address || undefined,
        phone: mapsData.phoneNumber || undefined,
        reasoning: `Found via Google Maps grounding near ${userLocation}`,
        likelyHasProduct: true,
        placeId: placeId || undefined,
        mapsUri: mapsUri || undefined,
        addressVerified: true,
        neighborhood: mapsData.neighborhood || undefined,
      });
    }

    // If we got grounding chunks, try to enrich with details from the text response
    if (stores.length > 0) {
      console.log(`[MapsAgent] Built ${stores.length} stores from grounding chunks`);

      // Try to parse supplemental info from the text response
      try {
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.stores && Array.isArray(parsed.stores)) {
            // Enrich grounded stores with reasoning from parsed text
            for (const groundedStore of stores) {
              const textStore = parsed.stores.find((ts: any) => {
                const tsName = (ts.name || ts.fullName || "").toLowerCase();
                const gsName = groundedStore.name.toLowerCase();
                return tsName.includes(gsName) || gsName.includes(tsName);
              });
              if (textStore) {
                groundedStore.distance = textStore.distance || groundedStore.distance;
                groundedStore.driveTime = textStore.driveTime || groundedStore.driveTime;
                groundedStore.reasoning = textStore.reasoning || groundedStore.reasoning;
                groundedStore.likelyHasProduct = textStore.likelyHasProduct ?? groundedStore.likelyHasProduct;
                groundedStore.productNotes = textStore.productNotes || groundedStore.productNotes;
                groundedStore.type = textStore.type || groundedStore.type;
              }
            }
          }
        }
      } catch {
        console.log("[MapsAgent] Could not parse supplemental text JSON (non-critical)");
      }
    } else {
      // No grounding chunks -- fall back to parsing the text response
      console.log("[MapsAgent] No grounding chunks, falling back to text parsing");
      try {
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.stores && Array.isArray(parsed.stores)) {
            for (const s of parsed.stores) {
              stores.push({
                name: s.name || "Unknown",
                fullName: s.fullName || s.name || "Unknown",
                type: s.type || "nursery",
                distance: s.distance,
                driveTime: s.driveTime,
                address: s.address || undefined,
                phone: s.phone || undefined,
                reasoning: s.reasoning || "Found in search results",
                likelyHasProduct: s.likelyHasProduct ?? true,
                productNotes: s.productNotes,
                addressVerified: false,
                neighborhood: s.neighborhood,
              });
            }
          }
        }
      } catch {
        console.log("[MapsAgent] Could not parse text response as JSON");
      }
    }

    // For non-grounded stores without verified addresses, use Perplexity to look them up
    if (PERPLEXITY_API_KEY && stores.length > 0) {
      const unverifiedStores = stores.filter((s) => !s.addressVerified && s.name);

      if (unverifiedStores.length > 0) {
        console.log(`[MapsAgent] Verifying ${unverifiedStores.length} unverified store addresses via Perplexity`);

        const verifyPromises = unverifiedStores.slice(0, 3).map(async (store) => {
          const cityMatch = userLocation!.match(/(\d{5})|([A-Za-z\s]+,?\s*[A-Z]{2})/);
          const city = cityMatch ? cityMatch[0] : userLocation!;

          const verified = await verifyStoreAddress(
            store.fullName || store.name,
            store.neighborhood || "",
            city,
            PERPLEXITY_API_KEY!,
          );

          if (verified.verified && verified.address) {
            store.address = verified.address;
            store.addressVerified = true;
            if (verified.phone && !store.phone) {
              store.phone = verified.phone;
            }
          }
        });

        await Promise.all(verifyPromises);
      }
    }

    // Sort stores: grounded first, then by distance
    if (stores.length > 1) {
      stores.sort((a, b) => {
        // Grounded (verified) stores first
        if (a.addressVerified && !b.addressVerified) return -1;
        if (!a.addressVerified && b.addressVerified) return 1;
        return parseDistance(a.distance) - parseDistance(b.distance);
      });
      console.log(`[MapsAgent] Sorted ${stores.length} stores`);
    }

    // Log final store data
    console.log(
      `[MapsAgent] Final stores:`,
      stores.map((s) => ({
        name: s.fullName || s.name,
        address: s.address,
        verified: s.addressVerified,
        distance: s.distance,
        placeId: s.placeId,
        mapsUri: s.mapsUri,
      })),
    );

    console.log(`[MapsAgent] Found ${stores.length} stores`);

    // If no stores found, provide fallback guidance
    if (stores.length === 0) {
      return {
        success: true,
        data: {
          stores: [],
          searchedFor: productQuery,
          location: userLocation,
          noResultsReason: `No local stores found for "${productQuery}" near ${userLocation}. This might be a specialty item.`,
          suggestedAction: "research_online",
          callAheadAdvice: `Try searching online retailers (Amazon, specialty plant stores) or call local nurseries directly.`,
        },
      };
    }

    return {
      success: true,
      data: {
        stores,
        searchedFor: productQuery,
        location: userLocation,
      },
    };
  } catch (error) {
    console.error("[MapsAgent] Error:", error);
    return { success: false, error: String(error) };
  }
}

export async function verifyStoreInventory(
  storeName: string,
  product: string,
  location: string | null,
  PERPLEXITY_API_KEY: string,
): Promise<{ success: boolean; data?: StoreVerification; error?: string }> {
  try {
    console.log(`[StoreVerify] Checking ${storeName} for ${product}`);

    const query = `Does "${storeName}"${location ? ` in ${location}` : ""} sell ${product}?
Search for: ${storeName} ${product} inventory, recent customer reviews mentioning ${product}, ${storeName} garden section ${product}.
Be specific about availability, which department/aisle to find it, and specific brands if known.`;

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: `You are verifying store inventory for plant supplies. Be SPECIFIC and actionable.

Return ONLY valid JSON:
{
  "storeName": "full store name as provided",
  "product": "product searched",
  "availability": "likely_in_stock|call_ahead|probably_not|unknown",
  "confidence": "high|medium|low",
  "department": "which section/aisle if known (e.g., 'garden section near seeds', 'aisle 12')",
  "brands": ["specific brand names if known (e.g., 'Garden Safe TakeRoot', 'Bonide')"],
  "priceRange": "approximate price range if found",
  "notes": "brief actionable explanation with seasonal availability notes",
  "source": "where this info came from (reviews, store website, general knowledge)",
  "alternatives": ["alternative stores or products if not available"]
}`,
          },
          { role: "user", content: query },
        ],
        search_recency_filter: "month",
      }),
    });

    if (!response.ok) {
      console.error("[StoreVerify] Perplexity error:", response.status);
      return { success: false, error: `Verification failed: ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let verification: StoreVerification;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      verification = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      verification = {
        storeName,
        product,
        availability: "unknown",
        confidence: "low",
        notes: content || "Unable to verify. Recommend calling the store directly.",
      };
    }

    console.log(`[StoreVerify] Result: ${verification.availability} (${verification.confidence})`);
    return { success: true, data: verification };
  } catch (error) {
    console.error("[StoreVerify] Error:", error);
    return { success: false, error: String(error) };
  }
}
