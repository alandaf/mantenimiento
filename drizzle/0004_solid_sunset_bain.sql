CREATE TYPE "public"."meter_type" AS ENUM('horas', 'ciclos', 'produccion', 'kilometros', 'otro');--> statement-breakpoint
CREATE TYPE "public"."measurement_moment" AS ENUM('antes', 'despues');--> statement-breakpoint
CREATE TABLE "measurements" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"work_order_id" integer NOT NULL,
	"moment" "measurement_moment" NOT NULL,
	"variable" varchar(80) NOT NULL,
	"value" numeric(14, 4) NOT NULL,
	"unit" varchar(24) NOT NULL,
	"threshold" numeric(14, 4),
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "work_order_materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"work_order_id" integer NOT NULL,
	"description" varchar(200) NOT NULL,
	"quantity" numeric(12, 3) DEFAULT '1' NOT NULL,
	"unit" varchar(24),
	"unit_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"part_number" varchar(80)
);
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "meter_type" "meter_type" DEFAULT 'horas' NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "hazardous_area_class" varchar(40);--> statement-breakpoint
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_materials" ADD CONSTRAINT "work_order_materials_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "measurements_org_idx" ON "measurements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "measurements_wo_idx" ON "measurements" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "measurements_serie_idx" ON "measurements" USING btree ("variable","taken_at");--> statement-breakpoint
CREATE INDEX "materials_org_idx" ON "work_order_materials" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "materials_wo_idx" ON "work_order_materials" USING btree ("work_order_id");