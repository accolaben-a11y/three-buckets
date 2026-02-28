-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'advisor');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('single', 'married', 'partnered');

-- CreateEnum
CREATE TYPE "SurvivorSpouse" AS ENUM ('primary', 'spouse');

-- CreateEnum
CREATE TYPE "Owner" AS ENUM ('primary', 'spouse', 'joint');

-- CreateEnum
CREATE TYPE "IncomeType" AS ENUM ('social_security', 'wage', 'commission', 'business', 'pension', 'other');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('qualified', 'non_qualified');

-- CreateEnum
CREATE TYPE "HecmPayout" AS ENUM ('none', 'lump_sum', 'loc', 'tenure');

-- CreateEnum
CREATE TYPE "BridgeBucket" AS ENUM ('bucket1', 'bucket2', 'bucket3');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "full_name" TEXT NOT NULL,
    "contact_info" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "advisor_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "spouse_name" TEXT,
    "spouse_age" INTEGER,
    "marital_status" "MaritalStatus" NOT NULL,
    "state" TEXT NOT NULL,
    "target_retirement_age" INTEGER NOT NULL DEFAULT 62,
    "planning_horizon_age" INTEGER NOT NULL DEFAULT 90,
    "model_survivor" BOOLEAN NOT NULL DEFAULT false,
    "survivor_spouse" "SurvivorSpouse",
    "survivor_event_age" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_items" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "owner" "Owner" NOT NULL,
    "type" "IncomeType" NOT NULL,
    "label" TEXT NOT NULL,
    "monthly_amount_cents" INTEGER NOT NULL,
    "start_age" INTEGER NOT NULL,
    "end_age" INTEGER,
    "ss_age62_cents" INTEGER,
    "ss_age67_cents" INTEGER,
    "ss_age70_cents" INTEGER,
    "ss_claim_age" INTEGER,
    "pension_survivor_pct" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "income_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nest_egg_accounts" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "account_type" "AccountType" NOT NULL,
    "current_balance_cents" INTEGER NOT NULL,
    "monthly_contribution_cents" INTEGER NOT NULL DEFAULT 0,
    "rate_of_return_bps" INTEGER NOT NULL,
    "monthly_draw_cents" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "nest_egg_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_equity" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "current_home_value_cents" INTEGER NOT NULL,
    "existing_mortgage_balance_cents" INTEGER NOT NULL DEFAULT 0,
    "existing_mortgage_payment_cents" INTEGER NOT NULL DEFAULT 0,
    "home_appreciation_rate_bps" INTEGER NOT NULL DEFAULT 400,
    "hecm_expected_rate_bps" INTEGER NOT NULL DEFAULT 550,
    "hecm_payout_type" "HecmPayout" NOT NULL DEFAULT 'none',
    "hecm_tenure_monthly_cents" INTEGER NOT NULL DEFAULT 0,
    "hecm_loc_growth_rate_bps" INTEGER NOT NULL DEFAULT 600,
    "hecm_payoff_mortgage" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "home_equity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenarios" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "target_monthly_income_cents" INTEGER NOT NULL DEFAULT 0,
    "bucket1_draw_cents" INTEGER NOT NULL DEFAULT 0,
    "bucket2_draw_cents" INTEGER NOT NULL DEFAULT 0,
    "bucket3_draw_cents" INTEGER NOT NULL DEFAULT 0,
    "bridge_funding_source" "BridgeBucket",
    "ss_primary_claim_age" INTEGER NOT NULL DEFAULT 67,
    "ss_spouse_claim_age" INTEGER NOT NULL DEFAULT 67,
    "inflation_rate_bps" INTEGER NOT NULL DEFAULT 300,
    "planning_horizon_age" INTEGER NOT NULL DEFAULT 90,
    "notes" TEXT,
    "survivor_mode" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_settings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "inflation_rate_bps" INTEGER NOT NULL DEFAULT 300,
    "home_appreciation_bps" INTEGER NOT NULL DEFAULT 400,
    "loc_growth_rate_bps" INTEGER NOT NULL DEFAULT 600,
    "planning_horizon_age" INTEGER NOT NULL DEFAULT 90,
    "hecm_lending_limit_cents" INTEGER NOT NULL DEFAULT 120975000,
    "session_timeout_minutes" INTEGER NOT NULL DEFAULT 60,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "home_equity_client_id_key" ON "home_equity"("client_id");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_advisor_id_fkey" FOREIGN KEY ("advisor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_items" ADD CONSTRAINT "income_items_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nest_egg_accounts" ADD CONSTRAINT "nest_egg_accounts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_equity" ADD CONSTRAINT "home_equity_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
