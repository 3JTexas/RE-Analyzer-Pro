import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { lat, lon, distance, datetime_ini, datetime_end } = await req.json()

    if (!lat || !lon) {
      return new Response(JSON.stringify({ error: 'lat and lon required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rapidApiKey = Deno.env.get('CRIMEOMETER_RAPIDAPI_KEY')
    const apiKey = Deno.env.get('CRIMEOMETER_API_KEY')

    if (!rapidApiKey || !apiKey) {
      return new Response(JSON.stringify({ error: 'API keys not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Default to last 12 months, 2 mile radius
    const now = new Date()
    const oneYearAgo = new Date(now)
    oneYearAgo.setFullYear(now.getFullYear() - 1)
    const fmtDate = (d: Date) => d.toISOString().split('T')[0]
    const dtEnd = datetime_end || fmtDate(now)
    const dtStart = datetime_ini || fmtDate(oneYearAgo)
    const dist = distance || '2mi'

    // Fetch all pages (GET request to RapidAPI)
    let allIncidents: any[] = []
    let page = 1
    let totalPages = 1

    while (page <= totalPages && page <= 5) {
      const url = `https://crimeometer.p.rapidapi.com/raw-data/?lat=${lat}&lon=${lon}&distance=${dist}&datetime_ini=${dtStart}&datetime_end=${dtEnd}&page=${page}`

      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'x-rapidapi-host': 'crimeometer.p.rapidapi.com',
          'x-rapidapi-key': rapidApiKey,
        },
      })

      if (!resp.ok) {
        const errText = await resp.text()
        return new Response(JSON.stringify({ error: `Crimeometer API error: ${resp.status}`, detail: errText }), {
          status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const data = await resp.json()
      totalPages = data.total_pages || 1
      allIncidents = allIncidents.concat(data.incidents || [])
      page++
    }

    return new Response(JSON.stringify({
      total_incidents: allIncidents.length,
      incidents: allIncidents,
      center: { lat, lon },
      distance: dist,
      datetime_ini: dtStart,
      datetime_end: dtEnd,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
