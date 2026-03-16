// Agent tool definitions in OpenAI/Lovable format.
// Used by orchid-agent (text/image path via Lovable AI gateway).
// Voice path uses _shared/voiceTools.ts (Gemini Live format).
//
// IMPORTANT: When updating tool descriptions here, keep voiceTools.ts in sync.

// Agent Tools — spawn sub-LLM for complex analysis
export const agentTools = [
  {
    type: "function",
    function: {
      name: "identify_plant",
      description:
        "Identify plant species from user's photo. Call this when user sends a plant image and wants to know what it is.",
      parameters: {
        type: "object",
        properties: {
          user_context: { type: "string", description: "Any additional context from user's message" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "diagnose_plant",
      description:
        "Diagnose health issues from a plant photo. Call when user mentions problems (yellow leaves, wilting, spots, pests, etc.) or asks 'what's wrong'.",
      parameters: {
        type: "object",
        properties: {
          symptoms_described: { type: "string", description: "Symptoms mentioned by user" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_environment",
      description:
        "Analyze growing environment from a photo. Call when user asks about placement, light levels, or shows their plant's location.",
      parameters: {
        type: "object",
        properties: {
          plant_species: { type: "string", description: "Species if known, for tailored advice" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "research",
      description: `Search the web for current, accurate plant information. USE THIS TOOL WHEN:
- User asks about specific plant diseases, pests, or treatments
- You're less than 80% confident in your answer
- Topic involves products, brands, or availability
- Question relates to events or discoveries after January 2025
- User asks about pet toxicity (critical accuracy needed)
- Specific cultivar or hybrid questions
- User shares a URL and wants analysis, fact-checking, or product evaluation
- Verifying claims from external sources
DO NOT USE for basic care questions you're confident about.

TIP: If user shares a URL, include it in your query for context.`,
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query. Include any URLs the user shared for context." },
          focus: {
            type: "string",
            enum: ["general", "product", "toxicity", "article_analysis", "fact_check"],
            description: "Focus of the research to improve accuracy",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_visual_guide",
      description:
        "Generate step-by-step visual images to help user with plant care tasks. Use when user asks HOW to do something: propagation, repotting, pruning, treating pests, making soil mix, taking cuttings, etc. Creates 2-4 instructional images.",
      parameters: {
        type: "object",
        properties: {
          task: {
            type: "string",
            description:
              "The plant care task to illustrate (e.g., 'propagate pothos in water', 'repot root-bound monstera', 'prune leggy philodendron')",
          },
          plant_species: {
            type: "string",
            description: "The specific plant if known",
          },
          step_count: {
            type: "number",
            description: "Number of steps to generate (2-4 recommended). Default 3.",
          },
        },
        required: ["task"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_video",
      description:
        "Analyze a video sent by the user. Use when user sends a video showing their plant, watering routine, pest movement, growth progress, or any plant-related footage. Can reference specific timestamps.",
      parameters: {
        type: "object",
        properties: {
          analysis_focus: {
            type: "string",
            enum: ["general_assessment", "diagnose_problem", "evaluate_technique", "track_movement"],
            description:
              "What to focus on: general_assessment (overall health), diagnose_problem (find issues), evaluate_technique (critique their care method), track_movement (pest/growth tracking)",
          },
          specific_question: {
            type: "string",
            description: "Any specific question the user asked about the video",
          },
        },
        required: ["analysis_focus"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "transcribe_voice",
      description:
        "Transcribe and understand a voice note sent by the user. This is automatically called when user sends an audio message, but can also be manually triggered if needed.",
      parameters: {
        type: "object",
        properties: {
          context: {
            type: "string",
            description: "Any text context accompanying the voice note",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_stores",
      description: `Find SPECIFIC local stores for plant supplies. MUST be called when user asks WHERE to buy something.

Returns: Full store names with location identifiers, exact addresses, distances from user's location.

IMPORTANT: Call this BEFORE verify_store_inventory to get specific store details.`,
      parameters: {
        type: "object",
        properties: {
          product_query: {
            type: "string",
            description: "What the user is looking for (e.g., 'rooting powder', 'orchid bark', 'neem oil')",
          },
          store_type: {
            type: "string",
            enum: ["nursery", "garden_center", "hardware_store", "any"],
            description: "Type of store to prioritize. Default: any",
          },
          max_results: {
            type: "number",
            description: "Number of stores to return (default 3)",
          },
        },
        required: ["product_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "verify_store_inventory",
      description: `Verify if a SPECIFIC store (with location) carries a product. Call AFTER find_stores.

Returns: Stock status, confidence level, specific department/aisle, brand recommendations, and alternatives.

Use this to confirm availability before making strong recommendations.`,
      parameters: {
        type: "object",
        properties: {
          store_name: {
            type: "string",
            description:
              "FULL store name with location identifier (e.g., 'Ace Hardware - Fremont', 'Home Depot on Aurora Ave')",
          },
          product: {
            type: "string",
            description: "Product to verify availability for",
          },
          location: {
            type: "string",
            description: "City, neighborhood, or ZIP code",
          },
        },
        required: ["store_name", "product", "location"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_cached_stores",
      description: `Retrieve recently cached store search results (less than 24 hours old) for follow-up questions.

Use this INSTEAD of find_stores when:
- User asks for "more stores" / "other options" / "what else" for the SAME product
- User wants to compare stores from a previous search
- User asks about a store that was in the original results

Only call find_stores again if the product or location has CHANGED.`,
      parameters: {
        type: "object",
        properties: {
          product_query: {
            type: "string",
            description: "The product the user originally searched for (e.g., 'rooting hormone', 'orchid bark')",
          },
        },
        required: ["product_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_products",
      description: `Search for products online with real prices, images, ratings, and purchase links from Google Shopping.

Use when:
- User asks about product prices, comparisons, or "how much does X cost?"
- User wants to buy something online
- No local stores found and you want to show online alternatives
- User explicitly asks for online options

Returns: Product listings with real current prices, merchant names, ratings, images, and direct purchase links.`,
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Product search query — be specific for best results (e.g., 'orchid bark medium grade 4 quart' not just 'bark')",
          },
          max_results: {
            type: "number",
            description: "Maximum products to return (default 5, max 10)",
          },
        },
        required: ["query"],
      },
    },
  },
];

// Function Tools — direct database operations
export const functionTools = [
  {
    type: "function",
    function: {
      name: "save_plant",
      description:
        "Save a plant to user's collection for tracking. Use when user says 'save', 'add to collection', 'track', or 'remember this plant'. After saving, use the returned plant ID for subsequent operations on this plant.",
      parameters: {
        type: "object",
        properties: {
          species: { type: "string", description: "Plant species name" },
          nickname: { type: "string", description: "Optional nickname for the plant" },
          location: { type: "string", description: "Location in home if mentioned" },
          notes: { type: "string", description: "Any additional notes" },
        },
        required: ["species"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "modify_plant",
      description: `Update plant details. Supports BULK operations:
- Single plant: "my monstera" / "Planty" / plant nickname
- All plants: "all" / "all plants" / "all my plants"
- By location: "all plants in the bedroom" / "plants in the living room"
- By type: "all succulents" / "all ferns" / "all palms"

Use for updating nickname, location, or notes.`,
      parameters: {
        type: "object",
        properties: {
          plant_identifier: {
            type: "string",
            description: "Plant ID from context (preferred) or name/bulk pattern like 'all' or 'bedroom plants'",
          },
          updates: {
            type: "object",
            properties: {
              nickname: { type: "string" },
              location: { type: "string" },
              notes: { type: "string" },
            },
          },
        },
        required: ["plant_identifier"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_plant",
      description: `Remove plants from collection. Supports BULK operations:
- Single plant: "my monstera" / "Planty"
- All plants: "all plants" (DANGEROUS - requires confirmation!)
- By location: "all plants in the bedroom"
- By type: "all succulents"

CRITICAL: For bulk deletes, you MUST list what will be deleted and ask for explicit user confirmation BEFORE calling with user_confirmed=true.`,
      parameters: {
        type: "object",
        properties: {
          plant_identifier: {
            type: "string",
            description: "Plant ID from context (preferred) or name/bulk pattern",
          },
          user_confirmed: {
            type: "boolean",
            description: "Set to true ONLY after user explicitly confirms the deletion. Required for bulk deletes.",
          },
        },
        required: ["plant_identifier"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_reminder",
      description: `Set up care reminders. Supports BULK operations:
- Single plant: "my monstera" / "Planty"
- All plants: "all" / "all plants"
- By location: "all plants in the bedroom"
- By type: "all succulents"

Use when user asks to be reminded to water, fertilize, repot, etc.`,
      parameters: {
        type: "object",
        properties: {
          plant_identifier: {
            type: "string",
            description: "Plant ID from context (preferred) or name/bulk pattern",
          },
          reminder_type: {
            type: "string",
            enum: ["water", "fertilize", "repot", "rotate", "check", "prune", "mist"],
            description: "Type of care reminder",
          },
          frequency_days: { type: "integer", description: "Days between reminders" },
          notes: { type: "string", description: "Optional notes for the reminder" },
        },
        required: ["plant_identifier", "reminder_type", "frequency_days"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_reminder",
      description: "Deactivate/remove care reminders. Supports bulk: 'all', 'all plants in the bedroom', etc.",
      parameters: {
        type: "object",
        properties: {
          plant_identifier: { type: "string", description: "Plant ID from context (preferred) or name/bulk pattern" },
          reminder_type: { type: "string", description: "Optional filter: water, fertilize, repot, rotate, check, prune, mist. Omit to delete all reminders for the plant." },
        },
        required: ["plant_identifier"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_care_event",
      description: `Log a care activity (watering, fertilizing, etc.). Supports BULK operations:
- Single plant: "my monstera" / "Planty"
- All plants: "all" / "all plants" / "everything"
- By location: "all plants in the bedroom" / "bedroom plants"
- By type: "all succulents"

Use when user says they just watered, fertilized, repotted, etc.`,
      parameters: {
        type: "object",
        properties: {
          plant_identifier: {
            type: "string",
            description: "Plant ID from context (preferred) or name/bulk pattern",
          },
          event_type: {
            type: "string",
            enum: ["water", "fertilize", "repot", "prune", "mist", "rotate", "treat"],
            description: "Type of care performed",
          },
          notes: { type: "string", description: "Optional notes about the care" },
        },
        required: ["plant_identifier", "event_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_user_insight",
      description: `Save an important fact learned about the user for future reference. Use this when you learn something that will help personalize future advice, such as:
- They have pets (cats, dogs) - important for toxicity warnings
- Their home lighting conditions (bright, low light, south-facing windows)
- Their watering tendencies (overwaterer, underwaterer, forgetful)
- Experience level (beginner, experienced)
- Plant goals (collection, specific plants, aesthetic)
- Climate/environment (dry apartment, humid bathroom)
- Past problems (recurring pests, root rot history)`,
      parameters: {
        type: "object",
        properties: {
          insight_key: {
            type: "string",
            enum: [
              "has_pets",
              "pet_type",
              "home_lighting",
              "watering_style",
              "experience_level",
              "plant_goals",
              "problem_patterns",
              "home_humidity",
              "climate_zone",
              "window_orientation",
              "plant_preferences",
              "allergy_concerns",
              "child_safety",
              // Communication preferences
              "comm_pref_brevity",
              "comm_pref_tone",
              "comm_pref_humor",
              "comm_pref_emoji_usage",
              "comm_pref_formality",
              "comm_pref_detail_level",
            ],
            description: "Category of the insight",
          },
          insight_value: { type: "string", description: "The actual insight to remember" },
        },
        required: ["insight_key", "insight_value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_notification_preferences",
      description: `Update user's proactive message preferences. Use when user says things like:
- "stop sending reminders" / "turn off tips" → disable that topic
- "message me weekly" / "daily updates" → set notification_frequency (updates profile)
- "don't text after 10pm" / "quiet hours" → set quiet hours
- "send me reminders again" → re-enable topic

Topics: care_reminders (watering/fertilizing), observations (check-ins about inactive plants), seasonal_tips (seasonal advice), health_followups (follow-up on diagnosed issues)`,
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            enum: ["care_reminders", "observations", "seasonal_tips", "health_followups", "all"],
            description: "Which type of proactive message to update, or 'all' for all topics",
          },
          action: {
            type: "string",
            enum: ["enable", "disable", "set_frequency"],
            description: "What to do: enable/disable the topic, or set notification frequency",
          },
          notification_frequency: {
            type: "string",
            enum: ["off", "daily", "weekly", "realtime"],
            description: "How often to send messages (only for set_frequency action). Updates profile-level setting.",
          },
          quiet_hours_start: {
            type: "string",
            description: "Time to stop sending messages (HH:MM format, e.g., '22:00')",
          },
          quiet_hours_end: {
            type: "string",
            description: "Time to resume sending messages (HH:MM format, e.g., '08:00')",
          },
        },
        required: ["topic", "action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_profile",
      description: `Update a core profile field for the user. Use this when the user shares personal info that affects how you help them — location, name, experience level, pets, etc. Do NOT ask for extra confirmation: if the user tells you their zip code or says "I have a cat", that IS their consent.

Examples:
- User says "I'm in 94105" → update_profile({field: "location", value: "94105"})
- User says "Call me Mia" → update_profile({field: "display_name", value: "Mia"})
- User says "I have two cats" → update_profile({field: "pets", value: "cat"})
- User says "I'm pretty new to plants" → update_profile({field: "experience_level", value: "beginner"})

After updating, immediately continue with the user's original request (e.g., after saving location, proceed to find_stores).`,
      parameters: {
        type: "object",
        properties: {
          field: {
            type: "string",
            enum: ["display_name", "location", "experience_level", "primary_concerns", "personality", "pets", "timezone"],
            description: "Which profile field to update",
          },
          value: {
            type: "string",
            description: "The new value for the field",
          },
        },
        required: ["field", "value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deep_think",
      description: "Route a complex question to a smarter model for deeper reasoning. Use for diagnosis, treatment plans, complex care questions.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "The full question with all relevant context" },
          context: { type: "string", description: "Additional context: plant species, symptoms, environment" },
        },
        required: ["question"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_image",
      description: "Generate an image based on a text description. Use for visual guides, plant illustrations, or care diagrams.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Detailed description of the image to generate" },
          count: { type: "number", description: "Number of images to generate (default 1, max 6)" },
        },
        required: ["prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "capture_plant_snapshot",
      description: `Capture a visual snapshot of a plant for the visual memory chronicle. This stores a description and image reference so you can remember what plants look like over time.

Use when:
- User sends a photo and you've identified/diagnosed a plant they have saved
- User explicitly asks to "capture", "save a snapshot", or "remember what this looks like"
- During routine check-ins where a photo is shared

The snapshot includes a detailed visual description that you'll see in future conversations, so be thorough in the description.
If the plant isn't saved yet, set save_if_missing: true and include species so it gets saved alongside the snapshot.`,
      parameters: {
        type: "object",
        properties: {
          plant_identifier: {
            type: "string",
            description: "Plant ID from context (preferred) or name/nickname",
          },
          description: {
            type: "string",
            description: "Detailed visual description: size, color, leaf shape/count, health markers, pot type, distinguishing features. Be specific enough to match later.",
          },
          context: {
            type: "string",
            enum: ["identification", "diagnosis", "routine_check", "user_requested"],
            description: "Why the snapshot is being taken",
          },
          health_notes: {
            type: "string",
            description: "Optional health observations at this point in time",
          },
          save_if_missing: {
            type: "boolean",
            description: "Set to true to auto-save the plant if it doesn't exist yet. Requires species.",
          },
          species: {
            type: "string",
            description: "Species name, required when save_if_missing is true",
          },
          nickname: {
            type: "string",
            description: "Optional nickname for the new plant",
          },
          location: {
            type: "string",
            description: "Optional location in home for the new plant",
          },
        },
        required: ["plant_identifier", "description"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_plant_snapshots",
      description: `Compare how a plant looks now vs. previous snapshots. Fetches stored visual descriptions and generates a temporal comparison showing growth, health changes, or regression.

Use when:
- User asks "how has my plant changed?" or "is it getting better?"
- User wants to see their plant's history or progress
- After a diagnosis, to compare with previous health state
- User asks "what did my plant look like before?"`,
      parameters: {
        type: "object",
        properties: {
          plant_identifier: {
            type: "string",
            description: "Plant ID from context (preferred) or name/nickname",
          },
          comparison_type: {
            type: "string",
            enum: ["latest", "all"],
            description: "latest = compare last 2 snapshots, all = summarize full timeline. Default: latest",
          },
        },
        required: ["plant_identifier"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "recall_media",
      description: "Retrieve previously stored images for this user. Use to show plant snapshot history, past visual guides, or any stored media. Useful when user asks to 'show me again', 'compare photos', 'show my plant history', or references past guides.",
      parameters: {
        type: "object",
        properties: {
          source: {
            type: "string",
            enum: ["plant_snapshots", "generated_guides"],
            description: "Where to look: plant_snapshots for plant photos, generated_guides for previously created visual guides",
          },
          plant_identifier: {
            type: "string",
            description: "Plant name/nickname (required for plant_snapshots, optional for guides)",
          },
          limit: {
            type: "number",
            description: "Max images to return (default 3, max 5)",
          },
        },
        required: ["source"],
      },
    },
  },
  // ── IoT Sensor Tools ──────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "check_plant_sensors",
      description: "Get latest IoT sensor readings for a plant. Returns soil moisture, temperature, humidity, light level with health status assessments. Use when user asks about sensor data, plant conditions, or during pulse checks.",
      parameters: {
        type: "object",
        properties: {
          plant_identifier: {
            type: "string",
            description: "Plant ID from context (preferred), name, or 'all' for all plants with sensors",
          },
        },
        required: ["plant_identifier"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "associate_reading",
      description: "Associate the most recent unassociated sensor reading with a specific plant. Used during pulse-check mode when a handheld sensor takes a reading and the user says which plant it's for.",
      parameters: {
        type: "object",
        properties: {
          plant_identifier: {
            type: "string",
            description: "Plant ID from context (preferred) or name/nickname",
          },
        },
        required: ["plant_identifier"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_plant_ranges",
      description: "Set ideal sensor ranges for a plant based on its species, environment, and needs. Call this when identifying a new plant, when asked to set ranges, or when conditions change (new location, season). Uses four-value ranges: min (danger) -> ideal_min -> ideal_max -> max (danger).",
      parameters: {
        type: "object",
        properties: {
          plant_identifier: {
            type: "string",
            description: "Plant ID from context (preferred) or name/nickname",
          },
          ranges: {
            type: "object",
            description: "Range values per metric. Each has min, ideal_min, ideal_max, max.",
            properties: {
              soil_moisture: {
                type: "object",
                properties: {
                  min: { type: "number", description: "Danger low (below this = critical)" },
                  ideal_min: { type: "number", description: "Ideal low bound" },
                  ideal_max: { type: "number", description: "Ideal high bound" },
                  max: { type: "number", description: "Danger high (above this = critical)" },
                },
              },
              temperature: {
                type: "object",
                properties: {
                  min: { type: "number" },
                  ideal_min: { type: "number" },
                  ideal_max: { type: "number" },
                  max: { type: "number" },
                },
              },
              humidity: {
                type: "object",
                properties: {
                  min: { type: "number" },
                  ideal_min: { type: "number" },
                  ideal_max: { type: "number" },
                  max: { type: "number" },
                },
              },
              light_lux: {
                type: "object",
                properties: {
                  min: { type: "number" },
                  ideal_min: { type: "number" },
                  ideal_max: { type: "number" },
                  max: { type: "number" },
                },
              },
            },
          },
          reasoning: {
            type: "string",
            description: "Why these ranges were chosen — species needs, user environment, season, etc.",
          },
        },
        required: ["plant_identifier", "ranges", "reasoning"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_sensor_history",
      description: "Get historical sensor readings for a plant over a time period. Returns data points and summary stats (min, max, avg). Use when user asks about trends, history, or how a metric has changed.",
      parameters: {
        type: "object",
        properties: {
          plant_identifier: {
            type: "string",
            description: "Plant ID from context (preferred) or name/nickname",
          },
          metric: {
            type: "string",
            enum: ["soil_moisture", "temperature", "humidity", "light_lux", "all"],
            description: "Which metric to retrieve history for",
          },
          period: {
            type: "string",
            enum: ["24h", "7d", "30d"],
            description: "Time period for history",
          },
        },
        required: ["plant_identifier", "metric", "period"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_plant_environments",
      description: "Compare a sensor metric across multiple plants. Use when user asks 'which plant is driest?' or 'compare humidity across my plants'. Returns plants sorted by the metric value.",
      parameters: {
        type: "object",
        properties: {
          plant_identifiers: {
            type: "string",
            description: "Comma-separated plant IDs from context (preferred), names, or 'all'",
          },
          metric: {
            type: "string",
            enum: ["soil_moisture", "temperature", "humidity", "light_lux"],
            description: "Which metric to compare",
          },
        },
        required: ["plant_identifiers", "metric"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "manage_device",
      description: "Manage IoT sensor devices: assign to a plant, unassign, rename, identify (blinks the LED), check status, or provision a new device token. Use when user wants to move a sensor, rename it, find which physical device is which, or set up a new sensor.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["assign", "unassign", "rename", "identify", "status", "provision"],
            description: "What to do with the device",
          },
          device_name: {
            type: "string",
            description: "Name of the device (fuzzy match)",
          },
          device_id: {
            type: "string",
            description: "Device UUID (if known)",
          },
          plant_identifier: {
            type: "string",
            description: "Plant ID from context (preferred) or name — required for assign, optional for provision",
          },
          new_name: {
            type: "string",
            description: "New name — required for rename, optional for provision (defaults to 'New Sensor')",
          },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "dismiss_sensor_alert",
      description: "Dismiss an active sensor alert for a plant. Use when the user acknowledges an alert ('I know, I'll water later') so you don't keep nagging about it.",
      parameters: {
        type: "object",
        properties: {
          plant_identifier: {
            type: "string",
            description: "Plant ID from context (preferred) or name/nickname",
          },
          alert_type: {
            type: "string",
            description: "Type of alert to dismiss: dry, wet, cold, hot, low, high, offline",
          },
          reason: {
            type: "string",
            description: "Why dismissed: 'User will water later', 'Plant is being moved', etc.",
          },
        },
        required: ["plant_identifier"],
      },
    },
  },
];
