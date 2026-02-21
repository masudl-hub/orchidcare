// Shared voice tool declarations (Gemini function-calling format).
// Used by call-session and dev-call-proxy.
// Grid uses the 5x5 layout: T1-T5 / U1-U5 / M1-M5 / L1-L5 / B1-B5

export const voiceToolDeclarations = [
  {
    functionDeclarations: [
      {
        name: "research",
        description: "Search the web for current plant care information",
        behavior: "NON_BLOCKING",
        parameters: {
          type: "OBJECT",
          properties: {
            query: { type: "STRING", description: "The search query" },
          },
          required: ["query"],
        },
      },
      {
        name: "save_plant",
        description: "Save a plant to the user's collection",
        parameters: {
          type: "OBJECT",
          properties: {
            species: { type: "STRING", description: "Plant species name" },
            nickname: { type: "STRING", description: "Optional nickname" },
            location: { type: "STRING", description: "Location in home" },
          },
          required: ["species"],
        },
      },
      {
        name: "modify_plant",
        description: "Update plant details. Supports bulk: 'all', 'all plants in the bedroom', etc.",
        parameters: {
          type: "OBJECT",
          properties: {
            plant_identifier: { type: "STRING", description: "Plant name or bulk pattern" },
            updates: {
              type: "OBJECT",
              properties: {
                nickname: { type: "STRING" },
                location: { type: "STRING" },
                notes: { type: "STRING" },
              },
            },
          },
          required: ["plant_identifier"],
        },
      },
      {
        name: "delete_plant",
        description: "Remove plants from collection. For bulk, confirm via voice first.",
        parameters: {
          type: "OBJECT",
          properties: {
            plant_identifier: { type: "STRING", description: "Plant name or bulk pattern" },
            user_confirmed: { type: "BOOLEAN", description: "True only after explicit voice confirmation" },
          },
          required: ["plant_identifier"],
        },
      },
      {
        name: "create_reminder",
        description: "Set care reminders for plants",
        parameters: {
          type: "OBJECT",
          properties: {
            plant_identifier: { type: "STRING", description: "Plant name or bulk pattern" },
            reminder_type: { type: "STRING", description: "water, fertilize, repot, rotate, check, prune, mist" },
            frequency_days: { type: "INTEGER", description: "Days between reminders" },
            notes: { type: "STRING", description: "Optional notes" },
          },
          required: ["plant_identifier", "reminder_type", "frequency_days"],
        },
      },
      {
        name: "log_care_event",
        description: "Log a care activity like watering or fertilizing",
        parameters: {
          type: "OBJECT",
          properties: {
            plant_identifier: { type: "STRING", description: "Plant name or bulk pattern" },
            event_type: { type: "STRING", description: "water, fertilize, repot, prune, mist, rotate, treat" },
            notes: { type: "STRING", description: "Optional notes" },
          },
          required: ["plant_identifier", "event_type"],
        },
      },
      {
        name: "save_user_insight",
        description: "Remember a fact about the user for future reference",
        parameters: {
          type: "OBJECT",
          properties: {
            insight_key: { type: "STRING", description: "Category: has_pets, pet_type, home_lighting, watering_style, experience_level, plant_goals, etc." },
            insight_value: { type: "STRING", description: "The fact to remember" },
          },
          required: ["insight_key", "insight_value"],
        },
      },
      {
        name: "update_notification_preferences",
        description: "Update proactive message preferences",
        parameters: {
          type: "OBJECT",
          properties: {
            topic: { type: "STRING", description: "care_reminders, observations, seasonal_tips, health_followups, or all" },
            action: { type: "STRING", description: "enable, disable, or set_frequency" },
            notification_frequency: { type: "STRING", description: "off, daily, weekly, realtime" },
          },
          required: ["topic", "action"],
        },
      },
      {
        name: "update_profile",
        description: "Update user profile fields like name, location, experience level",
        parameters: {
          type: "OBJECT",
          properties: {
            field: { type: "STRING", description: "display_name, location, experience_level, primary_concerns, personality, pets, timezone" },
            value: { type: "STRING", description: "The new value" },
          },
          required: ["field", "value"],
        },
      },
      {
        name: "find_stores",
        description: "Find local stores for plant supplies",
        behavior: "NON_BLOCKING",
        parameters: {
          type: "OBJECT",
          properties: {
            product_query: { type: "STRING", description: "What to look for" },
            store_type: { type: "STRING", description: "nursery, garden_center, hardware_store, or any" },
          },
          required: ["product_query"],
        },
      },
      {
        name: "verify_store_inventory",
        description: "Check if a specific store carries a product",
        behavior: "NON_BLOCKING",
        parameters: {
          type: "OBJECT",
          properties: {
            store_name: { type: "STRING", description: "Full store name with location" },
            product: { type: "STRING", description: "Product to check" },
            location: { type: "STRING", description: "City or ZIP" },
          },
          required: ["store_name", "product", "location"],
        },
      },
      {
        name: "show_visual",
        description: "Display a plant or tool silhouette on the pixel canvas. Use type='template' with an id from the asset library (82 plant species, 37 gardening tools). Each call animates for ~1-3 seconds then holds; multiple calls queue up and play in sequence — don't fire more than 2-3 per response.",
        parameters: {
          type: "OBJECT",
          properties: {
            type: { type: "STRING", description: "Always use 'template'" },
            id: { type: "STRING", description: "Template ID. Examples: 'monstera_deliciosa', 'watering_can', 'phalaenopsis_orchid', 'pruning_shears'. Use the closest match to what you're discussing." },
            transition: { type: "STRING", description: "Animation style: 'morph' (default), 'dissolve', 'scatter', 'ripple'" },
            hold: { type: "INTEGER", description: "Seconds to hold before returning to orchid. 0 = stay until next show_visual. Default: 8" },
          },
          required: ["type"],
        },
      },
      {
        name: "annotate_view",
        description: "Draw pixel-art annotations on the user's camera feed. Use when video is active to point out features — leaf damage, pests, placement spots, soil issues. Places markers on a 10×10 grid. Pass empty markers array to dismiss current annotations.",
        parameters: {
          type: "OBJECT",
          properties: {
            markers: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  region: { type: "STRING", description: "Grid region (10×10): rows A (top) to J (bottom), cols 1 (left) to 10 (right). Examples: A1 (top-left), E5 (center-left), J10 (bottom-right)" },
                  type: { type: "STRING", description: "Marker type: arrow, circle, x, or label" },
                  label: { type: "STRING", description: "Short text label (max 12 chars). Required for label type." },
                  direction: { type: "STRING", description: "For arrows only: up, down, left, right, up-left, up-right, down-left, down-right" },
                },
                required: ["region", "type"],
              },
            },
            hold: { type: "INTEGER", description: "Seconds to display. 0 = stay until next call. Default: 8" },
          },
          required: ["markers"],
        },
      },
      {
        name: "deep_think",
        description: "Route a complex question to a smarter model for deeper reasoning. Use this for plant diagnosis, treatment plans, complex care questions, or anything requiring careful analysis. The response will be thorough and expert-level.",
        behavior: "NON_BLOCKING",
        parameters: {
          type: "OBJECT",
          properties: {
            question: { type: "STRING", description: "The full question to reason about, including all relevant context from the conversation" },
            context: { type: "STRING", description: "Additional context: plant species, symptoms, environment, user history — anything relevant" },
          },
          required: ["question"],
        },
      },
      {
        name: "delete_reminder",
        description: "Deactivate/remove care reminders for plants. Supports bulk: 'all', 'all plants in the bedroom', etc.",
        parameters: {
          type: "OBJECT",
          properties: {
            plant_identifier: { type: "STRING", description: "Plant name or bulk pattern" },
            reminder_type: { type: "STRING", description: "Optional filter: water, fertilize, repot, rotate, check, prune, mist. Omit to delete all." },
          },
          required: ["plant_identifier"],
        },
      },
      {
        name: "identify_plant",
        description: "Identify a plant from your visual observation. In voice mode, describe what you see from the camera. Provide species, common names, and brief care summary.",
        parameters: {
          type: "OBJECT",
          properties: {
            description: { type: "STRING", description: "Detailed visual description of the plant: leaf shape, color, size, stems, flowers, any distinctive features" },
            context: { type: "STRING", description: "Any additional context the user shared" },
          },
          required: ["description"],
        },
      },
      {
        name: "diagnose_plant",
        description: "Diagnose plant health issues from your visual observation. Describe symptoms you see from the camera.",
        parameters: {
          type: "OBJECT",
          properties: {
            description: { type: "STRING", description: "Detailed description of symptoms: discoloration, wilting, spots, pests, etc." },
            plant_species: { type: "STRING", description: "Plant species if known" },
          },
          required: ["description"],
        },
      },
      {
        name: "analyze_environment",
        description: "Analyze the growing environment from what you can see on the camera. Assess light, space, and conditions.",
        parameters: {
          type: "OBJECT",
          properties: {
            description: { type: "STRING", description: "Description of the environment: light levels, window proximity, space, other plants nearby" },
            plant_species: { type: "STRING", description: "Plant species being placed here, if relevant" },
          },
          required: ["description"],
        },
      },
      {
        name: "generate_visual_guide",
        description: "Generate a visual care guide or illustration for a plant topic.",
        behavior: "NON_BLOCKING",
        parameters: {
          type: "OBJECT",
          properties: {
            topic: { type: "STRING", description: "What to illustrate: repotting steps, pruning guide, pest identification, etc." },
            plant_species: { type: "STRING", description: "Plant species for context" },
          },
          required: ["topic"],
        },
      },
      {
        name: "analyze_video",
        description: "Analyze a longer observation of a plant from the camera feed. Use when you need extended observation.",
        behavior: "NON_BLOCKING",
        parameters: {
          type: "OBJECT",
          properties: {
            observation: { type: "STRING", description: "Summary of what you observed over time" },
            question: { type: "STRING", description: "Specific question about the observation" },
          },
          required: ["observation"],
        },
      },
      {
        name: "generate_image",
        description: "Generate an image based on a description. Use for visual guides or illustrations.",
        behavior: "NON_BLOCKING",
        parameters: {
          type: "OBJECT",
          properties: {
            prompt: { type: "STRING", description: "Detailed description of the image to generate" },
          },
          required: ["prompt"],
        },
      },
      {
        name: "capture_plant_snapshot",
        description: "Capture a visual snapshot of a plant for the visual memory chronicle. NEVER call without explicit user consent — always ask first ('Want me to save a snapshot?') and wait for confirmation. If the plant isn't saved yet, call save_plant first, then capture the snapshot. Provide a thorough description of what you see.",
        parameters: {
          type: "OBJECT",
          properties: {
            plant_identifier: { type: "STRING", description: "Name/nickname of the plant to attach the snapshot to" },
            description: { type: "STRING", description: "Detailed visual description: size, color, leaf shape/count, health markers, pot type, distinguishing features. Be specific enough to match later." },
            context: { type: "STRING", description: "Why: identification, diagnosis, routine_check, user_requested" },
            health_notes: { type: "STRING", description: "Optional health observations at this point in time" },
            confirmed: { type: "BOOLEAN", description: "Must be true — ask the user for confirmation before calling this tool" },
            save_if_missing: { type: "BOOLEAN", description: "Set to true to auto-save the plant if it doesn't exist yet. Requires species." },
            species: { type: "STRING", description: "Species name, required when save_if_missing is true" },
            nickname: { type: "STRING", description: "Optional nickname for the new plant (used with save_if_missing)" },
            location: { type: "STRING", description: "Optional location in home (used with save_if_missing)" },
          },
          required: ["plant_identifier", "description", "confirmed"],
        },
      },
      {
        name: "compare_plant_snapshots",
        description: "Compare how a plant looks now vs. previous snapshots. Fetches stored visual descriptions and returns a temporal comparison. Use when the user asks how a plant has changed, whether it's improved, or wants to see its history.",
        behavior: "NON_BLOCKING",
        parameters: {
          type: "OBJECT",
          properties: {
            plant_identifier: { type: "STRING", description: "Name/nickname of the plant to compare snapshots for" },
            comparison_type: { type: "STRING", description: "latest (compare last 2), all (summarize full timeline), or specific" },
          },
          required: ["plant_identifier"],
        },
      },
    ],
  },
];
