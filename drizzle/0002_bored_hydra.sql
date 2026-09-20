CREATE TYPE "public"."audit_action" AS ENUM('crear', 'modificar', 'cambiar_estado', 'cambiar_prioridad', 'reasignar', 'cerrar', 'anular', 'reabrir', 'aprobar', 'rechazar');--> statement-breakpoint
CREATE TYPE "public"."audit_entity" AS ENUM('orden_trabajo', 'activo', 'plan_preventivo', 'usuario', 'configuracion', 'lectura_horometro');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"entity" "audit_entity" NOT NULL,
	"entity_id" varchar(64) NOT NULL,
	"action" "audit_action" NOT NULL,
	"actor_user_id" text,
	"actor_name" varchar(160) NOT NULL,
	"actor_email" varchar(200) NOT NULL,
	"actor_role" varchar(40),
	"changes" jsonb,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_org_idx" ON "audit_log" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_log" USING btree ("created_at");