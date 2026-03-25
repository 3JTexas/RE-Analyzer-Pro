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
    const { pdf } = await req.json()

    if (!pdf) {
      return new Response(JSON.stringify({ error: 'No PDF provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const cleanBase64 = (raw: string) => raw.replace(/^data:application\/pdf;base64,/, '')

    const extractionPrompt = `Extract the following fields from this Florida county property appraiser or tax record PDF. Return ONLY JSON with these exact keys. Use null for any field not found. Do not guess.

{
  "assessedValue": "Total assessed value of the property in dollars, no $ or commas (number)",
  "landValue": "Assessed value of the land only in dollars (number)",
  "improvementValue": "Assessed value of improvements/building only in dollars (number)",
  "landPct": "Land value as a percentage of total assessed value — compute as landValue/assessedValue*100, round to 1 decimal (number)",
  "taxableValue": "Taxable value after exemptions in dollars (number)",
  "annualTaxBill": "Total annual property tax bill in dollars — look for 'total taxes', 'ad valorem taxes', 'total amount due' (number)",
  "millageRate": "Total millage rate — look for 'millage rate', 'total millage', expressed as mills e.g. 21.1718 (number)",
  "taxYear": "Tax year this record applies to (number)",
  "parcelId": "Parcel ID or PCN number (string)",
  "ownerName": "Current owner name on record (string)",
  "propertyAddress": "Property address on the tax record (string)"
}

Important:
- Florida assessments: assessed value is typically 80-100% of market value after Save Our Homes cap
- On a sale, assessed value resets to purchase price — if this is a post-sale record, assessed value should be near the sale price
- Millage rate is in mills (thousandths of a dollar) — e.g. 21.1718 means $21.1718 per $1,000 of taxable value
- Annual tax bill should be the TOTAL bill including all taxing authorities, not just county`

    console.error(`[extract-tax-record] Sending PDF, base64 length: ${cleanBase64(pdf).length}`)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: `You are a Florida county property tax record extractor. You will be given a county property appraiser PDF. Return ONLY a valid JSON object with no preamble, explanation, or markdown. Start with { and end with }.`,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: cleanBase64(pdf) } },
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

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? 'Extraction failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
