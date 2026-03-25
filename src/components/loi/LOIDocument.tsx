import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { LOIData } from '../../types/loi'

// ── Colors & Styles ──────────────────────────────────────────────────────
const C = { text: '#1a1a2e', gray: '#666666' }

const s = StyleSheet.create({
  page: { fontFamily: 'Times-Roman', fontSize: 10.5, color: C.text, padding: '1.1in', lineHeight: 1.52 },
  sectionHead: { fontFamily: 'Times-Bold', fontSize: 11, marginTop: 8, marginBottom: 2 },
  normal: { fontSize: 10.5, lineHeight: 1.52, marginBottom: 4 },
  bold: { fontFamily: 'Times-Bold', fontSize: 10.5, lineHeight: 1.52 },
  bullet: { fontSize: 10.5, lineHeight: 1.52, marginLeft: 16, marginBottom: 2 },
  subBullet: { fontSize: 10.5, lineHeight: 1.52, marginLeft: 32, marginBottom: 2 },
  hr: { borderBottomWidth: 0.5, borderBottomColor: '#cccccc', marginVertical: 8 },
  sigLabel: { fontFamily: 'Times-Bold', fontSize: 10, marginTop: 10 },
  sigLine: { borderBottomWidth: 0.5, borderBottomColor: '#333', width: 200, marginTop: 24, marginBottom: 2 },
  sigText: { fontSize: 9.5, color: C.gray },
  blank: { borderBottomWidth: 0.5, borderBottomColor: '#333', width: 144, display: 'flex' },
  numberedHead: { fontFamily: 'Times-Bold', fontSize: 11, marginTop: 10, marginBottom: 3 },
  indent: { marginLeft: 16 },
})

// Helper: render value or blank underline
function V({ v }: { v: string }) {
  return v ? <Text>{v}</Text> : <View style={s.blank} />
}

function InlineV({ v }: { v: string }) {
  return v || '____________'
}

// ── Original LOI (lean 2-page format) ────────────────────────────────────
function OriginalLOI({ data }: { data: LOIData }) {
  const d = data
  return (
    <Document title={`LOI - ${d.propertyName}`}>
      <Page size="LETTER" style={s.page}>
        <Text style={s.normal}>{d.date}</Text>
        <Text style={s.normal}>VIA EMAIL</Text>
        <View style={s.hr} />

        <Text style={s.normal}>{InlineV({ v: d.recipientNames })}</Text>
        <Text style={[s.normal, { marginBottom: 8 }]}>
          RE: Letter of Intent — {d.propertyName || '____________'}, {d.propertyAddress || '____________'}
        </Text>
        <View style={s.hr} />

        <Text style={s.normal}>
          Dear {InlineV({ v: d.recipientNames })},
        </Text>
        <Text style={s.normal}>
          This Letter of Intent ("LOI") sets forth the general terms pursuant to which {InlineV({ v: d.purchaserName })} ("Purchaser")
          proposes to acquire the property known as {InlineV({ v: d.propertyName })} located at {InlineV({ v: d.propertyAddress })} (the "Property"),
          more particularly described below:
        </Text>

        <Text style={s.sectionHead}>Property</Text>
        <Text style={s.bullet}>• {d.propertyName || '____________'}, {d.propertyAddress || '____________'}</Text>
        <Text style={s.subBullet}>- {d.units || '____'} residential units</Text>

        <Text style={s.sectionHead}>Purchaser</Text>
        <Text style={s.normal}>{InlineV({ v: d.purchaserName })}</Text>

        <Text style={s.sectionHead}>Seller</Text>
        <Text style={s.normal}>{InlineV({ v: d.sellerName })}</Text>

        <Text style={s.sectionHead}>Property Alterations</Text>
        <Text style={s.normal}>
          Neither Party shall make any material alterations, changes or improvements to the Property, or enter into any agreement
          to make any such alterations, changes or improvements, from the date of execution of a purchase and sale agreement
          through the date of Closing, without the prior written consent of the other Party.
        </Text>

        <Text style={s.sectionHead}>Purchase Price</Text>
        <Text style={s.normal}>{InlineV({ v: d.purchasePrice })}</Text>

        <Text style={s.sectionHead}>Earnest Money Deposit</Text>
        <Text style={s.normal}>
          {InlineV({ v: d.earnestDeposit })}, deposited with the Title Company within three (3) business days of execution of the
          Purchase and Sale Agreement. The Earnest Money Deposit shall be fully refundable during the Due Diligence Period.
        </Text>

        <Text style={s.sectionHead}>Due Diligence Period</Text>
        <Text style={s.normal}>
          {InlineV({ v: d.ddPeriodDays })} days from the date of execution of the Purchase and Sale Agreement.
          Seller shall deliver the following within {InlineV({ v: d.ddDeliveryDays })} business days of LOI execution:
          current certified rent roll, trailing 24-month operating statements, copies of all leases, trailing 24-month
          utility bills, current and prior year property tax bills, all service contracts, vendor agreements, and warranties,
          and current rent payment status for all units including any delinquencies, partial payments, or payment plans in effect.
        </Text>
        <Text style={s.normal}>
          Within two (2) business days of PSA execution, Seller shall deliver copies of Seller's existing title insurance
          policy, all recorded documents referenced therein, and Seller's existing survey. Seller shall also deliver:
          (i) certificate of occupancy and all existing building, fire, and life-safety inspection reports;
          (ii) any existing environmental, engineering, or survey reports in Seller's possession;
          (iii) insurance loss runs for the prior five (5) years; and
          (iv) written disclosure of any pending or threatened litigation, code violations, liens, or governmental orders
          affecting the Property. As a condition of closing, Seller shall obtain and deliver a signed estoppel certificate
          from each tenant confirming the terms of their tenancy and the absence of any landlord defaults or side
          agreements not reflected in the lease.
        </Text>

        <Text style={s.sectionHead}>Financing</Text>
        <Text style={s.bullet}>• Purchaser shall obtain financing for not less than {InlineV({ v: d.loanAmountMin })}</Text>
        <Text style={s.bullet}>• Purchaser shall have {InlineV({ v: d.loanApprovalDays })} days from expiration of Due Diligence to obtain
          a loan commitment</Text>

        <Text style={s.sectionHead}>Survey and Title</Text>
        <Text style={s.normal}>
          Purchaser shall order a title commitment and survey during the Due Diligence Period. Seller shall convey
          marketable and insurable fee simple title, free and clear of all liens, encumbrances, and title defects,
          except for Permitted Exceptions as agreed to by both parties.
        </Text>

        <Text style={s.sectionHead}>Closing Date</Text>
        <Text style={s.normal}>
          Closing shall occur within {InlineV({ v: d.closingDays })} days following expiration of the Due Diligence Period,
          or such other date as mutually agreed.
        </Text>

        <Text style={s.sectionHead}>Closing Costs</Text>
        <Text style={s.normal}>
          Seller shall pay for the owner's title insurance policy, documentary stamps on the deed, and Seller's attorney fees.
          Purchaser shall pay for the lender's title insurance policy, intangible tax, recording fees, loan costs,
          and Purchaser's attorney fees. Property taxes, rents, and operating expenses shall be prorated as of the Closing date.
        </Text>

        <Text style={s.sectionHead}>Purchase and Sale Agreement</Text>
        <Text style={s.normal}>
          {InlineV({ v: d.purchaserCounsel })} shall draft the Purchase and Sale Agreement within ten (10) business days
          following execution of this LOI.
        </Text>

        <Text style={s.sectionHead}>Brokers</Text>
        <Text style={s.normal}>
          {InlineV({ v: d.recipientNames })} represents the Seller. No other brokers are involved in this transaction.
          Seller shall be responsible for all brokerage commissions.
        </Text>

        <View style={s.hr} />

        <Text style={s.normal}>
          This LOI is intended to be non-binding and is for discussion purposes only, except for the provisions
          regarding confidentiality, which shall be binding. This LOI shall expire if not executed by both parties
          within {InlineV({ v: d.loiExpirationDays })} business days from the date hereof.
        </Text>

        <Text style={[s.normal, { marginTop: 12 }]}>Sincerely,</Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
          <View>
            <Text style={s.sigLabel}>PURCHASER:</Text>
            <View style={s.sigLine} />
            <Text style={s.sigText}>{d.purchaserName || '____________'}</Text>
            <View style={[s.sigLine, { marginTop: 12 }]} />
            <Text style={s.sigText}>Date</Text>
          </View>
          <View>
            <Text style={s.sigLabel}>SELLER:</Text>
            <View style={s.sigLine} />
            <Text style={s.sigText}>{d.sellerName || '____________'}</Text>
            <View style={[s.sigLine, { marginTop: 12 }]} />
            <Text style={s.sigText}>Date</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

// ── Buyer-Friendly LOI (15 numbered sections) ────────────────────────────
function BuyerFriendlyLOI({ data }: { data: LOIData }) {
  const d = data
  return (
    <Document title={`LOI - ${d.propertyName} (Buyer-Friendly)`}>
      <Page size="LETTER" style={s.page}>
        <Text style={s.normal}>{d.date}</Text>
        <Text style={s.normal}>VIA EMAIL</Text>
        <View style={s.hr} />
        <Text style={s.normal}>{InlineV({ v: d.recipientNames })}</Text>
        <Text style={[s.normal, { marginBottom: 8 }]}>
          RE: Letter of Intent — {d.propertyName || '____________'}, {d.propertyAddress || '____________'}
        </Text>
        <View style={s.hr} />

        <Text style={s.normal}>
          Dear {InlineV({ v: d.recipientNames })},
        </Text>
        <Text style={s.normal}>
          This Letter of Intent ("LOI") sets forth the proposed terms pursuant to which {InlineV({ v: d.purchaserName })} ("Purchaser")
          proposes to acquire the property described below. Upon mutual execution, the parties shall negotiate in good faith
          toward a definitive Purchase and Sale Agreement.
        </Text>

        {/* 1. PROPERTY */}
        <Text style={s.numberedHead}>1. PROPERTY</Text>
        <Text style={s.normal}>
          The multifamily property known as {InlineV({ v: d.propertyName })} located at {InlineV({ v: d.propertyAddress })},
          consisting of {InlineV({ v: d.units })} residential units, together with all improvements, fixtures, and appurtenances
          thereto (the "Property").
        </Text>

        {/* 2. PARTIES */}
        <Text style={s.numberedHead}>2. PARTIES</Text>
        <Text style={s.bullet}>• Purchaser: {InlineV({ v: d.purchaserName })}</Text>
        <Text style={s.bullet}>• Seller: {InlineV({ v: d.sellerName })}</Text>

        {/* 3. PURCHASE PRICE */}
        <Text style={s.numberedHead}>3. PURCHASE PRICE</Text>
        <Text style={s.normal}>{InlineV({ v: d.purchasePrice })}, payable in cash and/or financing proceeds at Closing.</Text>

        {/* 4. EARNEST MONEY DEPOSIT */}
        <Text style={s.numberedHead}>4. EARNEST MONEY DEPOSIT</Text>
        <Text style={s.normal}>
          {InlineV({ v: d.earnestDeposit })}, deposited with the Title Company within three (3) business days of PSA execution.{' '}
          <Text style={s.bold}>The Earnest Money Deposit shall be fully refundable to Purchaser during the Due Diligence Period
          for any reason or no reason, in Purchaser's sole and absolute discretion.</Text>
        </Text>

        {/* 5. DUE DILIGENCE */}
        <Text style={s.numberedHead}>5. DUE DILIGENCE PERIOD & INSPECTION RIGHTS</Text>
        <Text style={s.normal}>
          Purchaser shall have {InlineV({ v: d.ddPeriodDays })} days from PSA execution to conduct inspections, review documents,
          and evaluate the Property in Purchaser's sole discretion.
        </Text>
        <Text style={[s.bold, { marginTop: 4, marginBottom: 2 }]}>(a) Deliverables Upon LOI Execution</Text>
        <Text style={s.normal}>
          Seller shall deliver the following within {InlineV({ v: d.ddDeliveryDays })} business days of mutual LOI execution:
        </Text>
        <Text style={s.bullet}>• Current certified rent roll with lease expiration dates</Text>
        <Text style={s.bullet}>• Trailing 24-month operating statements (P&L)</Text>
        <Text style={s.bullet}>• Copies of all residential and commercial leases</Text>
        <Text style={s.bullet}>• Trailing 24-month utility bills (water, electric, gas, trash)</Text>
        <Text style={s.bullet}>• Current and prior year property tax bills</Text>
        <Text style={s.bullet}>• All service contracts, vendor agreements, and warranties</Text>
        <Text style={s.bullet}>• Current rent payment status for all units — including any delinquencies, partial payments, or payment plans in effect</Text>
        <Text style={[s.bold, { marginTop: 4, marginBottom: 2 }]}>(b) Deliverables Upon PSA Execution</Text>
        <Text style={s.normal}>
          Within two (2) business days of PSA execution, Seller shall deliver copies of Seller's existing title insurance
          policy, all recorded documents referenced therein, and Seller's existing survey. Seller shall also deliver:
          (i) certificate of occupancy and all existing building, fire, and life-safety inspection reports;
          (ii) any existing environmental, engineering, or survey reports in Seller's possession;
          (iii) insurance loss runs for the prior five (5) years; and
          (iv) written disclosure of any pending or threatened litigation, code violations, liens, or governmental orders
          affecting the Property. As a condition of closing, Seller shall obtain and deliver a signed estoppel certificate
          from each tenant confirming the terms of their tenancy and the absence of any landlord defaults or side
          agreements not reflected in the lease.
        </Text>

        {/* 6. FINANCING */}
        <Text style={s.numberedHead}>6. FINANCING CONTINGENCY</Text>
        <Text style={s.normal}>
          Purchaser's obligation to close is contingent upon obtaining financing for not less than {InlineV({ v: d.loanAmountMin })}.
          Purchaser shall have {InlineV({ v: d.loanApprovalDays })} days from expiration of the Due Diligence Period to obtain a
          written loan commitment on terms acceptable to Purchaser. If Purchaser is unable to obtain such commitment,
          Purchaser may terminate this transaction and receive a full refund of the Earnest Money Deposit.
        </Text>

        {/* 7. ASSIGNMENT */}
        <Text style={s.numberedHead}>7. ASSIGNMENT RIGHTS</Text>
        <Text style={s.normal}>
          Purchaser shall have the right to assign this LOI and/or the Purchase and Sale Agreement to any entity
          controlled by or affiliated with Purchaser, without Seller's consent, provided Purchaser remains liable
          for all obligations hereunder.
        </Text>

        {/* 8. SELLER REPRESENTATIONS */}
        <Text style={s.numberedHead}>8. SELLER REPRESENTATIONS</Text>
        <Text style={s.normal}>Seller represents and warrants that, to the best of Seller's knowledge:</Text>
        <Text style={s.bullet}>• Seller has full authority to sell the Property and execute this LOI</Text>
        <Text style={s.bullet}>• There are no pending or threatened condemnation proceedings affecting the Property</Text>
        <Text style={s.bullet}>• All building systems are in working order and the Property complies with applicable codes</Text>
        <Text style={s.bullet}>• There are no undisclosed environmental conditions or hazardous materials on the Property</Text>
        <Text style={s.bullet}>• The operating statements and rent roll provided are true and accurate in all material respects</Text>

        {/* 9. PSA */}
        <Text style={s.numberedHead}>9. PURCHASE AND SALE AGREEMENT</Text>
        <Text style={s.normal}>
          {InlineV({ v: d.purchaserCounsel })} shall draft the Purchase and Sale Agreement within ten (10) business days
          following mutual execution of this LOI. The PSA shall contain customary representations, warranties,
          and indemnifications for transactions of this type.
        </Text>

        {/* 10. CLOSING */}
        <Text style={s.numberedHead}>10. CLOSING DATE AND PRORATIONS</Text>
        <Text style={s.normal}>
          Closing shall occur within {InlineV({ v: d.closingDays })} days following expiration of the Due Diligence Period.
          Property taxes, rents, security deposits, and operating expenses shall be prorated as of the Closing date.
        </Text>

        {/* 11. CLOSING COSTS */}
        <Text style={s.numberedHead}>11. CLOSING COSTS</Text>
        <Text style={s.normal}>
          Seller: owner's title policy, documentary stamps on the deed, Seller's attorney fees.
          Purchaser: lender's title policy, intangible tax, recording fees, loan costs, Purchaser's attorney fees.
        </Text>

        {/* 12. BROKERS */}
        <Text style={s.numberedHead}>12. BROKERS</Text>
        <Text style={s.normal}>
          {InlineV({ v: d.recipientNames })} represents the Seller. Seller shall be responsible for all brokerage commissions.
          Each party represents that no other broker has been engaged in connection with this transaction.
        </Text>

        {/* 13. ALTERATIONS */}
        <Text style={s.numberedHead}>13. PROPERTY ALTERATIONS</Text>
        <Text style={s.normal}>
          From LOI execution through Closing, Seller shall not make material alterations, enter new leases exceeding
          12 months, or modify existing lease terms without Purchaser's prior written consent. Seller shall operate
          the Property in the ordinary course and maintain current insurance coverage.
        </Text>

        {/* 14. NON-BINDING NATURE AND EXPIRATION */}
        <Text style={s.numberedHead}>14. NON-BINDING NATURE AND EXPIRATION</Text>
        <Text style={s.normal}>
          This LOI is intended to be non-binding and is for discussion purposes only, except for the provisions
          regarding confidentiality, which shall be binding. This LOI shall expire if not executed by both parties
          within {InlineV({ v: d.loiExpirationDays })} business days from the date hereof.
        </Text>

        <View style={s.hr} />
        <Text style={[s.normal, { marginTop: 8 }]}>Sincerely,</Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
          <View>
            <Text style={s.sigLabel}>PURCHASER:</Text>
            <View style={s.sigLine} />
            <Text style={s.sigText}>{d.purchaserName || '____________'}</Text>
            <View style={[s.sigLine, { marginTop: 12 }]} />
            <Text style={s.sigText}>Date</Text>
          </View>
          <View>
            <Text style={s.sigLabel}>SELLER (ACKNOWLEDGED):</Text>
            <View style={s.sigLine} />
            <Text style={s.sigText}>{d.sellerName || '____________'}</Text>
            <View style={[s.sigLine, { marginTop: 12 }]} />
            <Text style={s.sigText}>Date</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

// ── Switcher ─────────────────────────────────────────────────────────────
export function LOIDocument({ data }: { data: LOIData }) {
  return data.template === 'buyer-friendly'
    ? <BuyerFriendlyLOI data={data} />
    : <OriginalLOI data={data} />
}
