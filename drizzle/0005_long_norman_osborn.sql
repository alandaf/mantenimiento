CREATE TYPE "public"."task_kind" AS ENUM('verificacion', 'medicion', 'reemplazo', 'intervencion', 'registro');--> statement-breakpoint
CREATE TYPE "public"."task_result" AS ENUM('conforme', 'no_conforme', 'no_aplica');--> statement-breakpoint
CREATE TABLE "pm_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"pm_plan_id" integer NOT NULL,
	"sequence" integer NOT NULL,
	"description" varchar(300) NOT NULL,
	"kind" "task_kind" DEFAULT 'verificacion' NOT NULL,
	"expected_unit" varchar(24),
	"required" boolean DEFAULT true NOT NULL,
	"safety_note" text
);
--> statement-breakpoint
CREATE TABLE "work_order_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"work_order_id" integer NOT NULL,
	"pm_task_id" integer,
	"sequence" integer NOT NULL,
	"description" varchar(300) NOT NULL,
	"kind" "task_kind" DEFAULT 'verificacion' NOT NULL,
	"result" "task_result",
	"value" numeric(14, 4),
	"unit" varchar(24),
	"notes" text,
	"completed_at" timestamp with time zone,
	"completed_by" varchar(160)
);
--> statement-breakpoint
ALTER TABLE "pm_tasks" ADD CONSTRAINT "pm_tasks_pm_plan_id_pm_plans_id_fk" FOREIGN KEY ("pm_plan_id") REFERENCES "public"."pm_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_tasks" ADD CONSTRAINT "work_order_tasks_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_tasks" ADD CONSTRAINT "work_order_tasks_pm_task_id_pm_tasks_id_fk" FOREIGN KEY ("pm_task_id") REFERENCES "public"."pm_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pm_tasks_org_idx" ON "pm_tasks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "pm_tasks_plan_idx" ON "pm_tasks" USING btree ("pm_plan_id","sequence");--> statement-breakpoint
CREATE INDEX "wo_tasks_org_idx" ON "work_order_tasks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "wo_tasks_wo_idx" ON "work_order_tasks" USING btree ("work_order_id","sequence");