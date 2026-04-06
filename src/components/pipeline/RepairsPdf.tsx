import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { RepairEstimate } from '../../types/pipeline'

const C = { text: '#1a1a2e', gray: '#666', muted: '#888', accent: '#c9a84c', red: '#A32D2D', border: '#E5E3DC' }

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, color: C.text, padding: '0.75in' },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: C.text, marginBottom: 4 },
  subtitle: { fontSize: 10, color: C.gray, marginBottom: 16 },
  orangeLine: { height: 2, backgroundColor: C.accent, marginBottom: 16 },
  sectionHdr: { backgroundColor: '#F5F4F0', fontFamily: 'Helvetica-Bold', fontSize: 9, padding: '5 8',
    marginTop: 12, marginBottom: 6, borderBottomWidth: 0.5, borderBottomColor: C.border, color: C.text },
  tableHdr: { flexDirection: 'row', backgroundColor: C.text, padding: '6 8' },
  tableHdrText: { color: 'white', fontSize: 8, fontFamily: 'Helvetica-Bold' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.3, borderBottomColor: C.border, padding: '5 8' },
  tableRowAlt: { flexDirection: 'row', borderBottomWidth: 0.3, borderBottomColor: C.border, padding: '5 8', backgroundColor: '#FAFAF8' },
  totalRow: { flexDirection: 'row', backgroundColor: '#F5F4F0', borderTopWidth: 1, borderTopColor: C.border, padding: '6 8' },
  disclaimer: { fontSize: 7.5, color: C.muted, marginTop: 20, lineHeight: 1.5, borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 8 },
})

const fmtD = (n: number) => `$${Math.round(n).toLocaleString()}`

const sevLabel: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' }
const statLabel: Record<string, string> = { pending: 'Pending', approved: 'Approved', completed: 'Completed' }

interface Props {
  repairs: RepairEstimate[]
  propertyName: string
  propertyAddress: string | null
  totalCost: number
}

export function RepairsPdf({ repairs, propertyName, propertyAddress, totalCost }: Props) {
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const criticalItems = repairs.filter(r => r.severity === 'critical' || r.severity === 'high')

  return (
    <Document title={`Repair Estimates — ${propertyName}`}>
      <Page size="LETTER" style={s.page}>
        <Text style={s.title}>Repair Estimates</Text>
        <Text style={s.subtitle}>{propertyName}{propertyAddress ? ` — ${propertyAddress}` : ''}</Text>
        <View style={s.orangeLine} />

        <Text style={{ fontSize: 9, color: C.gray, marginBottom: 12 }}>
          Prepared {date} · {repairs.length} item{repairs.length !== 1 ? 's' : ''} · Total estimated cost: {fmtD(totalCost)}
        </Text>

        {criticalItems.length > 0 && (
          <View style={{ backgroundColor: '#FCEBEB', borderWidth: 0.5, borderColor: '#f09595', borderRadius: 3, padding: '6 8', marginBottom: 10 }}>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.red }}>
              {criticalItems.length} high/critical item{criticalItems.length !== 1 ? 's' : ''} requiring immediate attention
            </Text>
          </View>
        )}

        {/* Table */}
        <View style={{ borderWidth: 0.5, borderColor: C.border, borderRadius: 3, overflow: 'hidden' }}>
          <View style={s.tableHdr}>
            <Text style={[s.tableHdrText, { flex: 3 }]}>Description</Text>
            <Text style={[s.tableHdrText, { flex: 1, textAlign: 'center' }]}>Severity</Text>
            <Text style={[s.tableHdrText, { flex: 1.5 }]}>Contractor</Text>
            <Text style={[s.tableHdrText, { flex: 1, textAlign: 'center' }]}>Status</Text>
            <Text style={[s.tableHdrText, { flex: 1, textAlign: 'right' }]}>Est. Cost</Text>
          </View>
          {repairs.map((r, i) => (
            <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <View style={{ flex: 3 }}>
                <Text style={{ fontSize: 9 }}>{r.description}</Text>
                {r.notes ? <Text style={{ fontSize: 7.5, color: C.muted, marginTop: 1 }}>{r.notes}</Text> : null}
              </View>
              <Text style={{ flex: 1, fontSize: 9, textAlign: 'center',
                color: r.severity === 'critical' ? C.red : r.severity === 'high' ? '#C2410C' : C.gray }}>
                {sevLabel[r.severity] ?? r.severity}
              </Text>
              <Text style={{ flex: 1.5, fontSize: 9, color: C.gray }}>{r.contractor || '—'}</Text>
              <Text style={{ flex: 1, fontSize: 9, textAlign: 'center', color: C.gray }}>{statLabel[r.status] ?? r.status}</Text>
              <Text style={{ flex: 1, fontSize: 9, textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>{fmtD(r.estimatedCost)}</Text>
            </View>
          ))}
          <View style={s.totalRow}>
            <Text style={{ flex: 3, fontSize: 10, fontFamily: 'Helvetica-Bold' }}>Total Estimated Cost</Text>
            <Text style={{ flex: 1 }}></Text>
            <Text style={{ flex: 1.5 }}></Text>
            <Text style={{ flex: 1 }}></Text>
            <Text style={{ flex: 1, fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'right' }}>{fmtD(totalCost)}</Text>
          </View>
        </View>

        <Text style={s.disclaimer}>
          This repair estimate summary is provided for negotiation purposes only and does not constitute a formal bid, warranty, or guarantee.
          Actual repair costs may vary based on contractor selection, material pricing, and scope changes discovered during remediation.
          All estimates should be independently verified by licensed contractors prior to finalizing purchase terms.
        </Text>
      </Page>
    </Document>
  )
}
