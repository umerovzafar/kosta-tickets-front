import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

type PieDataItem = { name: string; value: number; color: string }
type BarDataItem = { label: string; value: number; fullLabel?: string }

type Props = {
  pieData: PieDataItem[]
  barData: BarDataItem[]
  formatAmount: (n: number) => string
}

export function ExpensesReportCharts({ pieData, barData, formatAmount }: Props) {
  return (
    <section className="exp-report-page__charts">
      {pieData.length > 0 && (
        <div className="exp-report-page__chart-block">
          <h3 className="exp-report-page__chart-title">По категориям</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number | undefined) => formatAmount(v ?? 0)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      {barData.length > 0 && (
        <div className="exp-report-page__chart-block">
          <h3 className="exp-report-page__chart-title">Динамика</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ top: 16, right: 16, bottom: 16, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}K` : String(v))} />
              <Tooltip formatter={(v: number | undefined) => formatAmount(v ?? 0)} />
              <Bar dataKey="value" fill="var(--app-accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
