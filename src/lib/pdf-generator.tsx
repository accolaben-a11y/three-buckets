import {
  Document, Page, Text, View, StyleSheet, pdf, Font
} from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import React, { type ReactElement, type JSXElementConstructor } from 'react'
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
  coverPage: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  coverTitle: { fontSize: 28, fontFamily: 'Helvetica-Bold', color: '#1e40af', marginBottom: 8 },
  coverSubtitle: { fontSize: 16, color: '#475569', marginBottom: 40 },
  coverClientName: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 4 },
  coverDate: { fontSize: 12, color: '#64748b' },
  coverBuckets: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 30,
    marginTop: 10,
  },
  bucket: { width: 8, height: 40, borderRadius: 2 },
  // Tables
  table: { marginBottom: 12 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tableHeader: { backgroundColor: '#f8fafc' },
  tableCell: { flex: 1, padding: '6 8', fontSize: 9 },
  tableCellBold: { flex: 1, padding: '6 8', fontSize: 9, fontFamily: 'Helvetica-Bold' },
  // Callout box
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
  }
  incomeItems: Array<{ label: string; type: string; monthly_amount_cents: number; start_age: number; end_age: number | null }>
  nestEggAccounts: Array<{ label: string; account_type: string; current_balance_cents: number; monthly_draw_cents: number; rate_of_return_bps: number }>
  homeEquity: { current_home_value_cents: number; existing_mortgage_payment_cents: number; hecm_payout_type: string; hecm_payoff_mortgage: boolean } | null
  calcResult: FullCalculationResult
  globalSettings: { inflation_rate_bps: number; home_appreciation_bps: number; loc_growth_rate_bps: number; hecm_lending_limit_cents: number }
  generatedDate: string
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

          <View style={{ marginTop: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Prepared by</Text>
            <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#1e293b' }}>{advisor.full_name}</Text>
            <Text style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>{advisor.contact_info}</Text>
          </View>

          <Text style={{ marginTop: 40, fontSize: 9, color: '#94a3b8', fontStyle: 'italic' }}>
            Scenario: {scenario.name}
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
          {`Your target monthly income in retirement is ${fmt(scenario.target_monthly_income_cents)}. This plan sources that income from three buckets: Bucket 1 (Income Sources) contributes ${fmt(scenario.bucket1_draw_cents)}/month, Bucket 2 (Investment Assets) contributes ${fmt(scenario.bucket2_draw_cents)}/month, and Bucket 3 (Home Equity) contributes ${fmt(scenario.bucket3_draw_cents)}/month.`}
        </Text>

        {showMortgageBanner && (
          <Text style={{ fontSize: 10, lineHeight: 1.6, color: '#334155', marginBottom: 10 }}>
            {`A key insight in this plan: by using your home equity through a HECM reverse mortgage to eliminate your existing mortgage, you free up ${fmt(dashboard.mortgageFreedCents)}/month in cash flow immediately — before drawing from any bucket. This is ${fmt(dashboard.mortgageFreedCents * 12)}/year of freed income.`}
          </Text>
        )}

        {/* Three Buckets Summary */}
        <Text style={styles.sectionTitle}>The Three Buckets Summary</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.tableCellBold}>Bucket</Text>
            <Text style={styles.tableCellBold}>Current Value</Text>
            <Text style={styles.tableCellBold}>Projected at Retirement</Text>
            <Text style={styles.tableCellBold}>Monthly Contribution</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>1 — Income Sources</Text>
            <Text style={styles.tableCell}>—</Text>
            <Text style={styles.tableCell}>—</Text>
            <Text style={styles.tableCell}>{fmt(scenario.bucket1_draw_cents)}/mo</Text>
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

        {/* Mortgage Freedom Callout */}
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

      {/* ── PAGE 3: BUCKET DETAIL ── */}
      <Page size="LETTER" style={styles.page}>
        <PDFHeader advisorName={advisor.full_name} contact={advisor.contact_info} clientName={clientName} generatedDate={generatedDate} />

        {/* Bucket 1 Detail */}
        <Text style={styles.sectionTitle}>Bucket 1 — Your Income Sources</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.tableCellBold}>Source</Text>
            <Text style={styles.tableCellBold}>Type</Text>
            <Text style={styles.tableCellBold}>Monthly Amount</Text>
            <Text style={styles.tableCellBold}>Start Age</Text>
            <Text style={styles.tableCellBold}>End Age</Text>
          </View>
          {incomeItems.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.tableCell}>{item.label}</Text>
              <Text style={styles.tableCell}>{item.type.replace('_', ' ')}</Text>
              <Text style={styles.tableCell}>{fmt(item.monthly_amount_cents)}</Text>
              <Text style={styles.tableCell}>{item.start_age}</Text>
              <Text style={styles.tableCell}>{item.end_age ?? 'Lifetime'}</Text>
            </View>
          ))}
        </View>

        <Text style={{ fontSize: 9, color: '#64748b', marginBottom: 12 }}>
          {`Primary SS claim age: ${scenario.ss_primary_claim_age} | Spouse SS claim age: ${scenario.ss_spouse_claim_age}`}
          {bridgePeriod.hasBridgePeriod ? ` | Bridge period: ages ${bridgePeriod.bridgeStartAge}–${bridgePeriod.bridgeEndAge} (total cost: ${fmt(bridgePeriod.totalBridgeCostCents)})` : ''}
        </Text>

        {/* Bucket 2 Detail */}
        <Text style={styles.sectionTitle}>Bucket 2 — Your Investment Assets</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.tableCellBold}>Account</Text>
            <Text style={styles.tableCellBold}>Type</Text>
            <Text style={styles.tableCellBold}>Balance Today</Text>
            <Text style={styles.tableCellBold}>Rate of Return</Text>
            <Text style={styles.tableCellBold}>Monthly Draw</Text>
          </View>
          {nestEggAccounts.map((acct, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.tableCell}>{acct.label}</Text>
              <Text style={styles.tableCell}>{acct.account_type === 'qualified' ? 'Qualified' : 'Non-Qual'}</Text>
              <Text style={styles.tableCell}>{fmt(acct.current_balance_cents)}</Text>
              <Text style={styles.tableCell}>{fmtPct(acct.rate_of_return_bps)}</Text>
              <Text style={styles.tableCell}>{fmt(acct.monthly_draw_cents)}/mo</Text>
            </View>
          ))}
        </View>

        <Text style={{ fontSize: 9, color: '#64748b', marginBottom: 4 }}>
          Projected combined balance at retirement (age {client.target_retirement_age}): {fmt(accumulationPhase.totalProjectedNestEggCents)}
        </Text>
        <Text style={{ fontSize: 8, color: '#94a3b8', fontStyle: 'italic', marginBottom: 12 }}>
          *Withdrawals from qualified accounts may be subject to income tax. Consult a tax advisor.
        </Text>

        <View style={styles.footer}>
          <Text>Prepared for: {client.first_name} {client.last_name} | {generatedDate}</Text>
          <Text>Page 3</Text>
        </View>
      </Page>

      {/* ── PAGE 4: BUCKET 3 + CASH FLOW ── */}
      <Page size="LETTER" style={styles.page}>
        <PDFHeader advisorName={advisor.full_name} contact={advisor.contact_info} clientName={clientName} generatedDate={generatedDate} />

        {/* Bucket 3 Detail */}
        {homeEquity && hecm && (
          <>
            <Text style={styles.sectionTitle}>Bucket 3 — Your Home Equity (HECM)</Text>
            <View style={styles.table}>
              <View style={styles.tableRow}>
                <Text style={styles.tableCellBold}>Current Home Value</Text>
                <Text style={styles.tableCell}>{fmt(homeEquity.current_home_value_cents)}</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.tableCellBold}>Projected Value at Retirement</Text>
                <Text style={styles.tableCell}>{fmt(hecm.projectedHomeValueCents)}</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.tableCellBold}>HECM Principal Limit</Text>
                <Text style={styles.tableCell}>{fmt(hecm.principalLimitCents)}</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.tableCellBold}>Payout Type</Text>
                <Text style={styles.tableCell}>{homeEquity.hecm_payout_type.replace('_', ' ').toUpperCase()}</Text>
              </View>
              {homeEquity.hecm_payoff_mortgage && homeEquity.existing_mortgage_payment_cents > 0 && (
                <View style={styles.tableRow}>
                  <Text style={styles.tableCellBold}>Monthly Cash Flow Freed (mortgage payoff)</Text>
                  <Text style={[styles.tableCell, { color: '#16a34a', fontFamily: 'Helvetica-Bold' }]}>
                    {fmt(hecm.monthlyFreedCents)}/mo
                  </Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Monthly Cash Flow Plan */}
        <Text style={styles.sectionTitle}>Monthly Cash Flow Plan</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.tableCellBold}>Source</Text>
            <Text style={styles.tableCellBold}>Monthly Amount</Text>
          </View>
          {showMortgageBanner && (
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { color: '#16a34a' }]}>Cash Flow Freed (Mortgage Eliminated)</Text>
              <Text style={[styles.tableCell, { color: '#16a34a', fontFamily: 'Helvetica-Bold' }]}>
                {fmt(dashboard.mortgageFreedCents)}/mo
              </Text>
            </View>
          )}
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>Bucket 1 — Income Sources</Text>
            <Text style={styles.tableCell}>{fmt(scenario.bucket1_draw_cents)}/mo</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>Bucket 2 — Investment Assets</Text>
            <Text style={styles.tableCell}>{fmt(scenario.bucket2_draw_cents)}/mo</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>Bucket 3 — Home Equity</Text>
            <Text style={styles.tableCell}>{fmt(scenario.bucket3_draw_cents)}/mo</Text>
          </View>
          <View style={[styles.tableRow, { backgroundColor: '#eff6ff' }]}>
            <Text style={styles.tableCellBold}>Total Monthly Income</Text>
            <Text style={styles.tableCellBold}>{fmt(dashboard.totalMonthlyIncomeCents)}/mo</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>Target Monthly Income</Text>
            <Text style={styles.tableCell}>{fmt(scenario.target_monthly_income_cents)}/mo</Text>
          </View>
          {dashboard.shortfallCents > 0 && (
            <View style={[styles.tableRow, { backgroundColor: '#fef2f2' }]}>
              <Text style={[styles.tableCell, { color: '#dc2626' }]}>Shortfall</Text>
              <Text style={[styles.tableCell, { color: '#dc2626' }]}>{fmt(dashboard.shortfallCents)}/mo</Text>
            </View>
          )}
          {dashboard.surplusCents > 0 && (
            <View style={[styles.tableRow, { backgroundColor: '#fefce8' }]}>
              <Text style={[styles.tableCell, { color: '#d97706' }]}>Surplus</Text>
              <Text style={[styles.tableCell, { color: '#d97706' }]}>{fmt(dashboard.surplusCents)}/mo</Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text>Prepared for: {client.first_name} {client.last_name} | {generatedDate}</Text>
          <Text>Page 4</Text>
        </View>
      </Page>

      {/* ── PAGE 5: ASSUMPTIONS + DISCLAIMER ── */}
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
            ['Spouse SS Claim Age', `${scenario.ss_spouse_claim_age}`],
            ['Scenario', scenario.name],
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

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Disclaimer</Text>
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            This illustration is for educational purposes only. HECM calculations are estimates based on HUD PLF tables and may vary based on actual lender terms, home appraisal, and closing costs. Reverse mortgage proceeds may affect eligibility for certain government benefit programs. Social Security projections are estimates only. Investment returns shown are hypothetical and not guaranteed. Past performance does not guarantee future results. Withdrawals from qualified retirement accounts (401k, IRA, etc.) may be subject to federal and state income taxes. Required Minimum Distributions (RMDs) are not modeled in this illustration. Consult a licensed financial advisor, tax professional, and estate planning attorney before making retirement planning decisions. This document is prepared by a licensed reverse mortgage professional and does not constitute legal, tax, or investment advice.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text>Prepared for: {client.first_name} {client.last_name} | {generatedDate}</Text>
          <Text>Page 5</Text>
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
