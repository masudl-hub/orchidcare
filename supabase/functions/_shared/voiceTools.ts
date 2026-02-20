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
        description: "Display a visual formation on the pixel canvas during the call. Use this to show plant silhouettes, tool images, text messages, lists, or icons. The pixels will animate from their current shape to the new formation. Available formations include 82 plant species and 37 gardening tools from the asset library, plus dynamic text, lists, and icons.",
        parameters: {
          type: "OBJECT",
          properties: {
            type: { type: "STRING", description: "Formation type: 'template' for plant/tool art, 'text' for pixel text, 'list' for numbered items" },
            id: { type: "STRING", description: "Template ID for type='template'. Examples: 'monstera_deliciosa', 'watering_can', 'phalaenopsis_orchid'. Use the closest match to what you're discussing." },
            text: { type: "STRING", description: "Text to display for type='text'. Keep SHORT — max ~11 chars per line, ~10 lines. All caps recommended." },
            items: { type: "ARRAY", items: { type: "STRING" }, description: "List items for type='list'. Max 5 items, keep each SHORT." },
            transition: { type: "STRING", description: "Animation style: 'morph' (smooth curves, default), 'dissolve' (fade), 'scatter' (explode+reform), 'ripple' (wave from center)" },
            hold: { type: "INTEGER", description: "Seconds to hold formation before returning to orchid. 0 = stay until next show_visual. Default: 8" },
          },
          required: ["type"],
        },
      },
      {
        name: "annotate_view",
        description: "Draw pixel-art annotations on the user's camera feed. Use when video is active to point out features — leaf damage, pests, good placement spots, soil issues. Places markers on a 5x5 grid.",
        parameters: {
          type: "OBJECT",
          properties: {
            markers: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  region: { type: "STRING", description: "Grid region (5x5): T1 T2 T3 T4 T5 / U1 U2 U3 U4 U5 / M1 M2 M3 M4 M5 / L1 L2 L3 L4 L5 / B1 B2 B3 B4 B5" },
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
    ],
  },
];
