ALTER TYPE "public"."asset_status" ADD VALUE 'degradado' BEFORE 'standby';--> statement-breakpoint
ALTER TYPE "public"."wo_type" ADD VALUE 'inspeccion' BEFORE 'mejora';--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "symptom" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "cause_found" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "action_performed" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "work_permit_ref" varchar(80);--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "unavailable_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "returned_to_service_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "approved_by" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "approved_at" timestamp with time zone;