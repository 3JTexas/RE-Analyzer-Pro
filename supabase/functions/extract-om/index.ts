import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const NNN_EXTRACTION_PROMPT = `Extract the following fields from this single-tenant NNN (triple-net) real estate document (Offering Memorandum, lease summary, pro forma, broker flyer, or any combination). Return ONLY a JSON object with these exact keys. Use null for any field you cannot find. Do not guess — only return values clearly stated in the document.

{
  "propertyName": "Name of the property or center (string)",
  "propertyAddress": "Full street address including city, state, zip (string)",
  "yearBuilt": "Year the building was constructed (number)",
  "price": "Asking or list price in dollars, no $ sign or commas (number)",
  "buildingSqft": "Total building square footage (number). Look for 'Building Size', 'GLA', 'SF', 'Square Feet'.",
  "tenantName": "Name of the single tenant or anchor tenant (string). E.g. 'Walgreens', 'FedEx', 'Dollar General', 'Chick-fil-A'.",
  "tenantCreditRating": "S&P or Moody's credit rating of the tenant or its parent if stated. One of: 'AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'NR' (Not Rated), 'Private'. Use null if not stated.",
  "leaseStart": "Lease commencement date in YYYY-MM-DD format (string). Look for 'Lease Start', 'Commencement', 'Term Start'.",
  "leaseEnd": "Lease expiration date in YYYY-MM-DD format (string). Look for 'Lease End', 'Expiration', 'Term End'. If only the term is given (e.g. '15-year lease commencing 2020'), calculate.",
  "nnnAnnualRent": "Current annual base rent in dollars, no $ sign or commas (number). This is the ANNUAL rent, not monthly. Look for 'Base Rent', 'Annual Rent', 'NOI'. If only monthly is given, multiply by 12.",
  "rentEscalationPct": "Rent escalation percentage as a number e.g. 2 not 0.02 (number). Look for 'Escalations', 'Rent Bumps', 'CPI Adjustments', 'Annual Increases'.",
  "rentEscalationFreq": "Frequency of rent escalations. Exactly one of: 'annual', 'every5yr', 'cpi', 'flat'. Use 'flat' if there are no escalations stated.",
  "nnnType": "Lease structure. Exactly one of: 'NN' (double net — tenant pays taxes + insurance), 'NNN' (triple net — tenant pays taxes + insurance + CAM), 'absolute_NNN' (bondable — tenant pays everything including roof/structure), 'modified_gross' (landlord covers more). Use null if unclear.",
  "guarantyType": "Type of lease guaranty. Exactly one of: 'corporate' (corporate parent guaranty), 'parent' (parent company guaranty), 'personal' (individual personal guaranty), 'none'. Use null if not stated.",
  "landlordReservesAnnual": "Annual landlord-side reserves or non-recoverable landlord expenses in dollars (number). Often $0 for absolute NNN. Look for 'Landlord Reserves', 'LL Expenses', 'Roof Reserve'.",
  "tax": "Annual real estate taxes if landlord pays (typically $0 for true NNN). Use null if tenant pays directly. (number)",
  "ins": "Annual insurance if landlord pays (typically $0 for true NNN). Use null if tenant pays directly. (number)",
  "lev": "Loan-to-value ratio as a percentage e.g. 65 or 70 (number). Use null if not stated.",
  "ir": "Interest rate as a percentage e.g. 6.5 not 0.065 (number). Use null if not stated.",
  "am": "Loan amortization in years e.g. 30 (number). Use null if not stated.",
  "propertyImageUrl": null
}

Important extraction tips:
- This is a single-tenant net-leased asset. There is NO unit count, NO rent roll, NO vacancy. Don't try to extract multifamily fields.
- For absolute NNN deals, taxes/insurance are typically $0 to the landlord — explicitly use null or 0.
- Lease summary tables usually have: Tenant / Property Type / Lease Type / Lease Start / Lease End / Rent / Escalations / Options.
- Credit rating is typically shown as 'Tenant Credit', 'S&P Rating', or 'Investment Grade' / 'Non-Investment Grade'.
- Many NNN OMs lead with a "Lease Abstract" or "Lease Summary" table on page 1 — extract heavily from there.
- If escalations are described as "10% every 5 years", use rentEscalationPct: 10 and rentEscalationFreq: 'every5yr'.
- If the lease is in option periods, extract the current rent (not future option rents).`

const MF_EXTRACTION_PROMPT = `Extract the following fields from this real estate document (which may be an Offering Memorandum, rent roll, pro forma, broker flyer, operating statement, or T12). Return ONLY a JSON object with these exact keys. Use null for any field you cannot find. Do not guess — only return values clearly stated in the document.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { pdfs, mode } = await req.json()
    const dealMode: 'mf' | 'nnn' = mode === 'nnn' ? 'nnn' : 'mf'

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

    const extractionPrompt = dealMode === 'nnn' ? NNN_EXTRACTION_PROMPT : MF_EXTRACTION_PROMPT + `

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
  "rentRoll": "Array of individual units if ANY unit-level rent data exists in the document. This is the HIGHEST PRIORITY field — if the document is a rent roll or contains a table listing individual units with rents, you MUST extract every unit. Each item: { label: string (e.g. 'Unit 1', 'Apt 1'), type: string (e.g. '2bd/1ba', 'Studio', '1/1'), sqft: number, rent: number (monthly rent), leaseEnd: string (MM/DD/YYYY if shown), vacant: boolean (true if shown as vacant) }. Look for columns like 'Unit', 'Apt', 'Rents', 'Rent', 'Monthly', 'Lease End', 'Renewal', 'Move-in'. Return [] ONLY if no individual unit data exists anywhere in the document.",
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
- If the document contains a rent roll table with individual unit rents, extract each unit as a separate object in the rentRoll array. If only a blended or average rent is shown, return rentRoll as [] and use the rent field instead.
- If the ENTIRE document is a rent roll (just a list of units and rents), still extract every unit into the rentRoll array and calculate the average for the rent field. Set other fields to null if not present — that is expected for a standalone rent roll document.
- Rent roll tables may use column headers like: Apt, Unit, Rents, Rent, Monthly Rent, Renewal, Lease End, Move-in, Sq Ft, Type, Bed/Bath`

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
        system: `You are a real estate underwriting data extractor. You will be given one or more pages from real estate documents — these may include Offering Memorandums (OMs), rent rolls, pro formas, broker flyers, operating statements, T12s, or any combination. Your job is to extract specific financial and property data and return it as a single valid JSON object with no other text, preamble, explanation, or markdown. Start your response with { and end with }. IMPORTANT: If the document is a rent roll or contains a rent roll table listing individual units with their rents, you MUST extract each unit into the rentRoll array — this is the highest-priority extraction field.`,
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
