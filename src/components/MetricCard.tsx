/** A single labelled metric tile used in the results grid. */

interface MetricCardProps {
  label: string;
  value: string;
  /** Optional Tailwind text-colour class for the value (e.g. text-success). */
  valueClass?: string;
  hint?: string;
}

export default function MetricCard({ label, value, valueClass, hint }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${valueClass ?? "text-white"}`}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}
