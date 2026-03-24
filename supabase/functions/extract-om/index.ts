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

    const pdfContents = pdfs.map((base64: string) => ({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 }
    }))

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
        system: `You are a commercial real estate data extraction specialist. Extract investment property data from offering memorandum PDFs. Return ONLY a valid JSON object with no other text, preamble, or markdown backticks.

Extract these exact fields (use null if not found):
{
  "propertyName": string (name of the property e.g. "Seacrest Apartments"),
  "propertyAddress": string (full street address e.g. "215 S Seacrest Blvd, Boynton Beach, FL 33435"),
  "price": number (purchase/list price in dollars),
  "tu": number (total units),
  "ou": number (occupied units — use total units if 100% occupied),
  "rent": number (average rent per unit per month in dollars. Use the broker's stated average/scheduled rent from the financial summary or rent roll summary table — NOT calculated by averaging individual unit rents from the rent roll, and NOT including vacant units at $0),
  "vp": number (vacancy rate as a percentage — IMPORTANT: use ONLY the vacancy percentage explicitly stated by the broker in their financial summary, e.g. "5% vacancy". Do NOT compute this by dividing vacant units by total units),
  "lev": number (LTV as a percentage. Look in the Financing section for Loan Amount, Down Payment, LTV. If loan amount and price found, calculate LTV% = (loan / price) * 100. If down payment % found, LTV% = 100 - down%. Example: price=$1,950,000 loan=$1,300,000 → lev=66.67),
  "ir": number (interest rate percentage. Look for Interest Rate in the Financing section. Return number only e.g. 6.00 for 6.00%),
  "am": number (amortization in years. Look for Amortization in the Financing section e.g. 30 Years → return 30),
  "tax": number (annual real estate taxes in dollars),
  "ins": number (insurance per door per year — divide total by units if needed),
  "util": number (annual utilities in dollars),
  "rm": number (repairs and maintenance per unit per year),
  "cs": number (contract services annual total),
  "ga": number (general and administrative annual total),
  "res": number (reserves per unit per year),
  "pm": number (property management percentage of EGI),
  "yearBuilt": number (year the property was built, e.g. 1935. Look in property details or site description section),
  "otherIncome": array of objects with "label" (string) and "amount" (number, annual dollars) for each additional income line item the seller lists beyond base rent (e.g. laundry income, parking income, storage income, RUBS, pet fees). Return empty array [] if none found.
}

For propertyName and propertyAddress: look at cover page, title, headers. Almost always present — do not return null unless truly absent.
For lev/ir/am: look in the Financing or Financial Summary section — typically a box showing Loan Amount, Interest Rate, and Amortization. Do not return null without thoroughly searching these sections.
For vp: look for the broker's stated vacancy percentage in their income analysis or financial summary. Use their exact stated figure. Do NOT calculate it from unit counts.
For otherIncome: scan the income section for any line items beyond collected rent. Common examples: laundry income, other income, parking, storage. Include each as a separate object with its annual dollar amount.

Be precise with all other figures. Convert monthly figures to annual where needed.`,
        messages: [{
          role: 'user',
          content: [
            ...pdfContents,
            { type: 'text', text: 'Extract the investment property data from this offering memorandum and return only the JSON object.' }
          ]
        }]
      })
    })

    const data = await response.json()
    const text = data.content?.find((b: any) => b.type === 'text')?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? 'Extraction failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
