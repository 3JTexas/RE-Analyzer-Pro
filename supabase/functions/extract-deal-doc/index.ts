import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROMPTS: Record<string, string> = {
  loi: `Extract the following fields from this Letter of Intent. Return ONLY a JSON object with these exact keys. Use null for any field you cannot find.

{
  "purchasePrice": "Purchase price in dollars (number)",
  "earnestDeposit": "Earnest money deposit in dollars (number)",
  "ddPeriodDays": "Due diligence period in days (number)",
  "closingDays": "Closing period in days after DD expiration (number)",
  "financingContingency": "true if financing contingency exists, false otherwise (boolean)",
  "loanApprovalDays": "Days for loan approval after DD if stated (number)",
  "buyerName": "Buyer/purchaser name (string)",
  "sellerName": "Seller name (string)",
  "propertyAddress": "Property address (string)",
  "loiDate": "Date of LOI (string, as written)",
  "expirationDays": "LOI expiration in business days (number)",
  "contingencies": "Summary of all contingencies and special conditions (string)",
  "ddDeliveryDays": "Days for seller to deliver DD documents (number)",
  "notes": "Any other notable terms, exclusions, or special conditions (string)"
}

Important: Extract only what is explicitly stated. Do not guess or infer values.`,

  psa: `Extract the following fields from this Purchase and Sale Agreement. Return ONLY a JSON object with these exact keys. Use null for any field you cannot find.

{
  "purchasePrice": "Purchase price in dollars (number)",
  "earnestDeposit": "Earnest money deposit in dollars (number)",
  "additionalDeposit": "Additional deposit amount if any (number)",
  "ddPeriodDays": "Due diligence/inspection period in days (number)",
  "closingDate": "Closing date (string, as written)",
  "closingDays": "Days to closing from effective date or DD expiration (number)",
  "financingContingency": "true if financing contingency exists (boolean)",
  "loanAmount": "Specified loan amount or minimum if stated (number)",
  "loanApprovalDays": "Days for loan commitment (number)",
  "buyerName": "Buyer/purchaser entity name (string)",
  "sellerName": "Seller entity name (string)",
  "propertyAddress": "Full property address (string)",
  "legalDescription": "Legal description if included (string)",
  "effectiveDate": "Effective date of agreement (string)",
  "titleCompany": "Title/escrow company name if stated (string)",
  "assignmentAllowed": "true if assignment is allowed (boolean)",
  "sellerReps": "Summary of seller representations and warranties (string)",
  "prorations": "Summary of proration terms (string)",
  "defaultRemedies": "Summary of default/remedy provisions (string)",
  "contingencies": "Summary of all contingencies (string)",
  "notes": "Any other notable terms or special conditions (string)"
}

Important: Extract only what is explicitly stated in the document.`,

  inspection_report: `Extract a structured list of findings from this inspection report. Return ONLY a JSON object with these exact keys.

{
  "propertyAddress": "Property address (string)",
  "inspectionDate": "Date of inspection (string)",
  "inspectorName": "Inspector name/company (string)",
  "overallCondition": "Overall condition summary in 1-2 sentences (string)",
  "findings": [
    {
      "description": "Description of the finding (string)",
      "location": "Where in the property this was found (string)",
      "severity": "low, medium, high, or critical (string)",
      "estimatedCost": "Estimated repair cost in dollars if stated, null if not (number)",
      "recommendation": "Inspector's recommendation (string)",
      "photo": "true if photos were included for this finding (boolean)"
    }
  ],
  "majorSystems": {
    "roof": "Condition and estimated remaining life (string)",
    "hvac": "Condition and age (string)",
    "plumbing": "Condition notes (string)",
    "electrical": "Condition notes (string)",
    "foundation": "Condition notes (string)",
    "exterior": "Condition notes (string)"
  },
  "totalEstimatedRepairs": "Total estimated repair cost if stated (number)",
  "notes": "Any other notable findings or recommendations (string)"
}

Important: List every finding mentioned in the report. Severity should be: low (cosmetic/minor), medium (should repair within 1 year), high (needs prompt attention), critical (safety hazard or structural concern).`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { pdf, docType } = await req.json()

    if (!pdf) {
      return new Response(JSON.stringify({ error: 'No PDF provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const prompt = PROMPTS[docType] ?? PROMPTS.loi
    const cleanBase64 = (raw: string) => raw.replace(/^data:application\/pdf;base64,/, '')

    console.error(`[extract-deal-doc] docType=${docType}, base64 length: ${cleanBase64(pdf).length}`)

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
        system: `You are a real estate document data extractor. You will be given a PDF of a deal document (LOI, PSA, or inspection report). Extract the requested data and return it as a single valid JSON object with no other text, preamble, or markdown. Start your response with { and end with }.`,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: cleanBase64(pdf) } },
            { type: 'text', text: prompt }
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

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? 'Extraction failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
