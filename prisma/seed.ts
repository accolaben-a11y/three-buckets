import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Global settings
  await prisma.globalSettings.upsert({
    where: { id: 'global' },
    update: {},
    create: {
      id: 'global',
      inflation_rate_bps: 300,
      home_appreciation_bps: 400,
      loc_growth_rate_bps: 600,
      planning_horizon_age: 90,
      hecm_lending_limit_cents: 120975000,
      session_timeout_minutes: 60,
    },
  })

  // Admin user
  const adminHash = await bcrypt.hash('admin123', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@threebuckets.com' },
    update: {},
    create: {
      email: 'admin@threebuckets.com',
      password_hash: adminHash,
      role: 'admin',
      full_name: 'System Administrator',
      contact_info: 'admin@threebuckets.com',
    },
  })

  // Demo advisor
  const advisorHash = await bcrypt.hash('advisor123', 12)
  const advisor = await prisma.user.upsert({
    where: { email: 'advisor@threebuckets.com' },
    update: {},
    create: {
      email: 'advisor@threebuckets.com',
      password_hash: advisorHash,
      role: 'advisor',
      full_name: 'Jane Smith',
      contact_info: 'Jane Smith | HECM Specialist | (555) 123-4567 | jane@threebuckets.com',
    },
  })

  // Demo client with all three buckets
  const client = await prisma.client.upsert({
    where: { id: 'demo-client-001' },
    update: {},
    create: {
      id: 'demo-client-001',
      advisor_id: advisor.id,
      first_name: 'Robert',
      last_name: 'Johnson',
      age: 58,
      spouse_name: 'Mary Johnson',
      spouse_age: 56,
      marital_status: 'married',
      state: 'FL',
      target_retirement_age: 62,
      planning_horizon_age: 90,
      model_survivor: false,
    },
  })

  // Income items
  await prisma.incomeItem.upsert({
    where: { id: 'demo-income-001' },
    update: {},
    create: {
      id: 'demo-income-001',
      client_id: client.id,
      owner: 'primary',
      type: 'social_security',
      label: "Robert's Social Security",
      monthly_amount_cents: 210000, // $2,100/mo at FRA
      start_age: 67,
      ss_age62_cents: 147000,  // $1,470
      ss_age67_cents: 210000,  // $2,100
      ss_age70_cents: 260400,  // $2,604
      ss_claim_age: 67,
      sort_order: 0,
    },
  })

  await prisma.incomeItem.upsert({
    where: { id: 'demo-income-002' },
    update: {},
    create: {
      id: 'demo-income-002',
      client_id: client.id,
      owner: 'spouse',
      type: 'social_security',
      label: "Mary's Social Security",
      monthly_amount_cents: 145000, // $1,450/mo at FRA
      start_age: 67,
      ss_age62_cents: 101500,
      ss_age67_cents: 145000,
      ss_age70_cents: 179800,
      ss_claim_age: 67,
      sort_order: 1,
    },
  })

  await prisma.incomeItem.upsert({
    where: { id: 'demo-income-003' },
    update: {},
    create: {
      id: 'demo-income-003',
      client_id: client.id,
      owner: 'primary',
      type: 'wage',
      label: "Robert's Part-Time Work",
      monthly_amount_cents: 200000, // $2,000/mo
      start_age: 62,
      end_age: 67,
      sort_order: 2,
    },
  })

  // Nest egg accounts
  await prisma.nestEggAccount.upsert({
    where: { id: 'demo-nest-001' },
    update: {},
    create: {
      id: 'demo-nest-001',
      client_id: client.id,
      label: "Robert's 401(k)",
      account_type: 'qualified',
      current_balance_cents: 38000000, // $380,000
      monthly_contribution_cents: 150000, // $1,500/mo
      rate_of_return_bps: 700, // 7%
      monthly_draw_cents: 200000, // $2,000/mo
      sort_order: 0,
    },
  })

  await prisma.nestEggAccount.upsert({
    where: { id: 'demo-nest-002' },
    update: {},
    create: {
      id: 'demo-nest-002',
      client_id: client.id,
      label: 'Joint Brokerage',
      account_type: 'non_qualified',
      current_balance_cents: 8500000, // $85,000
      monthly_contribution_cents: 50000, // $500/mo
      rate_of_return_bps: 600, // 6%
      monthly_draw_cents: 0,
      sort_order: 1,
    },
  })

  // Home equity
  await prisma.homeEquity.upsert({
    where: { client_id: client.id },
    update: {},
    create: {
      client_id: client.id,
      current_home_value_cents: 45000000,    // $450,000
      existing_mortgage_balance_cents: 18000000, // $180,000
      existing_mortgage_payment_cents: 185000,   // $1,850/mo
      home_appreciation_rate_bps: 400,
      hecm_expected_rate_bps: 550,
      hecm_payout_type: 'lump_sum',
      hecm_loc_growth_rate_bps: 600,
      hecm_payoff_mortgage: true,
    },
  })

  // Demo scenario
  await prisma.scenario.upsert({
    where: { id: 'demo-scenario-001' },
    update: {},
    create: {
      id: 'demo-scenario-001',
      client_id: client.id,
      name: 'HECM-Forward (Recommended)',
      is_active: true,
      target_monthly_income_cents: 700000, // $7,000/mo
      bucket1_draw_cents: 355000,   // SS + part-time
      bucket2_draw_cents: 200000,   // 401k draw
      bucket3_draw_cents: 0,        // lump sum payoff frees mortgage
      ss_primary_claim_age: 67,
      ss_spouse_claim_age: 67,
      inflation_rate_bps: 300,
      planning_horizon_age: 90,
      notes: 'HECM lump sum pays off mortgage, freeing $1,850/mo. SS deferred to 67 for maximum benefit.',
    },
  })

  console.log('Seed complete.')
  console.log('Admin: admin@threebuckets.com / admin123')
  console.log('Advisor: advisor@threebuckets.com / advisor123')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
