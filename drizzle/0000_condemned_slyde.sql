CREATE TYPE "public"."asset_status" AS ENUM('operando', 'standby', 'detenido', 'baja');--> statement-breakpoint
CREATE TYPE "public"."criticality" AS ENUM('A', 'B', 'C');--> statement-breakpoint
CREATE TYPE "public"."failure_category" AS ENUM('mecanica', 'electrica', 'instrumentacion', 'hidraulica', 'neumatica', 'operacional', 'estructural');--> statement-breakpoint
CREATE TYPE "public"."technician_role" AS ENUM('tecnico', 'planificador', 'jefe');--> statement-breakpoint
CREATE TYPE "public"."wo_status" AS ENUM('abierta', 'asignada', 'ejecucion', 'pausada', 'cerrada', 'anulada');--> statement-breakpoint
CREATE TYPE "public"."wo_type" AS ENUM('correctivo', 'preventivo', 'predictivo', 'mejora');--> statement-breakpoint
CREATE TYPE "public"."pm_trigger" AS ENUM('calendario', 'horas', 'ambos');--> statement-breakpoint
CREATE TYPE "public"."reading_source" AS ENUM('manual', 'importacion', 'automatico');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"tag" varchar(32) NOT NULL,
	"name" varchar(160) NOT NULL,
	"parent_id" integer,
	"criticality" "criticality" DEFAULT 'C' NOT NULL,
	"status" "asset_status" DEFAULT 'operando' NOT NULL,
	"location" varchar(120),
	"manufacturer" varchar(120),
	"model" varchar(120),
	"serial_number" varchar(120),
	"downtime_cost_per_hour" integer DEFAULT 0 NOT NULL,
	"tracks_hours" boolean DEFAULT false NOT NULL,
	"notes" text,
	"installed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "failure_modes" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"code" varchar(24) NOT NULL,
	"name" varchar(160) NOT NULL,
	"category" "failure_category" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technicians" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" varchar(120) NOT NULL,
	"email" varchar(160) NOT NULL,
	"role" "technician_role" DEFAULT 'tecnico' NOT NULL,
	"specialty" varchar(80),
	"hourly_rate" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"code" varchar(24) NOT NULL,
	"asset_id" integer NOT NULL,
	"type" "wo_type" NOT NULL,
	"status" "wo_status" DEFAULT 'abierta' NOT NULL,
	"priority" smallint DEFAULT 3 NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"failure_mode_id" integer,
	"pm_plan_id" integer,
	"assigned_to" integer,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"downtime_minutes" integer DEFAULT 0 NOT NULL,
	"estimated_hours" numeric(8, 2) DEFAULT '0' NOT NULL,
	"labor_hours" numeric(8, 2) DEFAULT '0' NOT NULL,
	"labor_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"parts_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pm_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"asset_id" integer NOT NULL,
	"name" varchar(160) NOT NULL,
	"trigger" "pm_trigger" DEFAULT 'calendario' NOT NULL,
	"frequency_days" integer,
	"frequency_hours" integer,
	"estimated_hours" numeric(8, 2) DEFAULT '0' NOT NULL,
	"last_executed_at" timestamp with time zone,
	"last_executed_hours" numeric(12, 1),
	"next_due_at" timestamp with time zone,
	"next_due_hours" numeric(12, 1),
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meter_readings" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"asset_id" integer NOT NULL,
	"hours" numeric(12, 1) NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "reading_source" DEFAULT 'manual' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"organization_id" varchar(64) PRIMARY KEY DEFAULT 'default' NOT NULL,
	"installation_name" varchar(160) DEFAULT 'Instalación' NOT NULL,
	"currency" varchar(3) DEFAULT 'CLP' NOT NULL,
	"locale" varchar(12) DEFAULT 'es-CL' NOT NULL,
	"notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"scope" varchar(40) NOT NULL,
	"ref_id" integer,
	"model" varchar(60) NOT NULL,
	"prompt" text NOT NULL,
	"input_data" jsonb,
	"output" jsonb,
	"tokens_in" integer,
	"tokens_out" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"created_at" timestamp NOT NULL,
	"metadata" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_parent_id_assets_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_failure_mode_id_failure_modes_id_fk" FOREIGN KEY ("failure_mode_id") REFERENCES "public"."failure_modes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_pm_plan_id_pm_plans_id_fk" FOREIGN KEY ("pm_plan_id") REFERENCES "public"."pm_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assigned_to_technicians_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."technicians"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm_plans" ADD CONSTRAINT "pm_plans_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assets_org_tag_uq" ON "assets" USING btree ("organization_id","tag");--> statement-breakpoint
CREATE INDEX "assets_org_idx" ON "assets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "assets_parent_idx" ON "assets" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "assets_criticality_idx" ON "assets" USING btree ("criticality");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_org_code_uq" ON "failure_modes" USING btree ("organization_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "tech_org_email_uq" ON "technicians" USING btree ("organization_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "wo_org_code_uq" ON "work_orders" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "wo_org_idx" ON "work_orders" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "wo_asset_idx" ON "work_orders" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "wo_status_idx" ON "work_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wo_type_idx" ON "work_orders" USING btree ("type");--> statement-breakpoint
CREATE INDEX "wo_reported_idx" ON "work_orders" USING btree ("reported_at");--> statement-breakpoint
CREATE INDEX "wo_failure_mode_idx" ON "work_orders" USING btree ("failure_mode_id");--> statement-breakpoint
CREATE INDEX "wo_pm_plan_idx" ON "work_orders" USING btree ("pm_plan_id");--> statement-breakpoint
CREATE INDEX "pm_org_idx" ON "pm_plans" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "pm_asset_idx" ON "pm_plans" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "pm_due_idx" ON "pm_plans" USING btree ("next_due_at");--> statement-breakpoint
CREATE INDEX "pm_due_hours_idx" ON "pm_plans" USING btree ("next_due_hours");--> statement-breakpoint
CREATE INDEX "meter_org_idx" ON "meter_readings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "meter_asset_idx" ON "meter_readings" USING btree ("asset_id","taken_at");--> statement-breakpoint
CREATE UNIQUE INDEX "meter_asset_moment_uq" ON "meter_readings" USING btree ("asset_id","taken_at");--> statement-breakpoint
CREATE INDEX "ai_org_idx" ON "ai_insights" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ai_scope_idx" ON "ai_insights" USING btree ("scope","ref_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_uidx" ON "organization" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");