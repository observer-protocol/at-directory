const RAIL_LABEL: Record<string, string> = {
  lightning: '⚡ Lightning',
  bolt12: '⚡ BOLT12',
  l402: '🔒 L402',
  usdt: '₮ USDT',
};

export function RailIcon({ rail, chain }: { rail: string; chain?: string }) {
  const base = RAIL_LABEL[rail] ?? rail;
  return <span className="badge rail">{chain ? `${base}·${chain}` : base}</span>;
}
