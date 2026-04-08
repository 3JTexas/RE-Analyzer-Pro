import { useState, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Circle, CircleMarker, Popup, useMap } from 'react-leaflet'
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import 'leaflet/dist/leaflet.css'

interface CrimeIncident {
  incident_code: string
  incident_date: string
  incident_offense: string
  incident_offense_code: string
  incident_offense_description: string
  incident_offense_detail_description: string
  incident_offense_crime_against: string
  incident_latitude: number
  incident_longitude: number
  incident_address: string
  incident_source_name: string
}

interface Props {
  lat?: number
  lng?: number
  propertyName: string
  propertyAddress: string
  pipelineId: string
}

// Crime category colors
const CRIME_COLORS: Record<string, { color: string; label: string }> = {
  Person: { color: '#DC2626', label: 'Violent (Person)' },
  Property: { color: '#D97706', label: 'Property' },
  Society: { color: '#7C3AED', label: 'Society' },
  'Not a Crime': { color: '#6B7280', label: 'Other' },
}

const RING_CONFIG = [
  { radius: 804.67, label: '0.5 mi', color: '#22C55E', opacity: 0.15 },   // 0.5 miles in meters
  { radius: 1609.34, label: '1 mi', color: '#EAB308', opacity: 0.10 },     // 1 mile
  { radius: 3218.69, label: '2 mi', color: '#EF4444', opacity: 0.07 },     // 2 miles
]

function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8 // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function FitBounds({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], 13)
  }, [lat, lng, map])
  return null
}

export function CrimeMap({ lat: latProp, lng: lngProp, propertyName, propertyAddress, pipelineId }: Props) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    latProp && lngProp ? { lat: latProp, lng: lngProp } : null
  )
  const [geocoding, setGeocoding] = useState(false)
  const [incidents, setIncidents] = useState<CrimeIncident[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetched, setFetched] = useState(false)
  const [filter, setFilter] = useState<string | null>(null)

  // Geocode address if no coords provided
  useEffect(() => {
    if (coords || !propertyAddress) return
    setGeocoding(true)
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(propertyAddress)}&format=json&limit=1`, {
      headers: { 'User-Agent': 'RE-Analyzer-Pro/1.0' }
    })
      .then(r => r.json())
      .then(data => {
        if (data[0]) setCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) })
        else setError('Could not geocode address')
      })
      .catch(() => setError('Geocoding failed'))
      .finally(() => setGeocoding(false))
  }, [propertyAddress, coords])

  const lat = coords?.lat ?? 0
  const lng = coords?.lng ?? 0

  const fetchCrimeData = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('crime-data', {
        body: { lat, lon: lng, distance: '2mi' },
      })
      if (fnError) throw new Error(fnError.message)
      if (data.error) throw new Error(data.error)
      setIncidents(data.incidents || [])
      setFetched(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Categorize incidents by ring
  const ringStats = useMemo(() => {
    const stats = [
      { label: '< 0.5 mi', count: 0, violent: 0, property: 0 },
      { label: '0.5–1 mi', count: 0, violent: 0, property: 0 },
      { label: '1–2 mi', count: 0, violent: 0, property: 0 },
    ]
    for (const inc of incidents) {
      const d = distanceMiles(lat, lng, inc.incident_latitude, inc.incident_longitude)
      const idx = d <= 0.5 ? 0 : d <= 1 ? 1 : 2
      stats[idx].count++
      if (inc.incident_offense_crime_against === 'Person') stats[idx].violent++
      if (inc.incident_offense_crime_against === 'Property') stats[idx].property++
    }
    return stats
  }, [incidents, lat, lng])

  // Category totals for legend
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const inc of incidents) {
      const cat = inc.incident_offense_crime_against || 'Other'
      totals[cat] = (totals[cat] || 0) + 1
    }
    return totals
  }, [incidents])

  const filtered = useMemo(() =>
    filter ? incidents.filter(i => i.incident_offense_crime_against === filter) : incidents
  , [incidents, filter])

  if (geocoding) {
    return (
      <div className="text-center py-12">
        <Loader2 size={24} className="animate-spin text-gray-400 mx-auto mb-3" />
        <p className="text-xs text-gray-500">Geocoding address...</p>
      </div>
    )
  }

  if (!coords) {
    return (
      <div className="text-center py-12">
        <AlertTriangle size={24} className="text-red-400 mx-auto mb-3" />
        <p className="text-xs text-red-600">Could not determine property coordinates</p>
        <p className="text-[10px] text-gray-400 mt-1">Address: {propertyAddress}</p>
      </div>
    )
  }

  if (!fetched && !loading) {
    return (
      <div className="text-center py-12">
        <AlertTriangle size={32} className="text-gray-200 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-600 mb-1">Crime Map</p>
        <p className="text-xs text-gray-400 mb-4">Fetch crime incidents within 2 miles of {propertyAddress}</p>
        <p className="text-[10px] text-gray-400 mb-4">Coordinates: {lat.toFixed(4)}, {lng.toFixed(4)}</p>
        <button onClick={fetchCrimeData}
          className="px-6 py-2.5 text-xs font-semibold bg-[#1a1a2e] text-white rounded-lg hover:bg-[#c9a84c] hover:text-[#1a1a2e] transition-colors">
          Load Crime Data
        </button>
        <p className="text-[9px] text-gray-400 mt-2">Uses 1 Crimeometer API call · Last 12 months · 2 mi radius</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 size={24} className="animate-spin text-[#c9a84c] mx-auto mb-3" />
        <p className="text-xs text-gray-500">Fetching crime data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle size={24} className="text-red-400 mx-auto mb-3" />
        <p className="text-xs text-red-600 mb-3">{error}</p>
        <button onClick={fetchCrimeData}
          className="px-4 py-2 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">
          <RefreshCw size={12} className="inline mr-1" /> Retry
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {ringStats.map((ring, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-[10px] text-gray-500 mb-1">{ring.label}</div>
            <div className="text-xl font-semibold text-gray-900">{ring.count}</div>
            <div className="flex gap-2 mt-1">
              <span className="text-[9px] text-red-600">{ring.violent} violent</span>
              <span className="text-[9px] text-amber-600">{ring.property} property</span>
            </div>
          </div>
        ))}
      </div>

      {/* Legend / filters */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-[10px] text-gray-500 font-medium">Filter:</span>
        <button onClick={() => setFilter(null)}
          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${!filter ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-500 hover:border-gray-400'}`}>
          All ({incidents.length})
        </button>
        {Object.entries(CRIME_COLORS).map(([key, cfg]) => {
          const count = categoryTotals[key] || 0
          if (count === 0) return null
          return (
            <button key={key} onClick={() => setFilter(filter === key ? null : key)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors flex items-center gap-1
                ${filter === key ? 'text-white border-transparent' : 'border-gray-300 text-gray-500 hover:border-gray-400'}`}
              style={filter === key ? { backgroundColor: cfg.color, borderColor: cfg.color } : undefined}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: cfg.color }} />
              {cfg.label} ({count})
            </button>
          )
        })}
        <button onClick={fetchCrimeData} className="ml-auto text-[10px] text-gray-400 hover:text-[#c9a84c] transition-colors flex items-center gap-1">
          <RefreshCw size={10} /> Refresh
        </button>
      </div>

      {/* Map */}
      <div className="border border-gray-200 rounded-lg overflow-hidden" style={{ height: 500 }}>
        <MapContainer center={[lat, lng]} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds lat={lat} lng={lng} />

          {/* Concentric rings */}
          {RING_CONFIG.map((ring, i) => (
            <Circle key={i} center={[lat, lng]} radius={ring.radius}
              pathOptions={{ color: ring.color, fillColor: ring.color, fillOpacity: ring.opacity, weight: 2, dashArray: '6 4' }} />
          ))}

          {/* Property marker */}
          <CircleMarker center={[lat, lng]} radius={8}
            pathOptions={{ color: '#1a1a2e', fillColor: '#c9a84c', fillOpacity: 1, weight: 3 }}>
            <Popup>
              <div className="text-xs">
                <strong>{propertyName}</strong><br />
                {propertyAddress}
              </div>
            </Popup>
          </CircleMarker>

          {/* Crime incident pins */}
          {filtered.map((inc, i) => {
            const cat = inc.incident_offense_crime_against || 'Not a Crime'
            const cfg = CRIME_COLORS[cat] || CRIME_COLORS['Not a Crime']
            const dist = distanceMiles(lat, lng, inc.incident_latitude, inc.incident_longitude)
            return (
              <CircleMarker key={inc.incident_code || i}
                center={[inc.incident_latitude, inc.incident_longitude]}
                radius={4}
                pathOptions={{ color: cfg.color, fillColor: cfg.color, fillOpacity: 0.7, weight: 1 }}>
                <Popup>
                  <div className="text-[11px] leading-relaxed" style={{ minWidth: 180 }}>
                    <strong style={{ color: cfg.color }}>{inc.incident_offense}</strong><br />
                    {inc.incident_offense_description && <span className="text-gray-600">{inc.incident_offense_description}<br /></span>}
                    {inc.incident_address && <span className="text-gray-500">{inc.incident_address}<br /></span>}
                    <span className="text-gray-400">
                      {new Date(inc.incident_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {' · '}{dist.toFixed(2)} mi away
                    </span>
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>
      </div>

      {/* Ring legend */}
      <div className="flex items-center justify-center gap-4 mt-2">
        {RING_CONFIG.map(ring => (
          <div key={ring.label} className="flex items-center gap-1 text-[9px] text-gray-400">
            <span className="w-3 h-0.5 inline-block rounded" style={{ backgroundColor: ring.color }} />
            {ring.label}
          </div>
        ))}
      </div>
    </div>
  )
}
