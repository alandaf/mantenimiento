import { getSettings } from "@/lib/config";

/**
 * Aviso de instalación de demostración.
 *
 * Se muestra cuando la configuración de la instalación trae una nota. No es
 * decoración: en una planta de gas licuado, que alguien confunda una
 * frecuencia de demostración con una instrucción real es un riesgo que no vale
 * la pena correr. Por eso va arriba de todo, en cada pantalla, y no en un pie
 * de página que nadie lee.
 */
export async function DemoBanner() {
  const { notes } = await getSettings();
  if (!notes) return null;

  return (
    <div className="border-b border-warn-500/30 bg-warn-500/10 px-6 py-2.5">
      <p className="text-[11px] leading-relaxed text-warn-500">
        <span className="font-semibold uppercase tracking-wider">
          Datos de demostración ·{" "}
        </span>
        {notes}
      </p>
    </div>
  );
}
