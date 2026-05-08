export default function Loading({ label = 'Loading...' }) {
  return (
    <div className="flex items-center gap-3 text-slate-500">
      <span className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-brand-500 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
