import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { pdfs } = await req.json()

    if (!pdfs || !pdfs.length) {
      return new Response(JSON.stringify({ error: 'No PDFs provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Strip data URI prefix if present, ensure clean base64
    const cleanBase64 = (raw: string) => raw.replace(/^data:application\/pdf;base64,/, '')

    const pdfContents = pdfs.map((base64: string) => ({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: cleanBase64(base64) }
    }))

    const extractionPrompt = `Extract the following fields from this Offering Memorandum. Return ONLY a JSON object with these exact keys. Use null for any field you cannot find. Do not guess — only return values clearly stated in the document.

{
  "propertyName": "Name of the property (string)",
  "propertyAddress": "Full street address including city, state, zip (string)",
  "yearBuilt": "Year the building was constructed (number)",
  "price": "Asking or list price in dollars, no $ sign or commas (number)",
  "tu": "Total number of units (number)",
  "ou": "Number of occupied units if stated, else null (number)",
  "rent": "Average monthly rent per unit in dollars, no $ sign (number). Look for 'avg rent', 'average rent', 'rent per unit', or divide gross potential rent by number of units and 12.",
  "vp": "Vacancy rate as a percentage number e.g. 5 not 0.05. Look for 'vacancy', 'vacancy rate', 'vacancy allowance' (number)",
  "lev": "Loan-to-value ratio as a percentage e.g. 65 or 70. Look for 'LTV', 'loan to value', 'leverage'. If not stated use null (number)",
  "ir": "Interest rate as a percentage e.g. 6.5 not 0.065. Look for 'interest rate', 'note rate', 'mortgage rate' (number)",
  "am": "Loan amortization in years e.g. 30. Look for 'amortization', 'loan term' (number)",
  "tax": "Annual real estate taxes in dollars. Look for 'real estate taxes', 'property taxes', 'taxes' in the expense section (number)",
  "ins": "Annual insurance cost for the ENTIRE PROPERTY in dollars — this must be the annual total, NOT per-unit. Look for 'insurance' in the expense section (number)",
  "utilElec": "Annual landlord-paid electric costs in dollars. Look for 'electric', 'electricity', 'common area electric' in the expense section (number)",
  "utilElecSubmetered": "true if the document mentions tenants paying electric directly: 'tenant pays electric', 'separately metered', 'sub-metered electric', 'individually metered', 'tenants responsible for electric', 'FPL in tenant name'. Also check investment highlights, property description, and unit amenities sections. false if landlord pays or no mention found (boolean)",
  "utilWater": "Annual water and sewer costs in dollars. Look for 'water', 'sewer', 'water & sewer' in the expense section (number)",
  "utilWaterSubmetered": "true if the document mentions tenants paying water separately: 'tenant pays water', 'sub-metered water', 'individually metered water', 'RUBS', 'ratio utility billing'. Also check investment highlights and property description. false if landlord pays or no mention found (boolean)",
  "utilTrash": "Annual trash removal costs in dollars. Look for 'trash', 'garbage', 'waste removal' in the expense section (number)",
  "util": "Total annual utilities in dollars. If individual utility line items are found, this should be their sum. If only a single combined utility figure is shown, use that here and leave the individual fields null (number)",
  "rm": "Annual repairs and maintenance for the ENTIRE PROPERTY in dollars — this must be the annual total, NOT per-unit. Look for 'repairs', 'maintenance', 'R&M' in expenses (number)",
  "cs": "Annual contract services in dollars. Look for 'contract services', 'landscaping', 'pest control', 'janitorial' in expenses (number)",
  "ga": "Annual general and administrative costs in dollars. Look for 'G&A', 'general and administrative', 'admin' in expenses (number)",
  "res": "Annual capital reserves for the ENTIRE PROPERTY in dollars — this must be the annual total, NOT per-unit. Look for 'reserves', 'replacement reserves', 'capital reserves' in expenses (number)",
  "pm": "Property management fee as a percentage of income e.g. 8 not 0.08. Look for 'management', 'property management', 'mgmt fee' (number)",
  "otherIncome": "Array of other income items not included in rent. Each item: { label: string, amount: number (annual dollars) }. Look for 'laundry', 'parking', 'storage', 'other income', 'ancillary income'. Return [] if none found.",
  "rentRoll": "Array of individual units if a rent roll table exists in the OM. Each item: { label: string (e.g. 'Unit 1'), type: string (e.g. '1bd/1ba', 'Studio'), sqft: number, rent: number (monthly rent), leaseEnd: string (MM/DD/YYYY if shown), vacant: boolean (true if shown as vacant) }. Return [] if no rent roll table — do not guess individual rents.",
  "propertyImageUrl": null
}

Important extraction tips:
- All expense figures must be ANNUAL TOTALS for the ENTIRE PROPERTY. If an expense is shown per-unit, multiply by the number of units. If shown monthly, multiply by 12. Never return per-unit or per-month figures.
- This applies to ALL expense fields: tax, ins, util, utilElec, utilWater, utilTrash, rm, cs, ga, res — every one must be the full annual total for the whole property.
- Rent is the ONLY field that should be per-unit (monthly per-unit rent).
- Vacancy may be shown as a dollar amount — divide by gross potential rent to get percentage
- LTV and interest rate are often in a 'financing' or 'loan assumptions' section
- If you see a pro forma or T12 operating statement, prefer the T12 (trailing 12 months) figures over pro forma projections
- On Crexi-format OMs, financial data is often in tables labeled 'Financial Summary', 'Income & Expenses', 'Operating Statement', or 'Financials'
- Look at ALL pages of the document — expenses and financing details are often on page 2 or 3
- If the OM contains a rent roll table with individual unit rents, extract each unit as a separate object in the rentRoll array. If only a blended or average rent is shown, return rentRoll as [] and use the rent field instead.`

    // Diagnostic log — structure verification
    console.error(`[extract-om] Sending ${pdfContents.length} PDF document block(s), base64 lengths: ${pdfs.map((p: string) => cleanBase64(p).length).join(', ')}, prompt starts: "${extractionPrompt.slice(0, 200)}..."`)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: `You are a real estate underwriting data extractor. You will be given one or more pages of a commercial real estate Offering Memorandum (OM). Your job is to extract specific financial and property data and return it as a single valid JSON object with no other text, preamble, explanation, or markdown. Start your response with { and end with }.`,
        messages: [{
          role: 'user',
          content: [
            ...pdfContents,
            { type: 'text', text: extractionPrompt }
          ]
        }]
      })
    })

    const data = await response.json()
    const text = data.content?.find((b: any) => b.type === 'text')?.text ?? ''

    const extractJSON = (raw: string): string => {
      const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (fenced) return fenced[1].trim()
      const start = raw.indexOf('{')
      const end = raw.lastIndexOf('}')
      if (start !== -1 && end !== -1 && end > start) return raw.slice(start, end + 1)
      return raw.trim()
    }

    const parsed = JSON.parse(extractJSON(text))

    // Image extraction from PDF is not supported via vision API — manual upload only
    parsed.propertyImageUrl = null

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? 'Extraction failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
