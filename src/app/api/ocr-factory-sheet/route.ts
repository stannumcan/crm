import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expert at reading Chinese factory cost sheets for tin can manufacturing.
Extract all data from the image and return ONLY a valid JSON object — no markdown, no explanation, just the JSON.
If a field is not visible or illegible, use null. Numbers should be numeric (not strings).
Chinese labels to look for: 铁料=steel, 印刷=printing, 盖=lid, 身=body, 底=bottom, 内盖=inner lid,
排版=layout, 模具=mold, 包装=packaging, 运费=shipping, 劳工=labor, 配件=accessories.`;

const USER_PROMPT = `Extract all data from this factory cost sheet into this exact JSON structure:

{
  "factory_ref_no": string | null,
  "sheet_date": string | null,       // YYYY-MM-DD format
  "mold_number": string | null,      // e.g. "ML-1234" or "HM1234"
  "product_dimensions": string | null,
  "steel_type": string | null,       // e.g. "MR", "DR"
  "steel_thickness": number | null,  // mm
  "steel_price_per_ton": number | null, // RMB
  "process": string | null,          // e.g. "2片"
  "accessories_name": string | null,
  "accessories_description": string | null,
  "mold_cost_new": number | null,    // RMB
  "mold_cost_modify": number | null, // RMB
  "mold_lead_time_days": number | null,
  "outer_carton_qty": number | null,
  "outer_carton_config": string | null,
  "outer_carton_l": number | null,   // mm
  "outer_carton_w": number | null,   // mm
  "outer_carton_h": number | null,   // mm
  "outer_carton_cbm": number | null,
  "inner_carton_qty": number | null,
  "pallet_type": string | null,
  "pallet_l": number | null,
  "pallet_w": number | null,
  "pallet_h": number | null,
  "pallet_config": string | null,
  "cans_per_pallet": number | null,
  "components": [
    {
      "component": "lid" | "body" | "bottom" | "inner_lid",
      "cut_size": string | null,
      "layout": string | null,
      "steel_unit_price": number | null,
      "printing_requirements": string | null,
      "printing_cost_per_sheet": number | null,
      "printing_unit_price": number | null
    }
  ],
  "tiers": [
    {
      "tier_label": string,           // e.g. "A", "B", "C"
      "quantity": number | null,
      "steel_cost": number | null,
      "printing_cost": number | null,
      "packaging_cost": number | null,
      "shipping_cost": number | null,
      "total_subtotal": number | null, // 总成本合计
      "labor_cost": number | null,
      "accessories_cost": number | null,
      "container_info": string | null  // e.g. "1×20ft"
    }
  ]
}

Return only the JSON object. No extra text.`;

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const body = await request.json();
  const { image, mediaType } = body as { image: string; mediaType: string };

  if (!image) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: image,
              },
            },
            { type: "text", text: USER_PROMPT },
          ],
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

    // Strip any accidental markdown fences
    const json = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    const data = JSON.parse(json);

    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "OCR failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
