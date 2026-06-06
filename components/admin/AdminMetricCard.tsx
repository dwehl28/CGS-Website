type AdminMetricCardProps = {
  label: string;
  value: string | number;
  detail: string;
};

export default function AdminMetricCard({
  label,
  value,
  detail,
}: AdminMetricCardProps) {
  return (
    <div className="subtle-grid-card rounded-[1.35rem] px-4 py-4">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{detail}</p>
    </div>
  );
}
