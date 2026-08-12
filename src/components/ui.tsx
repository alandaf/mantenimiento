import Link from "next/link";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-800 px-6 py-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  hint,
  children,
  className = "",
}: {
  title?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="flex items-baseline justify-between border-b border-ink-800 px-5 py-3.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-300">
            {title}
          </h2>
          {hint && <span className="text-[11px] text-ink-400">{hint}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

const TONE = {
  neutral: "text-ink-100",
  good: "text-ok-500",
  warn: "text-warn-500",
  bad: "text-bad-500",
} as const;

export function KpiCard({
  label,
  value,
  unit,
  tone = "neutral",
  footnote,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: keyof typeof TONE;
  footnote?: string;
}) {
  return (
    <div className="panel px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
        {label}
      </p>
      <p className={`num mt-2 text-3xl font-bold ${TONE[tone]}`}>
        {value}
        {unit && <span className="ml-1 text-base font-medium text-ink-400">{unit}</span>}
      </p>
      {footnote && <p className="mt-1.5 text-[11px] text-ink-400">{footnote}</p>}
    </div>
  );
}

const BADGES: Record<string, string> = {
  // criticidad
  A: "bg-bad-500/15 text-bad-500 ring-bad-500/30",
  B: "bg-warn-500/15 text-warn-500 ring-warn-500/30",
  C: "bg-ink-700 text-ink-300 ring-ink-600",
  // estado de OT
  abierta: "bg-brand-500/15 text-brand-300 ring-brand-500/30",
  asignada: "bg-brand-500/15 text-brand-300 ring-brand-500/30",
  ejecucion: "bg-warn-500/15 text-warn-500 ring-warn-500/30",
  pausada: "bg-ink-700 text-ink-300 ring-ink-600",
  cerrada: "bg-ok-500/15 text-ok-500 ring-ok-500/30",
  anulada: "bg-ink-800 text-ink-400 ring-ink-700",
  // tipo
  correctivo: "bg-bad-500/15 text-bad-500 ring-bad-500/30",
  preventivo: "bg-ok-500/15 text-ok-500 ring-ok-500/30",
  predictivo: "bg-brand-500/15 text-brand-300 ring-brand-500/30",
  mejora: "bg-ink-700 text-ink-300 ring-ink-600",
  // estado de activo
  operando: "bg-ok-500/15 text-ok-500 ring-ok-500/30",
  standby: "bg-ink-700 text-ink-300 ring-ink-600",
  detenido: "bg-bad-500/15 text-bad-500 ring-bad-500/30",
  baja: "bg-ink-800 text-ink-400 ring-ink-700",
};

export function Badge({ value, label }: { value: string; label?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset ${
        BADGES[value] ?? "bg-ink-700 text-ink-300 ring-ink-600"
      }`}
    >
      {label ?? value}
    </span>
  );
}

const PRIORITY = [
  "",
  "1 · Urgente",
  "2 · Alta",
  "3 · Media",
  "4 · Baja",
] as const;

export function PriorityTag({ priority }: { priority: number }) {
  const tone =
    priority === 1
      ? "text-bad-500"
      : priority === 2
        ? "text-warn-500"
        : "text-ink-400";
  return <span className={`text-xs font-medium ${tone}`}>{PRIORITY[priority] ?? priority}</span>;
}

export function Button({
  href,
  children,
  variant = "primary",
  type,
}: {
  href?: string;
  children: React.ReactNode;
  variant?: "primary" | "ghost";
  type?: "submit" | "button";
}) {
  const cls =
    variant === "primary"
      ? "bg-brand-500 text-white hover:bg-brand-600"
      : "border border-ink-700 text-ink-300 hover:bg-ink-800 hover:text-ink-100";
  const base = `inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition ${cls}`;

  if (href) {
    return (
      <Link href={href} className={base}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type ?? "button"} className={base}>
      {children}
    </button>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-5 py-12 text-center text-sm text-ink-400">{message}</div>
  );
}

export const money = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  maximumFractionDigits: 0,
});

export const dateFmt = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "short",
  year: "2-digit",
});

export const dateTimeFmt = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "short",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
