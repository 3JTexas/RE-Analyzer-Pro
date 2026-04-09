import { useState, useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Circle, CircleMarker, Popup, useMap } from 'react-leaflet'
import { Upload, AlertTriangle, RefreshCw, FileText, X } from 'lucide-react'
import 'leaflet/dist/leaflet.css'

interface CrimeIncident {
  date: string
  type: string
  description: string
  address: string
  lat: number
  lng: number
  source?: string
}

interface Props {
  lat?: number
  lng?: number
  propertyName: string
  propertyAddress: string
  pipelineId: string
}

// Crime category colors — match by keyword in type/description
function categorize(type: string): { color: string; label: string } {
  const t = (type || '').toLowerCase()
  if (t.includes('assault') || t.includes('robbery') || t.includes('murder') || t.includes('homicide') || t.includes('battery') || t.includes('shooting') || t.includes('rape') || t.includes('kidnap'))
    return { color: '#DC2626', label: 'Violent' }
  if (t.includes('burglary') || t.includes('theft') || t.includes('larceny') || t.includes('vehicle') || t.includes('shoplifting') || t.includes('vandalism') || t.includes('arson') || t.includes('trespass'))
    return { color: '#D97706', label: 'Property' }
  if (t.includes('drug') || t.includes('narcotic') || t.includes('dui') || t.includes('alcohol') || t.includes('prostitution'))
    return { color: '#7C3AED', label: 'Drug/Vice' }
  return { color: '#6B7280', label: 'Other' }
}

const RING_CONFIG = [
  { radius: 804.67, label: '0.5 mi', color: '#22C55E', opacity: 0.15 },
  { radius: 1609.34, label: '1 mi', color: '#EAB308', opacity: 0.10 },
  { radius: 3218.69, label: '2 mi', color: '#EF4444', opacity: 0.07 },
]

function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function FitBounds({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => { map.setView([lat, lng], 13) }, [lat, lng, map])
  return null
}

// Auto-detect CSV columns
function detectColumns(headers: string[]): { lat?: string; lng?: string; date?: string; type?: string; description?: string; address?: string } {
  const h = headers.map(s => s.toLowerCase().trim())
  const find = (candidates: string[]) => {
    const idx = h.findIndex(col => candidates.some(c => col.includes(c)))
    return idx >= 0 ? headers[idx] : undefined
  }
  return {
    lat: find(['latitude', 'lat', 'y_coord', 'ycoord', 'point_y']),
    lng: find(['longitude', 'lon', 'lng', 'x_coord', 'xcoord', 'point_x']),
    date: find(['date', 'occurred', 'incident_date', 'report_date', 'datetime']),
    type: find(['type', 'offense', 'crime_type', 'category', 'ucr', 'incident_type', 'description']),
    description: find(['description', 'offense_description', 'narrative', 'details', 'crime_description']),
    address: find(['address', 'location', 'block', 'street', 'incident_address', 'block_address']),
  }
}

function parseCSV(text: string): CrimeIncident[] {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  // Handle both comma and tab delimited
  const delimiter = lines[0].includes('\t') ? '\t' : ','
  const headers = lines[0].split(delimiter).map(h => h.replace(/^"|"$/g, '').trim())
  const cols = detectColumns(headers)

  if (!cols.lat || !cols.lng) {
    // Try to geocode from address later — for now require lat/lng
    console.warn('CSV missing lat/lng columns. Headers:', headers)
  }

  const incidents: CrimeIncident[] = []
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(delimiter).map(v => v.replace(/^"|"$/g, '').trim())
    const row: Record<string, string> = {}
    headers.forEach((h, j) => { row[h] = vals[j] ?? '' })

    const lat = parseFloat(row[cols.lat ?? ''] ?? '')
    const lng = parseFloat(row[cols.lng ?? ''] ?? '')
    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) continue

    incidents.push({
      date: row[cols.date ?? ''] ?? '',
      type: row[cols.type ?? ''] ?? 'Unknown',
      description: row[cols.description ?? ''] ?? '',
      address: row[cols.address ?? ''] ?? '',
      lat, lng,
      source: 'CSV Import',
    })
  }
  return incidents
}

export function CrimeMap({ lat: latProp, lng: lngProp, propertyName, propertyAddress, pipelineId }: Props) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    latProp && lngProp ? { lat: latProp, lng: lngProp } : null
  )
  const [geocoding, setGeocoding] = useState(false)
  const [incidents, setIncidents] = useState<CrimeIncident[]>([])
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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

  const handleFileUpload = (file: File) => {
    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const parsed = parseCSV(text)
        if (parsed.length === 0) {
          setError('No incidents found in file. Make sure it has latitude/longitude columns.')
          return
        }
        setIncidents(parsed)
      } catch (err: any) {
        setError(`Failed to parse file: ${err.message}`)
      }
    }
    reader.readAsText(file)
  }

  // Ring stats
  const ringStats = useMemo(() => {
    const stats = [
      { label: '< 0.5 mi', count: 0, violent: 0, property: 0 },
      { label: '0.5–1 mi', count: 0, violent: 0, property: 0 },
      { label: '1–2 mi', count: 0, violent: 0, property: 0 },
    ]
    for (const inc of incidents) {
      const d = distanceMiles(lat, lng, inc.lat, inc.lng)
      const idx = d <= 0.5 ? 0 : d <= 1 ? 1 : 2
      if (idx < 3) {
        stats[idx].count++
        const cat = categorize(inc.type)
        if (cat.label === 'Violent') stats[idx].violent++
        if (cat.label === 'Property') stats[idx].property++
      }
    }
    return stats
  }, [incidents, lat, lng])

  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const inc of incidents) {
      const cat = categorize(inc.type).label
      totals[cat] = (totals[cat] || 0) + 1
    }
    return totals
  }, [incidents])

  const filtered = useMemo(() =>
    filter ? incidents.filter(i => categorize(i.type).label === filter) : incidents
  , [incidents, filter])

  if (geocoding) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-[#c9a84c] rounded-full mx-auto mb-3" />
        <p className="text-xs text-gray-500">Geocoding address...</p>
      </div>
    )
  }

  if (!coords) {
    return (
      <div className="text-center py-12">
        <AlertTriangle size={24} className="text-red-400 mx-auto mb-3" />
        <p className="text-xs text-red-600">Could not determine property coordinates</p>
      </div>
    )
  }

  // No data loaded yet
  if (incidents.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText size={32} className="text-gray-200 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-600 mb-1">Crime Map</p>
        <p className="text-xs text-gray-400 mb-1">{propertyAddress}</p>
        <p className="text-[10px] text-gray-400 mb-4">Coordinates: {lat.toFixed(4)}, {lng.toFixed(4)}</p>

        <div className="max-w-sm mx-auto">
          <p className="text-xs text-gray-500 mb-3">Upload crime data CSV from <a href="https://www.crimemapping.com/map/fl/palmbeachcounty" target="_blank" rel="noopener noreferrer" className="text-[#c9a84c] hover:underline">CrimeMapping.com</a></p>
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-[#c9a84c] transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
            onDrop={e => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f) }}>
            <Upload size={20} className="text-gray-400 mx-auto mb-2" />
            <p className="text-xs text-gray-500">Drop CSV/Excel here or click to browse</p>
            <p className="text-[9px] text-gray-400 mt-1">Needs latitude & longitude columns</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xlsx" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = '' }} />
        </div>

        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

        <div className="mt-6 bg-gray-50 rounded-lg p-4 max-w-md mx-auto text-left">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">How to get crime data:</p>
          <ol className="text-[10px] text-gray-500 space-y-1 list-decimal list-inside">
            <li>Go to <a href="https://www.crimemapping.com/map/fl/palmbeachcounty" target="_blank" rel="noopener noreferrer" className="text-[#c9a84c] hover:underline">CrimeMapping.com (Palm Beach County)</a></li>
            <li>Search for the property address</li>
            <li>Set your date range and radius</li>
            <li>Click the download/export button to get a spreadsheet</li>
            <li>Save as CSV and upload here</li>
          </ol>
        </div>
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
        {Object.entries(categoryTotals).map(([label, count]) => {
          const cfg = categorize(label)
          return (
            <button key={label} onClick={() => setFilter(filter === label ? null : label)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors flex items-center gap-1
                ${filter === label ? 'text-white border-transparent' : 'border-gray-300 text-gray-500 hover:border-gray-400'}`}
              style={filter === label ? { backgroundColor: cfg.color, borderColor: cfg.color } : undefined}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: cfg.color }} />
              {label} ({count})
            </button>
          )
        })}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => fileRef.current?.click()} className="text-[10px] text-gray-400 hover:text-[#c9a84c] transition-colors flex items-center gap-1">
            <Upload size={10} /> Upload new data
          </button>
          <button onClick={() => setIncidents([])} className="text-[10px] text-gray-400 hover:text-red-400 transition-colors flex items-center gap-1">
            <X size={10} /> Clear
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = '' }} />
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
            const cat = categorize(inc.type)
            const dist = distanceMiles(lat, lng, inc.lat, inc.lng)
            return (
              <CircleMarker key={i}
                center={[inc.lat, inc.lng]}
                radius={4}
                pathOptions={{ color: cat.color, fillColor: cat.color, fillOpacity: 0.7, weight: 1 }}>
                <Popup>
                  <div className="text-[11px] leading-relaxed" style={{ minWidth: 180 }}>
                    <strong style={{ color: cat.color }}>{inc.type}</strong><br />
                    {inc.description && inc.description !== inc.type && <span className="text-gray-600">{inc.description}<br /></span>}
                    {inc.address && <span className="text-gray-500">{inc.address}<br /></span>}
                    <span className="text-gray-400">
                      {inc.date && `${inc.date} · `}{dist.toFixed(2)} mi away
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
