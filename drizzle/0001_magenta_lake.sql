CREATE TYPE "public"."asset_type" AS ENUM('sistema', 'conjunto', 'bomba', 'motor', 'compresor', 'valvula', 'instrumento', 'controlador', 'tablero', 'recipiente', 'intercambiador', 'transportador', 'maquina', 'vehiculo', 'generador', 'seguridad', 'otro');--> statement-breakpoint
ALTER TABLE "assets" ALTER COLUMN "criticality" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "assets" ALTER COLUMN "criticality" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."criticality";--> statement-breakpoint
CREATE TYPE "public"."criticality" AS ENUM('critica', 'alta', 'media', 'baja');--> statement-breakpoint
UPDATE "assets" SET "criticality" = CASE "criticality"
  WHEN 'A' THEN 'critica'
  WHEN 'B' THEN 'alta'
  WHEN 'C' THEN 'baja'
  ELSE "criticality"
END;--> statement-breakpoint
ALTER TABLE "assets" ALTER COLUMN "criticality" SET DATA TYPE "public"."criticality" USING "criticality"::"public"."criticality";--> statement-breakpoint
ALTER TABLE "assets" ALTER COLUMN "criticality" SET DEFAULT 'media'::"public"."criticality";--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "asset_type" "asset_type" DEFAULT 'otro' NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "has_backup" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "is_safety_system" boolean DEFAULT false NOT NULL;
