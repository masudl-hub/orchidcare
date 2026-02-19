// Shared external API tool implementations (Perplexity, Lovable/Maps)

import type { StoreSearchResult, StoreVerification } from "./types.ts";

// Helper to parse distance strings for sorting
export function parseDistance(distStr: string | undefined): number {
  if (!distStr) return 999;
  const match = distStr.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 999;
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
  LOVABLE_API_KEY: string,
  PERPLEXITY_API_KEY?: string,
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

    const storeTypePriority =
      storeType === "any"
        ? "Prioritize: local nurseries and garden centers first, then hardware stores like Home Depot or Lowe's."
        : `Focus on: ${storeType === "nursery" ? "local plant nurseries" : storeType === "garden_center" ? "garden centers" : "hardware stores with garden sections"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a plant shopping assistant with Google Maps access. Find stores selling plant supplies.

${storeTypePriority}

CRITICAL RULES:
1. ONLY include address information that Google Maps grounding EXPLICITLY provides
2. DO NOT fabricate or guess addresses from your training data
3. If Maps only shows a business exists in an area but no exact address, set address to null
4. Include the neighborhood/area name for each store

REQUIREMENTS:
- Find stores within 10 miles of the user's location
- Return FULL store names with location identifiers (e.g., "Ace Hardware - Fremont", "Home Depot - Northgate")
- Include distance and drive time from Maps grounding
- Assess likelihood of stocking the requested product
- RANK results by distance (closest first)

Return ONLY valid JSON:
{
  "stores": [
    {
      "fullName": "Store Name - Location (e.g., 'Swansons Nursery - Ballard')",
      "name": "Store Name",
      "neighborhood": "Neighborhood or area (e.g., 'Ballard', 'Fremont')",
      "type": "nursery|garden_center|hardware_store",
      "distance": "1.2 miles (from Maps grounding)",
      "driveTime": "5 min (from Maps grounding)",
      "address": "ONLY include if Maps grounding provides the exact address, otherwise null",
      "phone": "only if Maps provides",
      "reasoning": "why this is a good choice for this product",
      "likelyHasProduct": true/false,
      "productNotes": "specific details about why they might carry it"
    }
  ],
  "searchedFor": "the product queried",
  "location": "the search location"
}`,
          },
          {
            role: "user",
            content: `Find places near ${userLocation} where I can buy ${productQuery}`,
          },
        ],
        tools: [
          {
            type: "google_maps",
          },
        ],
        tool_config: {
          google_maps: {
            location_bias: {
              place: userLocation,
            },
          },
        },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[MapsAgent] API error:", response.status, errorText);
      return { success: false, error: `Store search failed: ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Extract grounding metadata - this contains the REAL data from Maps
    const groundingMetadata = data.groundingMetadata;
    const groundingChunks = groundingMetadata?.groundingChunks || [];
    const searchEntryPoint = groundingMetadata?.searchEntryPoint;

    console.log(`[MapsAgent] Grounding metadata present: ${!!groundingMetadata}`);
    console.log(`[MapsAgent] Grounding chunks: ${groundingChunks.length}`);
    if (groundingChunks.length > 0) {
      console.log(`[MapsAgent] Sample grounding chunk:`, JSON.stringify(groundingChunks[0], null, 2));
    }

    // Parse JSON from model response
    let result: StoreSearchResult;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      // Fallback
      result = {
        stores: [],
        searchedFor: productQuery,
        location: userLocation,
        callAheadAdvice:
          "Unable to find specific stores. Try searching online for 'nurseries near me' or check your local hardware store's garden section.",
      };
    }

    // Enhance stores with grounding data if available
    if (result.stores && result.stores.length > 0 && groundingChunks.length > 0) {
      console.log(
        `[MapsAgent] Matching ${result.stores.length} stores with ${groundingChunks.length} grounding chunks`,
      );

      for (const store of result.stores) {
        // Try to match store with grounding chunk by name
        const matchingChunk = groundingChunks.find((chunk: any) => {
          const chunkTitle = (chunk.title || chunk.web?.title || "").toLowerCase();
          const storeName = (store.name || store.fullName || "").toLowerCase();
          return chunkTitle.includes(storeName) || storeName.includes(chunkTitle);
        });

        if (matchingChunk) {
          console.log(`[MapsAgent] Found grounding match for ${store.name}:`, matchingChunk);
          // Extract verified data from grounding
          store.placeId = matchingChunk.placeId || matchingChunk.web?.placeId;
          store.mapsUri = matchingChunk.uri || matchingChunk.web?.uri;
          // Only use address from grounding if it looks like a real address
          if (matchingChunk.address && matchingChunk.address.match(/^\d+/)) {
            store.address = matchingChunk.address;
            store.addressVerified = true;
          }
        }

        // Mark address verification status
        store.addressVerified = store.addressVerified || false;
      }
    }

    // For stores without verified addresses, use Perplexity to look them up
    if (PERPLEXITY_API_KEY && result.stores) {
      const unverifiedStores = result.stores.filter((s) => !s.addressVerified && s.name);

      if (unverifiedStores.length > 0) {
        console.log(`[MapsAgent] Verifying ${unverifiedStores.length} unverified store addresses via Perplexity`);

        // Verify addresses in parallel (limit to 3 to avoid rate limits)
        const verifyPromises = unverifiedStores.slice(0, 3).map(async (store) => {
          const cityMatch = userLocation.match(/(\d{5})|([A-Za-z\s]+,?\s*[A-Z]{2})/);
          const city = cityMatch ? cityMatch[0] : userLocation;

          const verified = await verifyStoreAddress(
            store.fullName || store.name,
            store.neighborhood || "",
            city,
            PERPLEXITY_API_KEY,
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

    // Sort stores by distance (closest first)
    if (result.stores && result.stores.length > 1) {
      result.stores.sort((a, b) => parseDistance(a.distance) - parseDistance(b.distance));
      console.log(`[MapsAgent] Sorted ${result.stores.length} stores by distance`);
    }

    // Log final store data
    console.log(
      `[MapsAgent] Final stores:`,
      result.stores?.map((s) => ({
        name: s.fullName || s.name,
        address: s.address,
        verified: s.addressVerified,
        distance: s.distance,
      })),
    );

    console.log(`[MapsAgent] Found ${result.stores?.length || 0} stores`);

    // Agentic handling: If no stores found, provide explicit guidance for fallback
    if (!result.stores || result.stores.length === 0) {
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

    return { success: true, data: result };
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
