import { PageHeader, Panel } from "@/components/ui";
import {
  currencyLabel,
  getFormatters,
  getSettings,
  SUPPORTED_CURRENCIES,
  SUPPORTED_LOCALES,
} from "@/lib/config";
import { requireRole } from "@/lib/session";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configuración" };

const LOCALE_LABELS: Record<string, string> = {
  "es-CL": "Español (Chile)",
  "es-PE": "Español (Perú)",
  "es-MX": "Español (México)",
  "es-CO": "Español (Colombia)",
  "es-AR": "Español (Argentina)",
  "es-ES": "Español (España)",
  "en-US": "English (United States)",
  "pt-BR": "Português (Brasil)",
};

export default async function ConfiguracionPage() {
  await requireRole("admin");
  const [current, fmt] = await Promise.all([getSettings(), getFormatters()]);

  const sample = new Date();

  return (
    <>
      <PageHeader
        title="Configuración"
        subtitle="Moneda, formato regional y nombre de la instalación"
      />

      <div className="grid gap-5 p-6 xl:grid-cols-3">
        <Panel title="Instalación" className="xl:col-span-2">
          <SettingsForm
            current={{
              installationName: current.installationName,
              currency: current.currency,
              locale: current.locale,
              notes: current.notes,
            }}
            currencies={SUPPORTED_CURRENCIES.map((c) => ({
              value: c,
              label: `${c} — ${currencyLabel(c)}`,
            }))}
            locales={SUPPORTED_LOCALES.map((l) => ({
              value: l,
              label: LOCALE_LABELS[l] ?? l,
            }))}
          />
        </Panel>

        <div className="space-y-5">
          <Panel title="Cómo se verá">
            <dl className="space-y-3 px-5 py-4 text-xs">
              <div>
                <dt className="text-ink-400">Un monto</dt>
                <dd className="num mt-0.5 text-base font-semibold text-ink-100">
                  {fmt.money.format(4_250_000)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-400">Una fecha corta</dt>
                <dd className="num mt-0.5 text-ink-100">
                  {fmt.dateFmt.format(sample)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-400">Fecha y hora completas</dt>
                <dd className="num mt-0.5 text-ink-100">
                  {fmt.longDateTimeFmt.format(sample)}
                </dd>
              </div>
            </dl>
            <div className="border-t border-ink-800 px-5 py-3.5">
              <p className="text-[11px] leading-relaxed text-ink-400">
                Las monedas sin subunidad de uso corriente — el peso chileno
                entre ellas — se muestran sin decimales automáticamente.
              </p>
            </div>
          </Panel>

          <Panel title="Dónde se aplica">
            <ul className="space-y-1.5 px-5 py-4 text-xs leading-relaxed text-ink-300">
              <li>· Todas las pantallas de la aplicación</li>
              <li>· El reporte mensual en PDF</li>
              <li>· Las etiquetas de los formularios</li>
              <li>· Las instrucciones que recibe el modelo de IA</li>
            </ul>
            <div className="border-t border-ink-800 px-5 py-3.5">
              <p className="text-[11px] leading-relaxed text-ink-400">
                Esta configuración vive en la base de datos, no en variables de
                entorno: se cambia desde aquí, sin acceso al servidor y sin
                reiniciar nada.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
