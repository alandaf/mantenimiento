CREATE TYPE "public"."attachment_category" AS ENUM('manual', 'plano', 'ficha_tecnica', 'repuestos', 'foto', 'informe', 'certificado', 'otro');--> statement-breakpoint
CREATE TYPE "public"."attachment_entity" AS ENUM('activo', 'orden_trabajo');--> statement-breakpoint
CREATE TYPE "public"."attachment_kind" AS ENUM('archivo', 'enlace');--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"entity" "attachment_entity" NOT NULL,
	"entity_id" integer NOT NULL,
	"kind" "attachment_kind" NOT NULL,
	"category" "attachment_category" DEFAULT 'otro' NOT NULL,
	"title" varchar(200) NOT NULL,
	"url" text,
	"storage_path" varchar(200),
	"file_name" varchar(200),
	"mime_type" varchar(80),
	"size_bytes" integer,
	"uploaded_by" varchar(160) NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retired_at" timestamp with time zone,
	"retired_by" varchar(160),
	"retired_reason" text
);
--> statement-breakpoint
CREATE INDEX "attachments_org_idx" ON "attachments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "attachments_entity_idx" ON "attachments" USING btree ("entity","entity_id");