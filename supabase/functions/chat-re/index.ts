import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PREAMBLE = `You are an expert real estate investment analyst embedded in a deal analysis application called RE Analyzer Pro. You help investors analyze multifamily and commercial property deals.

Your capabilities:
- Analyze deal financials (NOI, cap rate, DSCR, cash-on-cash, after-tax returns)
- Explain underwriting assumptions and flag risks
- Compare metrics to market benchmarks
- Discuss 1031 exchange strategies, depreciation, and tax benefits
- Advise on deal structure, financing, and negotiation
- Answer general commercial real estate investing questions

Rules:
- You have READ-ONLY access to deal data. Never suggest you can modify inputs or save changes.
- Be concise and direct. Use specific numbers from the deal context when available.
- ALWAYS answer general real estate, tax, financing, legal, 1031, and depreciation questions — even when deal data is loaded. The deal context is supplementary, not a restriction on what topics you can discuss.
- If a question is completely unrelated to real estate or investing, politely decline and redirect.
- Format currency with $ and commas. Format percentages with one decimal.
- When no deal context is provided, answer general RE questions but note you don't have a specific deal loaded.`

function buildSystemPrompt(dealContext: any): string {
  if (!dealContext) return SYSTEM_PREAMBLE

  let contextBlock = '\n\n--- CURRENT DEAL DATA ---\n'

  if (dealContext.property) {
    const p = dealContext.property
    contextBlock += `\nPROPERTY: ${p.name}`
    if (p.address) contextBlock += ` | ${p.address}`
    if (p.units) contextBlock += ` | ${p.units} units`
    if (p.yearBuilt) contextBlock += ` | Built ${p.yearBuilt}`
    if (p.status) contextBlock += ` | Status: ${p.status}`
    contextBlock += '\n'
  }

  if (dealContext.scenario) {
    const s = dealContext.scenario
    contextBlock += `\nSCENARIO: ${s.name}\n`
    if (s.inputs) {
      const i = s.inputs
      contextBlock += `  Purchase Price: $${(i.price || 0).toLocaleString()}\n`
      contextBlock += `  Units: ${i.tu} total, ${i.ou} occupied\n`
      contextBlock += `  Avg Rent: $${(i.rent || 0).toLocaleString()}/unit/mo\n`
      contextBlock += `  Vacancy: ${i.vp}%\n`
      contextBlock += `  LTV: ${i.lev}% | Rate: ${i.ir}% | Amort: ${i.am}yr\n`
      contextBlock += `  Taxes: $${(i.tax || 0).toLocaleString()}/yr\n`
      contextBlock += `  Insurance: $${(i.ins || 0).toLocaleString()}/door/yr\n`
      contextBlock += `  PM: ${i.pmMode === 'unit' ? `$${i.pmPerUnit}/unit/mo` : `${i.pm}% of EGI`}\n`
      if (i.is1031) contextBlock += `  1031 Exchange: Yes (basis $${(i.basis1031 || 0).toLocaleString()}, equity $${(i.equity1031 || 0).toLocaleString()})\n`
      contextBlock += `  Tax Bracket: ${i.brk}% | Land: ${i.land}% | Cost Seg: ${i.costSeg}%\n`
    }
  }

  if (dealContext.outputs) {
    const o = dealContext.outputs
    contextBlock += `\nCALCULATED P&L:\n`
    contextBlock += `  GSR: $${(o.GSR || 0).toLocaleString()} | EGI: $${(o.EGI || 0).toLocaleString()}\n`
    contextBlock += `  Total Expenses: $${(o.exp || 0).toLocaleString()}\n`
    contextBlock += `  NOI: $${(o.NOI || 0).toLocaleString()}\n`
    contextBlock += `  Cap Rate: ${(o.cap || 0).toFixed(1)}%\n`
    contextBlock += `  Debt Service: $${(o.ds || 0).toLocaleString()} | DSCR: ${(o.dcr || 0).toFixed(2)}x\n`
    contextBlock += `  Cash Flow: $${(o.CF || 0).toLocaleString()}\n`
    contextBlock += `  Cash-on-Cash: ${(o.coc || 0).toFixed(1)}% | After-Tax CoC: ${(o.atc || 0).toFixed(1)}%\n`
    contextBlock += `  Equity to Close: $${(o.eq || 0).toLocaleString()}\n`
    contextBlock += `  Loan: $${(o.loan || 0).toLocaleString()} | Down: $${(o.down || 0).toLocaleString()}\n`
    if (o.bd) contextBlock += `  Bonus Depreciation: $${(o.bd || 0).toLocaleString()}\n`
    if (o.ts) contextBlock += `  Year 1 Tax Savings: $${(o.ts || 0).toLocaleString()}\n`
    if (o.r1) contextBlock += `  Year 1 Total Return: ${(o.r1 || 0).toFixed(1)}%\n`
  }

  if (dealContext.pipeline) {
    const pl = dealContext.pipeline
    contextBlock += `\nPIPELINE STATUS:\n`
    if (pl.milestones?.length) {
      contextBlock += `  Milestones: ${pl.milestones.filter((m: any) => m.status === 'complete').length}/${pl.milestones.length} complete\n`
    }
    if (pl.keyDates) {
      const kd = pl.keyDates
      if (kd.closingDate) contextBlock += `  Closing Date: ${kd.closingDate}\n`
      if (kd.inspectionDeadline) contextBlock += `  Inspection Deadline: ${kd.inspectionDeadline}\n`
      if (kd.financingDeadline) contextBlock += `  Financing Deadline: ${kd.financingDeadline}\n`
    }
  }

  return SYSTEM_PREAMBLE + contextBlock
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { messages, dealContext } = await req.json()

    if (!messages || !messages.length) {
      return new Response(JSON.stringify({ error: 'No messages provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const systemPrompt = buildSystemPrompt(dealContext)

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
        system: systemPrompt,
        messages: messages.map((m: any) => ({
          role: m.role,
          content: m.content,
        })),
      })
    })

    const data = await response.json()

    if (data.error) {
      console.error('[chat-re] API error:', JSON.stringify(data.error))
      return new Response(JSON.stringify({ error: data.error.message ?? 'API request failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const text = data.content?.find((b: any) => b.type === 'text')?.text ?? ''

    return new Response(JSON.stringify({ content: text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e: any) {
    console.error('[chat-re] Error:', e.message)
    return new Response(JSON.stringify({ error: e.message ?? 'Chat failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
