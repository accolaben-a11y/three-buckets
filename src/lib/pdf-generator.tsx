import {
  Document, Page, Text, View, StyleSheet, pdf, Image
} from '@react-pdf/renderer'
import React from 'react'
import type { FullCalculationResult } from './calculations'

function fmt(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100)
}

function fmtPct(bps: number) {
  return `${(bps / 100).toFixed(1)}%`
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    padding: 40,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
    paddingBottom: 8,
    marginBottom: 20,
  },
  headerLeft: { flex: 1 },
  advisorName: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#1e40af' },
  advisorContact: { fontSize: 8, color: '#64748b', marginTop: 2 },
  headerRight: { textAlign: 'right' },
  pageTitle: { fontSize: 9, color: '#64748b' },
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#94a3b8',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
    marginBottom: 8,
    marginTop: 16,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  // Cover
  coverBuckets: { flexDirection: 'row', gap: 6, marginBottom: 30, marginTop: 10 },
  bucket: { width: 8, height: 40, borderRadius: 2 },
  coverTitle: { fontSize: 28, fontFamily: 'Helvetica-Bold', color: '#1e40af', marginBottom: 8 },
  coverSubtitle: { fontSize: 16, color: '#475569', marginBottom: 40 },
  coverClientName: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 4 },
  coverDate: { fontSize: 12, color: '#64748b' },
  // Tables
  table: { marginBottom: 12 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tableHeader: { backgroundColor: '#f8fafc' },
  tableCell: { flex: 1, padding: '6 8', fontSize: 9 },
  tableCellBold: { flex: 1, padding: '6 8', fontSize: 9, fontFamily: 'Helvetica-Bold' },
  // Navy header
  navyHeader: {
    backgroundColor: '#1e3a5f',
    padding: '8 12',
    marginBottom: 8,
    borderRadius: 4,
  },
  navyHeaderText: { color: '#ffffff', fontSize: 11, fontFamily: 'Helvetica-Bold' },
  // Callout/Before-After box
  beforeAfterBox: {
    flexDirection: 'row',
    marginBottom: 12,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  calloutBox: {
    backgroundColor: '#dcfce7',
    borderRadius: 6,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#16a34a',
  },
  calloutTitle: { fontSize: 10, color: '#15803d', marginBottom: 4, fontFamily: 'Helvetica-Bold' },
  calloutAmount: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#15803d', marginBottom: 2 },
  calloutSub: { fontSize: 9, color: '#166534' },
  // Chart image
  chartImage: { width: '100%', marginBottom: 8 },
  // Disclaimer
  disclaimer: {
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  disclaimerText: { fontSize: 7.5, color: '#64748b', lineHeight: 1.4 },
})

interface PDFData {
  client: {
    first_name: string
    last_name: string
    age: number
    spouse_name: string | null
    spouse_age: number | null
    state: string
    target_retirement_age: number
  }
  advisor: { full_name: string; contact_info: string }
  scenario: {
    name: string
    target_monthly_income_cents: number
    bucket1_draw_cents: number
    bucket2_draw_cents: number
    bucket3_draw_cents: number
    ss_primary_claim_age: number
    ss_spouse_claim_age: number
    inflation_rate_bps: number
    planning_horizon_age: number
    notes: string | null
    transition_events: Record<string, { bucket2_deposit_cents: number; bucket3_repayment_cents: number; notes?: string }> | null
    bucket2_deposit_cents: number
    bucket3_repayment_cents: number
  }
  incomeItems: Array<{
    label: string
    type: string
    owner: string
    monthly_amount_cents: number
    start_age: number
    end_age: number | null
    ss_age62_cents: number | null
    ss_age67_cents: number | null
    ss_age70_cents: number | null
    ss_claim_age: number | null
  }>
  nestEggAccounts: Array<{
    label: string
    account_type: string
    current_balance_cents: number
    monthly_contribution_cents: number
    monthly_draw_cents: number
    rate_of_return_bps: number
  }>
  homeEquity: {
    current_home_value_cents: number
    existing_mortgage_balance_cents: number
    existing_mortgage_payment_cents: number
    hecm_payout_type: string
    hecm_payoff_mortgage: boolean
    hecm_loc_growth_rate_bps: number
    hecm_expected_rate_bps: number
    hecm_principal_limit_cents: number
    hecm_tenure_monthly_cents: number
    hecm_additional_lump_sum_cents: number
  } | null
  calcResult: FullCalculationResult
  globalSettings: { inflation_rate_bps: number; home_appreciation_bps: number; loc_growth_rate_bps: number; hecm_lending_limit_cents: number }
  generatedDate: string
  transitionAges: number[]
  incomeSourceLabels: Record<string, string>
  bucket1ChartImage: string | null
  longevityChartImage: string | null
}

const PDFHeader = ({ advisorName, contact, clientName, generatedDate }: {
  advisorName: string; contact: string; clientName: string; generatedDate: string
}) => (
  <View style={styles.headerBar}>
    <View style={styles.headerLeft}>
      <Text style={styles.advisorName}>{advisorName}</Text>
      <Text style={styles.advisorContact}>{contact}</Text>
    </View>
    <View style={styles.headerRight}>
      <Text style={styles.pageTitle}>Three Buckets Retirement Plan</Text>
      <Text style={[styles.advisorContact, { marginTop: 2 }]}>Prepared for: {clientName}</Text>
      <Text style={[styles.advisorContact, { marginTop: 2 }]}>{generatedDate}</Text>
    </View>
  </View>
)

const PDFDocument = ({ data }: { data: PDFData }) => {
  const { client, advisor, scenario, incomeItems, nestEggAccounts, homeEquity, calcResult, globalSettings, generatedDate } = data
  const clientName = `${client.first_name} ${client.last_name}`
  const { hecm, dashboard, accumulationPhase, bridgePeriod } = calcResult

  const showMortgageBanner = homeEquity?.hecm_payoff_mortgage &&
    homeEquity?.existing_mortgage_payment_cents > 0 &&
    homeEquity?.hecm_payout_type === 'lump_sum' &&
    (dashboard.mortgageFreedCents ?? 0) > 0

  const hasSS = incomeItems.some(i => i.type === 'social_security')
  const ssDeferralNote = bridgePeriod.hasBridgePeriod
    ? `SS deferred — bridge period ages ${bridgePeriod.bridgeStartAge}–${bridgePeriod.bridgeEndAge}, total cost ${fmt(bridgePeriod.totalBridgeCostCents)}.`
    : null

  return (
    <Document title={`${clientName} — Three Buckets Retirement Plan`}>

      {/* ── PAGE 1: COVER ── */}
      <Page size="LETTER" style={styles.page}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={styles.coverBuckets}>
            <View style={[styles.bucket, { backgroundColor: '#16a34a' }]} />
            <View style={[styles.bucket, { backgroundColor: '#2563eb' }]} />
            <View style={[styles.bucket, { backgroundColor: '#dc2626' }]} />
          </View>
          <Text style={styles.coverTitle}>Three Buckets</Text>
          <Text style={styles.coverSubtitle}>Retirement Cash Flow Plan</Text>
          <Text style={styles.coverClientName}>{clientName}</Text>
          {client.spouse_name && <Text style={{ fontSize: 14, color: '#475569', marginBottom: 4 }}>& {client.spouse_name}</Text>}
          <Text style={styles.coverDate}>{generatedDate}</Text>
          <Text style={{ marginTop: 6, fontSize: 9, color: '#94a3b8', fontStyle: 'italic' }}>
            Scenario: {scenario.name}
          </Text>

          <View style={{ marginTop: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Prepared by</Text>
            <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#1e293b' }}>{advisor.full_name}</Text>
            <Text style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>{advisor.contact_info}</Text>
          </View>

          <Text style={{ marginTop: 40, fontSize: 8, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>
            This illustration is for planning purposes only and does not constitute financial, legal, or tax advice.
          </Text>
        </View>
        <View style={styles.footer}>
          <Text>Three Buckets Retirement Cash Flow Tool</Text>
          <Text>Page 1</Text>
        </View>
      </Page>

      {/* ── PAGE 2: EXECUTIVE SUMMARY ── */}
      <Page size="LETTER" style={styles.page}>
        <PDFHeader advisorName={advisor.full_name} contact={advisor.contact_info} clientName={clientName} generatedDate={generatedDate} />

        <Text style={styles.sectionTitle}>Your Retirement Picture</Text>

        <Text style={{ fontSize: 10, lineHeight: 1.6, color: '#334155', marginBottom: 10 }}>
          {`Based on your current assets, here is how your retirement income could work. You are currently age ${client.age}${client.spouse_name ? `, and ${client.spouse_name} is age ${client.spouse_age}` : ''}. Your target retirement age is ${client.target_retirement_age}, and this plan models your cash flow through age ${scenario.planning_horizon_age}.`}
        </Text>

        <Text style={{ fontSize: 10, lineHeight: 1.6, color: '#334155', marginBottom: 10 }}>
          {`Your target monthly income in retirement is ${fmt(scenario.target_monthly_income_cents)}. This plan sources that income from three buckets: Bucket 1 (Income Sources) contributes ${fmt(dashboard.bucket1MonthlyCents)}/month at retirement, Bucket 2 (Investment Assets) contributes ${fmt(scenario.bucket2_draw_cents)}/month, and Bucket 3 (Home Equity) contributes ${fmt(scenario.bucket3_draw_cents)}/month.`}
        </Text>

        {showMortgageBanner && (
          <Text style={{ fontSize: 10, lineHeight: 1.6, color: '#334155', marginBottom: 10 }}>
            {`A key insight in this plan: by using your home equity through a HECM reverse mortgage to eliminate your existing mortgage, you free up ${fmt(dashboard.mortgageFreedCents)}/month in cash flow immediately — before drawing from any bucket. This is ${fmt(dashboard.mortgageFreedCents * 12)}/year of freed income.`}
          </Text>
        )}

        <Text style={styles.sectionTitle}>The Three Buckets Summary</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.tableCellBold}>Bucket</Text>
            <Text style={styles.tableCellBold}>Current Value</Text>
            <Text style={styles.tableCellBold}>Projected at Retirement</Text>
            <Text style={styles.tableCellBold}>Monthly at Retirement</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>1 — Income Sources</Text>
            <Text style={styles.tableCell}>—</Text>
            <Text style={styles.tableCell}>—</Text>
            <Text style={styles.tableCell}>{fmt(dashboard.bucket1MonthlyCents)}/mo</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>2 — Investment Assets</Text>
            <Text style={styles.tableCell}>{fmt(accumulationPhase.totalCurrentNestEggCents)}</Text>
            <Text style={styles.tableCell}>{fmt(accumulationPhase.totalProjectedNestEggCents)}</Text>
            <Text style={styles.tableCell}>{fmt(scenario.bucket2_draw_cents)}/mo</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>3 — Home Equity (HECM)</Text>
            <Text style={styles.tableCell}>{fmt(homeEquity?.current_home_value_cents ?? 0)}</Text>
            <Text style={styles.tableCell}>{fmt(hecm?.projectedHomeValueCents ?? 0)}</Text>
            <Text style={styles.tableCell}>{fmt(scenario.bucket3_draw_cents)}/mo</Text>
          </View>
        </View>

        {showMortgageBanner && (
          <View style={styles.calloutBox}>
            <Text style={styles.calloutTitle}>MONTHLY CASH FLOW FREED BY ELIMINATING MORTGAGE</Text>
            <Text style={styles.calloutAmount}>{fmt(dashboard.mortgageFreedCents)}/month</Text>
            <Text style={styles.calloutSub}>That is {fmt(dashboard.mortgageFreedCents * 12)}/year — before drawing from any bucket</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text>Prepared for: {client.first_name} {client.last_name} | {generatedDate}</Text>
          <Text>Page 2</Text>
        </View>
      </Page>

      {/* ── PAGE 3: MORTGAGE OPPORTUNITY (conditional) ── */}
      {showMortgageBanner && (
        <Page size="LETTER" style={styles.page}>
          <PDFHeader advisorName={advisor.full_name} contact={advisor.contact_info} clientName={clientName} generatedDate={generatedDate} />

          <Text style={styles.sectionTitle}>Mortgage Opportunity — Before & After HECM</Text>

          <View style={styles.beforeAfterBox}>
            <View style={{ flex: 1, backgroundColor: '#f1f5f9', padding: '12 16' }}>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#475569', marginBottom: 6 }}>WITHOUT HECM</Text>
              <Text style={{ fontSize: 9, color: '#64748b', marginBottom: 4 }}>Monthly mortgage payment:</Text>
              <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#dc2626' }}>{fmt(homeEquity!.existing_mortgage_payment_cents)}/mo</Text>
              <Text style={{ fontSize: 9, color: '#64748b', marginTop: 8 }}>Cash flow target (with mortgage):</Text>
              <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#0f172a' }}>{fmt(dashboard.grossTargetCents)}/mo</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#16a34a', padding: '12 16' }}>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#dcfce7', marginBottom: 6 }}>✓ WITH HECM</Text>
              <Text style={{ fontSize: 9, color: '#bbf7d0', marginBottom: 4 }}>Mortgage eliminated — cash freed:</Text>
              <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#ffffff' }}>{fmt(dashboard.mortgageFreedCents)}/mo</Text>
              <Text style={{ fontSize: 9, color: '#bbf7d0', marginTop: 8 }}>Adjusted cash flow target:</Text>
              <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#ffffff' }}>{fmt(dashboard.adjustedTargetCents)}/mo</Text>
            </View>
          </View>

          <Text style={{ fontSize: 10, lineHeight: 1.6, color: '#334155', marginTop: 8, marginBottom: 10 }}>
            {`By using a Home Equity Conversion Mortgage (HECM) to pay off your existing mortgage at retirement, you immediately free up ${fmt(dashboard.mortgageFreedCents)}/month — ${fmt(dashboard.mortgageFreedCents * 12)}/year — in household cash flow. This reduces the amount you need to draw from your investment and income buckets, extending their longevity throughout retirement.`}
          </Text>

          <Text style={{ fontSize: 10, lineHeight: 1.6, color: '#334155', marginBottom: 10 }}>
            {`The HECM lump sum pays off the remaining mortgage balance of ${fmt(homeEquity!.existing_mortgage_balance_cents)}. Any remaining proceeds are available as a growing line of credit or additional lump sum at your discretion.`}
          </Text>

          <View style={styles.footer}>
            <Text>Prepared for: {client.first_name} {client.last_name} | {generatedDate}</Text>
            <Text>Page 3</Text>
          </View>
        </Page>
      )}

      {/* ── PAGE 4: BUCKET 1 INCOME SOURCES ── */}
      <Page size="LETTER" style={styles.page}>
        <PDFHeader advisorName={advisor.full_name} contact={advisor.contact_info} clientName={clientName} generatedDate={generatedDate} />

        <Text style={styles.sectionTitle}>Bucket 1 — Income Sources</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCellBold, { flex: 2 }]}>Source</Text>
            <Text style={styles.tableCellBold}>Owner</Text>
            <Text style={styles.tableCellBold}>Monthly Amount</Text>
            <Text style={styles.tableCellBold}>Active Ages</Text>
            <Text style={styles.tableCellBold}>SS Claim Age</Text>
          </View>
          {incomeItems.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 2 }]}>{item.label}</Text>
              <Text style={styles.tableCell}>{item.owner}</Text>
              <Text style={styles.tableCell}>{fmt(item.monthly_amount_cents)}</Text>
              <Text style={styles.tableCell}>{item.start_age}–{item.end_age ?? 'Life'}</Text>
              <Text style={styles.tableCell}>
                {item.type === 'social_security' && item.ss_claim_age ? `Age ${item.ss_claim_age}` : '—'}
              </Text>
            </View>
          ))}
        </View>

        {ssDeferralNote && (
          <Text style={{ fontSize: 9, color: '#92400e', backgroundColor: '#fef3c7', padding: '6 10', borderRadius: 4, marginBottom: 8 }}>
            ⚠ {ssDeferralNote}
          </Text>
        )}

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Age-Triggered Income Transitions</Text>
        {data.transitionAges.length === 0 ? (
          <Text style={{ fontSize: 9, color: '#64748b', fontStyle: 'italic' }}>No income transitions configured.</Text>
        ) : (
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCellBold}>Age</Text>
              <Text style={[styles.tableCellBold, { flex: 2 }]}>Income Change</Text>
              <Text style={styles.tableCellBold}>B2 Deposit</Text>
              <Text style={styles.tableCellBold}>B3 Repayment</Text>
            </View>
            {data.transitionAges.map(age => {
              const ev = scenario.transition_events?.[String(age)]
              const snap = calcResult.longevityProjection.find(s => s.age === age)
              return (
                <View key={age} style={styles.tableRow}>
                  <Text style={styles.tableCell}>Age {age}</Text>
                  <Text style={[styles.tableCell, { flex: 2 }]}>
                    {snap ? `${fmt(snap.bucket1IncomeCents)}/mo` : '—'}
                  </Text>
                  <Text style={styles.tableCell}>
                    {ev ? fmt(ev.bucket2_deposit_cents) : '⚠ Not yet allocated'}
                  </Text>
                  <Text style={styles.tableCell}>
                    {ev ? fmt(ev.bucket3_repayment_cents) : '⚠ Not yet allocated'}
                  </Text>
                </View>
              )
            })}
          </View>
        )}

        <View style={styles.footer}>
          <Text>Prepared for: {client.first_name} {client.last_name} | {generatedDate}</Text>
          <Text>Page {showMortgageBanner ? 4 : 3}</Text>
        </View>
      </Page>

      {/* ── PAGE 5: BUCKET 1 INCOME CHART ── */}
      <Page size="LETTER" style={styles.page}>
        <PDFHeader advisorName={advisor.full_name} contact={advisor.contact_info} clientName={clientName} generatedDate={generatedDate} />

        <Text style={styles.sectionTitle}>Bucket 1 — Income by Age (Stacked Bar Chart)</Text>

        {data.bucket1ChartImage ? (
          <>
            <Image src={data.bucket1ChartImage} style={styles.chartImage} />
            <Text style={{ fontSize: 8, color: '#64748b', marginTop: 4, marginBottom: 8 }}>
              Chart shows monthly income by source from retirement through planning horizon. Each color represents a different income stream.
            </Text>
          </>
        ) : (
          <Text style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic', marginBottom: 12 }}>
            Chart not available — open the dashboard to regenerate.
          </Text>
        )}

        {/* Income source legend */}
        {Object.entries(data.incomeSourceLabels).length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Income Source Legend</Text>
            {Object.entries(data.incomeSourceLabels).map(([id, label]) => (
              <View key={id} style={[styles.tableRow]}>
                <Text style={styles.tableCell}>{label}</Text>
                <Text style={[styles.tableCell, { color: '#64748b' }]}>{id}</Text>
              </View>
            ))}
          </>
        )}

        <View style={styles.footer}>
          <Text>Prepared for: {client.first_name} {client.last_name} | {generatedDate}</Text>
          <Text>Page {showMortgageBanner ? 5 : 4}</Text>
        </View>
      </Page>

      {/* ── PAGE 6: BUCKET 2 INVESTMENT ASSETS ── */}
      <Page size="LETTER" style={styles.page}>
        <PDFHeader advisorName={advisor.full_name} contact={advisor.contact_info} clientName={clientName} generatedDate={generatedDate} />

        <Text style={styles.sectionTitle}>Bucket 2 — Investment Assets</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCellBold, { flex: 2 }]}>Account</Text>
            <Text style={styles.tableCellBold}>Type</Text>
            <Text style={styles.tableCellBold}>Balance Today</Text>
            <Text style={styles.tableCellBold}>Monthly Contrib.</Text>
            <Text style={styles.tableCellBold}>Rate</Text>
            <Text style={styles.tableCellBold}>Monthly Draw</Text>
          </View>
          {nestEggAccounts.map((acct, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 2 }]}>{acct.label}</Text>
              <Text style={styles.tableCell}>{acct.account_type === 'qualified' ? 'Qualified' : 'Non-Qual'}</Text>
              <Text style={styles.tableCell}>{fmt(acct.current_balance_cents)}</Text>
              <Text style={styles.tableCell}>{acct.monthly_contribution_cents > 0 ? `${fmt(acct.monthly_contribution_cents)}/mo` : '—'}</Text>
              <Text style={styles.tableCell}>{fmtPct(acct.rate_of_return_bps)}</Text>
              <Text style={styles.tableCell}>{fmt(acct.monthly_draw_cents)}/mo</Text>
            </View>
          ))}
        </View>

        <Text style={{ fontSize: 9, color: '#64748b', marginBottom: 4 }}>
          Projected combined balance at retirement (age {client.target_retirement_age}): {fmt(accumulationPhase.totalProjectedNestEggCents)}
        </Text>
        {nestEggAccounts.some(a => a.account_type === 'qualified') && (
          <Text style={{ fontSize: 8, color: '#94a3b8', fontStyle: 'italic', marginBottom: 8 }}>
            *Withdrawals from qualified accounts may be subject to income tax. Consult a tax advisor.
          </Text>
        )}
        {scenario.bucket2_deposit_cents > 0 && (
          <Text style={{ fontSize: 9, color: '#1d4ed8', marginBottom: 8 }}>
            Surplus deposit: {fmt(scenario.bucket2_deposit_cents)}/mo reinvested into Bucket 2 when surplus available.
          </Text>
        )}

        <View style={styles.footer}>
          <Text>Prepared for: {client.first_name} {client.last_name} | {generatedDate}</Text>
          <Text>Page {showMortgageBanner ? 6 : 5}</Text>
        </View>
      </Page>

      {/* ── PAGE 7: BUCKET 3 HOME EQUITY ── */}
      <Page size="LETTER" style={styles.page}>
        <PDFHeader advisorName={advisor.full_name} contact={advisor.contact_info} clientName={clientName} generatedDate={generatedDate} />

        <Text style={styles.sectionTitle}>Bucket 3 — Home Equity (HECM)</Text>

        {homeEquity && hecm ? (
          <>
            <View style={styles.table}>
              {[
                ['Current Home Value', fmt(homeEquity.current_home_value_cents)],
                ['Projected Value at Retirement', fmt(hecm.projectedHomeValueCents)],
                ['HECM Principal Limit', fmt(hecm.principalLimitCents)],
                ['Payout Type', homeEquity.hecm_payout_type.replace('_', ' ').toUpperCase()],
                ['LOC Growth Rate', fmtPct(homeEquity.hecm_loc_growth_rate_bps)],
                ['Expected Rate', fmtPct(homeEquity.hecm_expected_rate_bps)],
                ...(homeEquity.hecm_principal_limit_cents > 0 ? [['Principal Limit (input)', fmt(homeEquity.hecm_principal_limit_cents)]] : []),
                ...(homeEquity.hecm_tenure_monthly_cents > 0 ? [['Tenure Monthly Payout', `${fmt(homeEquity.hecm_tenure_monthly_cents)}/mo`]] : []),
                ...(homeEquity.hecm_additional_lump_sum_cents > 0 ? [['Additional Lump Sum', fmt(homeEquity.hecm_additional_lump_sum_cents)]] : []),
                ...(homeEquity.existing_mortgage_balance_cents > 0 ? [['Existing Mortgage Balance', fmt(homeEquity.existing_mortgage_balance_cents)]] : []),
                ...(homeEquity.hecm_payoff_mortgage && homeEquity.existing_mortgage_payment_cents > 0
                  ? [['Monthly Cash Flow Freed', `${fmt(hecm.monthlyFreedCents)}/mo`]]
                  : []),
              ].map(([label, value]) => (
                <View key={label} style={styles.tableRow}>
                  <Text style={styles.tableCellBold}>{label}</Text>
                  <Text style={styles.tableCell}>{value}</Text>
                </View>
              ))}
            </View>

            {hecm.availableProceedsCents < 0 && (
              <Text style={{ fontSize: 9, color: '#dc2626', marginBottom: 8 }}>
                Cash-to-close required: {fmt(Math.abs(hecm.availableProceedsCents))} — funded from Bucket 2.
              </Text>
            )}
            {homeEquity.hecm_payout_type === 'tenure' && hecm.tenureMonthlyCents > 0 && (
              <Text style={{ fontSize: 9, color: '#1d4ed8', marginBottom: 8 }}>
                Tenure payout: {fmt(hecm.tenureMonthlyCents)}/month for life.
              </Text>
            )}
            {scenario.bucket3_repayment_cents > 0 && (
              <Text style={{ fontSize: 9, color: '#15803d', marginBottom: 8 }}>
                Voluntary LOC repayment: {fmt(scenario.bucket3_repayment_cents)}/mo — restores line of credit.
              </Text>
            )}
          </>
        ) : (
          <Text style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic' }}>No HECM configured for this scenario.</Text>
        )}

        <View style={styles.footer}>
          <Text>Prepared for: {client.first_name} {client.last_name} | {generatedDate}</Text>
          <Text>Page {showMortgageBanner ? 7 : 6}</Text>
        </View>
      </Page>

      {/* ── PAGE 8: MONTHLY CASH FLOW PLAN ── */}
      <Page size="LETTER" style={styles.page}>
        <PDFHeader advisorName={advisor.full_name} contact={advisor.contact_info} clientName={clientName} generatedDate={generatedDate} />

        <Text style={styles.sectionTitle}>Monthly Cash Flow Plan</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCellBold, { flex: 2 }]}>Source</Text>
            <Text style={styles.tableCellBold}>Monthly Amount</Text>
          </View>
          {showMortgageBanner && (
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 2, color: '#16a34a' }]}>Cash Flow Freed (Mortgage Eliminated)</Text>
              <Text style={[styles.tableCell, { color: '#16a34a', fontFamily: 'Helvetica-Bold' }]}>
                {fmt(dashboard.mortgageFreedCents)}/mo
              </Text>
            </View>
          )}
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2 }]}>Bucket 1 — Income Sources (at retirement)</Text>
            <Text style={styles.tableCell}>{fmt(dashboard.bucket1MonthlyCents)}/mo</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2 }]}>Bucket 2 — Investment Assets</Text>
            <Text style={styles.tableCell}>{fmt(scenario.bucket2_draw_cents)}/mo</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2 }]}>Bucket 3 — Home Equity</Text>
            <Text style={styles.tableCell}>{fmt(scenario.bucket3_draw_cents)}/mo</Text>
          </View>
          <View style={[styles.tableRow, { backgroundColor: '#eff6ff' }]}>
            <Text style={[styles.tableCellBold, { flex: 2 }]}>Total Monthly Income</Text>
            <Text style={styles.tableCellBold}>{fmt(dashboard.totalMonthlyIncomeCents)}/mo</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2 }]}>Target Monthly Income</Text>
            <Text style={styles.tableCell}>{fmt(scenario.target_monthly_income_cents)}/mo</Text>
          </View>
          {dashboard.shortfallCents > 0 && (
            <View style={[styles.tableRow, { backgroundColor: '#fef2f2' }]}>
              <Text style={[styles.tableCell, { flex: 2, color: '#dc2626' }]}>Shortfall</Text>
              <Text style={[styles.tableCell, { color: '#dc2626' }]}>{fmt(dashboard.shortfallCents)}/mo</Text>
            </View>
          )}
          {dashboard.surplusCents > 0 && (
            <View style={[styles.tableRow, { backgroundColor: '#fefce8' }]}>
              <Text style={[styles.tableCell, { flex: 2, color: '#d97706' }]}>Surplus</Text>
              <Text style={[styles.tableCell, { color: '#d97706' }]}>{fmt(dashboard.surplusCents)}/mo</Text>
            </View>
          )}
        </View>

        {dashboard.surplusCents > 0 && (scenario.bucket2_deposit_cents > 0 || scenario.bucket3_repayment_cents > 0) && (
          <Text style={{ fontSize: 9, color: '#334155', marginBottom: 8 }}>
            Surplus allocation: {scenario.bucket2_deposit_cents > 0 ? `${fmt(scenario.bucket2_deposit_cents)}/mo reinvested into Bucket 2` : ''}
            {scenario.bucket2_deposit_cents > 0 && scenario.bucket3_repayment_cents > 0 ? '; ' : ''}
            {scenario.bucket3_repayment_cents > 0 ? `${fmt(scenario.bucket3_repayment_cents)}/mo repaid to Bucket 3 LOC` : ''}.
          </Text>
        )}

        <View style={styles.footer}>
          <Text>Prepared for: {client.first_name} {client.last_name} | {generatedDate}</Text>
          <Text>Page {showMortgageBanner ? 8 : 7}</Text>
        </View>
      </Page>

      {/* ── PAGE 9: LONGEVITY PROJECTION CHART ── */}
      <Page size="LETTER" style={styles.page}>
        <PDFHeader advisorName={advisor.full_name} contact={advisor.contact_info} clientName={clientName} generatedDate={generatedDate} />

        <Text style={styles.sectionTitle}>Longevity Projection — How Long Each Bucket Lasts</Text>

        {data.longevityChartImage ? (
          <>
            <Image src={data.longevityChartImage} style={styles.chartImage} />
            <Text style={{ fontSize: 8, color: '#64748b', marginTop: 4, marginBottom: 8 }}>
              {`Chart shows Nest Egg (Bucket 2) and LOC (Bucket 3) balances from age ${client.target_retirement_age} to ${scenario.planning_horizon_age}. Assumes ${fmtPct(scenario.inflation_rate_bps)} annual inflation and ${fmtPct(nestEggAccounts[0]?.rate_of_return_bps ?? 600)} average investment return.`}
            </Text>
          </>
        ) : (
          <Text style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic', marginBottom: 12 }}>
            Chart not available — open the dashboard to regenerate.
          </Text>
        )}

        {calcResult.depletionAges.bucket2DepletionAge && (
          <Text style={{ fontSize: 9, color: '#dc2626', marginBottom: 4 }}>
            ⚠ Bucket 2 (Nest Egg) projects to deplete at age {calcResult.depletionAges.bucket2DepletionAge}.
          </Text>
        )}
        {calcResult.depletionAges.bucket3DepletionAge && (
          <Text style={{ fontSize: 9, color: '#dc2626', marginBottom: 4 }}>
            ⚠ Bucket 3 (Home Equity LOC) projects to deplete at age {calcResult.depletionAges.bucket3DepletionAge}.
          </Text>
        )}

        <View style={styles.footer}>
          <Text>Prepared for: {client.first_name} {client.last_name} | {generatedDate}</Text>
          <Text>Page {showMortgageBanner ? 9 : 8}</Text>
        </View>
      </Page>

      {/* ── PAGE 10: ASSUMPTIONS ── */}
      <Page size="LETTER" style={styles.page}>
        <PDFHeader advisorName={advisor.full_name} contact={advisor.contact_info} clientName={clientName} generatedDate={generatedDate} />

        <Text style={styles.sectionTitle}>Assumptions Used in This Plan</Text>
        <View style={styles.table}>
          {[
            ['Inflation Rate', fmtPct(scenario.inflation_rate_bps)],
            ['Home Appreciation Rate', fmtPct(globalSettings.home_appreciation_bps)],
            ['HECM LOC Growth Rate', fmtPct(globalSettings.loc_growth_rate_bps)],
            ['Planning Horizon Age', `${scenario.planning_horizon_age} years old`],
            ['HECM Lending Limit', fmt(globalSettings.hecm_lending_limit_cents)],
            ['Primary SS Claim Age', `${scenario.ss_primary_claim_age}`],
            ...(client.spouse_name ? [['Spouse SS Claim Age', `${scenario.ss_spouse_claim_age}`]] : []),
            ['Scenario', scenario.name],
            ...nestEggAccounts.map(a => [`${a.label} Rate of Return`, fmtPct(a.rate_of_return_bps)]),
          ].map(([label, value]) => (
            <View key={label} style={styles.tableRow}>
              <Text style={styles.tableCellBold}>{label}</Text>
              <Text style={styles.tableCell}>{value}</Text>
            </View>
          ))}
        </View>

        {scenario.notes && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Advisor Notes</Text>
            <Text style={{ fontSize: 10, color: '#334155', lineHeight: 1.5 }}>{scenario.notes}</Text>
          </>
        )}

        <View style={styles.footer}>
          <Text>Prepared for: {client.first_name} {client.last_name} | {generatedDate}</Text>
          <Text>Page {showMortgageBanner ? 10 : 9}</Text>
        </View>
      </Page>

      {/* ── PAGE 11: DISCLAIMER ── */}
      <Page size="LETTER" style={styles.page}>
        <PDFHeader advisorName={advisor.full_name} contact={advisor.contact_info} clientName={clientName} generatedDate={generatedDate} />

        <Text style={styles.sectionTitle}>Important Disclosures & Disclaimer</Text>
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            {`This illustration is for educational and planning purposes only and does not constitute financial, legal, tax, or investment advice. All projections, estimates, and calculations shown are hypothetical and based on assumptions that may not reflect actual future conditions.\n\nHECM (Home Equity Conversion Mortgage) calculations are estimates based on HUD Principal Limit Factor (PLF) tables and may vary based on actual lender terms, property appraisal, closing costs, and regulatory changes. Reverse mortgage proceeds, disbursements, and available credit may affect eligibility for certain means-tested government benefit programs including Medicaid and Supplemental Security Income (SSI). Borrower(s) must continue to meet all HECM obligations including payment of property taxes, homeowner's insurance, and property maintenance.\n\nSocial Security projections are estimates only and are subject to change based on legislative or regulatory action. Actual benefits may differ. Investment return assumptions are hypothetical and not guaranteed. Past performance does not guarantee future results. Market fluctuations, sequence-of-returns risk, and other factors may cause actual results to differ materially from projections shown.\n\nWithdrawals from qualified retirement accounts (401(k), IRA, etc.) may be subject to federal and state income taxes. Required Minimum Distributions (RMDs) are not modeled in this illustration and may affect account balances and tax obligations. Consult a qualified tax professional.\n\nInflation assumptions are estimates. Actual inflation may be higher or lower, affecting purchasing power and income requirements over time.\n\nThis document has been prepared by a licensed financial professional and is intended solely for the use of the individual(s) named herein. It may not be reproduced or distributed without written consent. This is not a guarantee of any specific outcome. Consult a licensed financial advisor, tax professional, and estate planning attorney before making any retirement planning decisions.\n\nThree Buckets Retirement Cash Flow Tool — For advisor use only.`}
          </Text>
        </View>

        <View style={styles.footer}>
          <Text>Prepared for: {client.first_name} {client.last_name} | {generatedDate}</Text>
          <Text>Page {showMortgageBanner ? 11 : 10}</Text>
        </View>
      </Page>

    </Document>
  )
}

export async function generatePDF(data: PDFData): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = React.createElement(PDFDocument, { data }) as any
  const instance = pdf(doc)
  const blob = await instance.toBlob()
  const arrayBuffer = await blob.arrayBuffer()
  return new Uint8Array(arrayBuffer)
}
