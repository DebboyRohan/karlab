import { BarChart, LineChart } from "@mantine/charts";
import {
  Alert,
  Badge,
  Card,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { IconAlertTriangle, IconCircleCheck, IconInfoCircle } from "@tabler/icons-react";
import { useMemo, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { PageHeader } from "../components/fields";
import { money, num, people, pct, rupees, signed, when } from "../format";
import { POLICY_COLORS, useLoad } from "../hooks";
import type { Run, Summary } from "../types";

type Fmt = "money" | "rupees" | "pct" | "num";
interface Metric {
  label: string;
  get: (s: Summary) => number | null | undefined;
  fmt: Fmt;
  better: "up" | "down" | null;
  help?: string;
}

const GROUPS: { title: string; metrics: Metric[] }[] = [
  {
    title: "Welfare",
    metrics: [
      { label: "Equally-distributed equivalent utility", get: (s) => s.welfare.ede_utility_pc, fmt: "rupees", better: "up", help: "The equal income per person that society would rate as good as the actual distribution (Atkinson). The headline welfare number." },
      { label: "Mean utility per person", get: (s) => s.welfare.mean_utility_pc, fmt: "rupees", better: "up", help: "Disposable income minus GST minus the money cost of effort, per person." },
      { label: "Mean disposable income per person", get: (s) => s.welfare.mean_disposable_pc, fmt: "rupees", better: "up" },
    ],
  },
  {
    title: "Revenue",
    metrics: [
      { label: "Net revenue", get: (s) => s.revenue.net, fmt: "money", better: "up", help: "All taxes and penalties minus transfer spending (including leakage) and any balancing lump sum." },
      { label: "Income tax", get: (s) => s.revenue.income_tax, fmt: "money", better: null },
      { label: "GST", get: (s) => s.revenue.gst, fmt: "money", better: null },
      { label: "Wealth tax", get: (s) => s.revenue.wealth_tax, fmt: "money", better: null },
      { label: "Audit penalties", get: (s) => s.revenue.penalties, fmt: "money", better: null },
      { label: "Transfer spending", get: (s) => s.revenue.transfer_spending, fmt: "money", better: null },
      { label: "Lost to leakage", get: (s) => s.revenue.leakage, fmt: "money", better: "down" },
    ],
  },
  {
    title: "Equality",
    metrics: [
      { label: "Gini, disposable income", get: (s) => s.equality.gini_disposable, fmt: "num", better: "down" },
      { label: "Theil index", get: (s) => s.equality.theil.total, fmt: "num", better: "down" },
      { label: "  between population sets", get: (s) => s.equality.theil.between, fmt: "num", better: "down", help: "Part of the Theil index explained by differences between set averages." },
      { label: "  within population sets", get: (s) => s.equality.theil.within, fmt: "num", better: "down" },
      { label: "Atkinson index", get: (s) => s.equality.atkinson, fmt: "num", better: "down" },
      { label: "Palma ratio (top 10% ÷ bottom 40%)", get: (s) => s.equality.palma, fmt: "num", better: "down" },
      { label: "Top 1% share", get: (s) => s.equality.top1, fmt: "pct", better: "down" },
      { label: "Top 10% share", get: (s) => s.equality.top10, fmt: "pct", better: "down" },
      { label: "Bottom 50% share", get: (s) => s.equality.bottom50, fmt: "pct", better: "up" },
      { label: "Poverty headcount", get: (s) => s.equality.poverty_headcount, fmt: "pct", better: "down" },
      { label: "Poverty gap", get: (s) => s.equality.poverty_gap, fmt: "pct", better: "down" },
    ],
  },
  {
    title: "Equity",
    metrics: [
      { label: "Redistributive effect (Reynolds–Smith)", get: (s) => s.equity.reynolds_smith, fmt: "num", better: "up", help: "Gini before taxes minus Gini after taxes and transfers." },
      { label: "Tax progressivity (Kakwani)", get: (s) => s.equity.kakwani, fmt: "num", better: "up", help: "Concentration of taxes minus Gini of pre-tax income. Positive = progressive." },
      { label: "Average net tax rate", get: (s) => s.equity.effective_tax_rate, fmt: "pct", better: null },
    ],
  },
  {
    title: "Efficiency",
    metrics: [
      { label: "Output lost to taxes", get: (s) => s.efficiency.output_loss_share, fmt: "pct", better: "down", help: "Fall in total pre-tax income compared with a world with no taxes." },
      { label: "Excess burden", get: (s) => s.efficiency.excess_burden, fmt: "money", better: "down", help: "Welfare lost beyond the revenue collected (deadweight loss plus leakage and compliance costs)." },
    ],
  },
  {
    title: "Compliance",
    metrics: [
      { label: "Formal sector share", get: (s) => s.compliance.formal_share, fmt: "pct", better: "up" },
      { label: "Formal households under-reporting", get: (s) => s.compliance.evader_share_of_formal, fmt: "pct", better: "down" },
      { label: "Income tax gap", get: (s) => s.compliance.tax_gap_share, fmt: "pct", better: "down" },
      { label: "Audit probability (equilibrium)", get: (s) => s.compliance.audit_prob, fmt: "pct", better: null },
      { label: "Income tax payers", get: (s) => s.taxpayers, fmt: "num", better: null },
    ],
  },
  {
    title: "Information gap",
    metrics: [
      { label: "Benefit capture rate", get: (s) => s.information.benefit_capture_rate, fmt: "pct", better: "up", help: "Benefits received by eligible households ÷ benefits they are entitled to." },
      { label: "Unclaimed benefits", get: (s) => s.information.unclaimed_benefits, fmt: "money", better: "down" },
      { label: "Extra tax paid from not knowing rules", get: (s) => s.information.extra_tax_from_unawareness, fmt: "money", better: "down", help: "Rebates and deductions that households were entitled to but did not use." },
    ],
  },
];

function fmtValue(v: number | null | undefined, f: Fmt) {
  if (v === null || v === undefined) return "–";
  if (f === "money") return money(v);
  if (f === "rupees") return rupees(v);
  if (f === "pct") return pct(v);
  return Math.abs(v) >= 1000 ? people(v) : num(v);
}

function fmtDelta(d: number, f: Fmt) {
  if (f === "pct") return signed(`${(d * 100).toFixed(1)} pp`, d);
  if (f === "money") return signed(money(d), d);
  if (f === "rupees") return signed(rupees(d), d);
  return signed(Math.abs(d) >= 1000 ? people(d) : d.toFixed(3), d);
}

function deltaClass(d: number, better: Metric["better"], scale: number) {
  if (!better || Math.abs(d) <= 1e-9 * Math.max(scale, 1)) return undefined;
  return (better === "up") === d > 0 ? "delta-good" : "delta-bad";
}

function HelpDot({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <Tooltip label={text} multiline w={300} withArrow>
      <IconInfoCircle size={13} style={{ opacity: 0.55, marginLeft: 4, verticalAlign: "-2px" }} />
    </Tooltip>
  );
}

function Scoreboard({ run }: { run: Run }) {
  const [base, ...rest] = run.results;
  return (
    <Card withBorder padding={0}>
      <Table.ScrollContainer minWidth={400 + run.results.length * 190}>
        <Table className="score-table" verticalSpacing={6} horizontalSpacing="md" striped="even">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Measure</Table.Th>
              <Table.Th ta="right">{base.policy_name}<Text size="xs" c="dimmed">baseline</Text></Table.Th>
              {rest.map((r) => (
                <Table.Th key={r.policy_id} ta="right" style={{ maxWidth: 220, whiteSpace: "normal" }}>{r.policy_name}</Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {GROUPS.map((g) => (
              <GroupRows key={g.title} title={g.title} metrics={g.metrics} run={run} />
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Card>
  );
}

function GroupRows({ title, metrics, run }: { title: string; metrics: Metric[]; run: Run }) {
  const [base, ...rest] = run.results;
  return (
    <>
      <Table.Tr>
        <Table.Td colSpan={run.results.length + 1} pt="md">
          <Text className="eyebrow">{title}</Text>
        </Table.Td>
      </Table.Tr>
      {metrics.map((m) => {
        const b = m.get(base.report.summary);
        return (
          <Table.Tr key={m.label}>
            <Table.Td style={{ whiteSpace: "pre" }}>
              <Text size="sm" span>{m.label}</Text>
              <HelpDot text={m.help} />
            </Table.Td>
            <Table.Td ta="right" className="num">{fmtValue(b, m.fmt)}</Table.Td>
            {rest.map((r) => {
              const v = m.get(r.report.summary);
              const d = v !== null && v !== undefined && b !== null && b !== undefined ? v - b : null;
              return (
                <Table.Td key={r.policy_id} ta="right">
                  <div className="num">{fmtValue(v, m.fmt)}</div>
                  {d !== null && (
                    <Text size="xs" className={`num ${deltaClass(d, m.better, Math.abs(b ?? 0)) ?? ""}`} c={deltaClass(d, m.better, Math.abs(b ?? 0)) ? undefined : "dimmed"}>
                      {fmtDelta(d, m.fmt)}
                    </Text>
                  )}
                </Table.Td>
              );
            })}
          </Table.Tr>
        );
      })}
    </>
  );
}

function Verdicts({ run }: { run: Run }) {
  const [base, ...rest] = run.results;
  const bs = base.report.summary;
  if (rest.length === 0) return null;
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, xl: Math.min(rest.length, 4) }} spacing="md" mb="lg">
      {rest.map((r, i) => {
        const s = r.report.summary;
        const v = r.report.versus_baseline!;
        const welfare = s.welfare.ede_utility_pc / bs.welfare.ede_utility_pc - 1;
        const revenueGap = (s.revenue.net - bs.revenue.net) / Math.max(Math.abs(bs.revenue.net), 1);
        return (
          <Card key={r.policy_id} withBorder padding="md" style={{ borderTop: `3px solid var(--mantine-color-${POLICY_COLORS[i + 1].replace(".", "-")})` }}>
            <Text fw={600} size="sm" lineClamp={2} mb="xs">{r.policy_name}</Text>
            <Group gap="xs" mb="sm">
              {v.pareto_sets ? (
                <Badge color="teal" variant="light" leftSection={<IconCircleCheck size={12} />}>No population set loses</Badge>
              ) : (
                <Badge color="orange" variant="light" leftSection={<IconAlertTriangle size={12} />}>{v.losing_sets.length} set{v.losing_sets.length === 1 ? "" : "s"} lose</Badge>
              )}
              {v.pareto_households && <Badge color="teal" variant="filled">Pareto improvement</Badge>}
            </Group>
            <SimpleGrid cols={2} spacing="xs">
              <div>
                <Text className="eyebrow">Welfare</Text>
                <Text fw={600} className={welfare > 0 ? "delta-good" : welfare < 0 ? "delta-bad" : undefined}>{signed(pct(welfare, 2), welfare)}</Text>
              </div>
              <div>
                <Text className="eyebrow">Gini</Text>
                <Text fw={600} className={deltaClass(s.equality.gini_disposable - bs.equality.gini_disposable, "down", 1)}>{signed((s.equality.gini_disposable - bs.equality.gini_disposable).toFixed(3), s.equality.gini_disposable - bs.equality.gini_disposable)}</Text>
              </div>
              <div>
                <Text className="eyebrow">Better off</Text>
                <Text fw={600}>{pct(v.better_off, 0)}</Text>
              </div>
              <div>
                <Text className="eyebrow">Worse off</Text>
                <Text fw={600}>{pct(v.worse_off, 0)}</Text>
              </div>
            </SimpleGrid>
            {run.request.revenue_neutral ? (
              <Text size="xs" c="dimmed" mt="sm">
                Balanced with {r.balancing_lump_sum >= 0 ? "a payment" : "a charge"} of {rupees(Math.abs(r.balancing_lump_sum))} per household.
              </Text>
            ) : Math.abs(revenueGap) > 0.05 ? (
              <Text size="xs" c="orange" mt="sm">Raises {signed(pct(revenueGap, 0), revenueGap)} net revenue vs baseline; compare at equal revenue for a fair test.</Text>
            ) : null}
          </Card>
        );
      })}
    </SimpleGrid>
  );
}

function heat(x: number | null) {
  if (x === null || !Number.isFinite(x)) return undefined;
  const a = Math.min(Math.abs(x) / 0.08, 1) * 0.38;
  return x >= 0 ? `rgba(20, 160, 130, ${a})` : `rgba(220, 70, 60, ${a})`;
}

function SetsTab({ run }: { run: Run }) {
  const rest = run.results.slice(1);
  const [sel, setSel] = useState(run.results[Math.min(1, run.results.length - 1)].policy_id);
  const r = run.results.find((x) => x.policy_id === sel)!;
  const vs = r.report.versus_baseline;

  return (
    <Stack gap="lg">
      {rest.length > 0 && (
        <Card withBorder padding="md">
          <Title order={5} mb={4}>Gain or loss by population set</Title>
          <Text size="xs" c="dimmed" mb="sm">Change in mean utility per person against the baseline, as a share of baseline utility.</Text>
          <Table.ScrollContainer minWidth={400 + rest.length * 150}>
            <Table verticalSpacing={4} horizontalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Population set</Table.Th>
                  {rest.map((x) => <Table.Th key={x.policy_id} ta="right" style={{ whiteSpace: "normal", maxWidth: 170 }}>{x.policy_name}</Table.Th>)}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {run.results[0].report.sets.map((s, i) => (
                  <Table.Tr key={s.id}>
                    <Table.Td><Text size="sm">{s.name}</Text></Table.Td>
                    {rest.map((x) => {
                      const g = x.report.versus_baseline!.sets[i];
                      return (
                        <Table.Td key={x.policy_id} className="heat-cell num" style={{ background: heat(g.gain_pct) }}>
                          <Tooltip label={`${rupees(g.gain_pc)} per person · ${pct(g.better_off, 0)} better off, ${pct(g.worse_off, 0)} worse off`}>
                            <span>{g.gain_pct === null ? "–" : signed(pct(g.gain_pct, 1), g.gain_pct)}</span>
                          </Tooltip>
                        </Table.Td>
                      );
                    })}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}

      <Card withBorder padding="md">
        <Group justify="space-between" mb="sm">
          <Title order={5}>Detail for one policy</Title>
          <Select data={run.results.map((x) => ({ value: x.policy_id, label: x.policy_name }))} value={sel} onChange={(v) => v && setSel(v)} w={380} allowDeselect={false} />
        </Group>
        <Table.ScrollContainer minWidth={1300}>
          <Table verticalSpacing={6} horizontalSpacing="sm" striped="even">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Population set</Table.Th>
                <Table.Th ta="right">People</Table.Th>
                <Table.Th ta="right">Pre-tax / person</Table.Th>
                <Table.Th ta="right">Disposable / person</Table.Th>
                <Table.Th ta="right">Income tax / person</Table.Th>
                <Table.Th ta="right">GST / person</Table.Th>
                <Table.Th ta="right">Transfers / person</Table.Th>
                <Table.Th ta="right">Net tax rate</Table.Th>
                <Table.Th ta="right">Formal</Table.Th>
                <Table.Th ta="right">Under-report</Table.Th>
                <Table.Th ta="right">Benefit capture</Table.Th>
                <Table.Th ta="right">Poverty</Table.Th>
                {vs && <Table.Th ta="right">Gain / person</Table.Th>}
                {vs && <Table.Th ta="right">Worse off</Table.Th>}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {r.report.sets.map((s, i) => (
                <Table.Tr key={s.id}>
                  <Table.Td><Text size="sm">{s.name}</Text></Table.Td>
                  <Table.Td ta="right" className="num">{people(s.population)}</Table.Td>
                  <Table.Td ta="right" className="num">{rupees(s.pretax_pc)}</Table.Td>
                  <Table.Td ta="right" className="num">{rupees(s.disposable_pc)}</Table.Td>
                  <Table.Td ta="right" className="num">{rupees(s.income_tax_pc)}</Table.Td>
                  <Table.Td ta="right" className="num">{rupees(s.gst_pc)}</Table.Td>
                  <Table.Td ta="right" className="num">{rupees(s.transfers_pc)}</Table.Td>
                  <Table.Td ta="right" className="num">{pct(s.effective_tax_rate)}</Table.Td>
                  <Table.Td ta="right" className="num">{pct(s.formal_share, 0)}</Table.Td>
                  <Table.Td ta="right" className="num">{pct(s.evader_share, 0)}</Table.Td>
                  <Table.Td ta="right" className="num">{pct(s.benefit_capture, 0)}</Table.Td>
                  <Table.Td ta="right" className="num">{pct(s.poverty_rate, 1)}</Table.Td>
                  {vs && <Table.Td ta="right" className={`num ${vs.sets[i].gain_pc > 1 ? "delta-good" : vs.sets[i].gain_pc < -1 ? "delta-bad" : ""}`}>{signed(rupees(vs.sets[i].gain_pc), vs.sets[i].gain_pc)}</Table.Td>}
                  {vs && <Table.Td ta="right" className="num">{pct(vs.sets[i].worse_off, 0)}</Table.Td>}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
    </Stack>
  );
}

function series(run: Run) {
  return run.results.map((r, i) => ({ name: `p${i}`, label: r.policy_name, color: POLICY_COLORS[i % POLICY_COLORS.length] }));
}

function DistributionTab({ run }: { run: Run }) {
  const [sel, setSel] = useState(run.results[0].policy_id);
  const lorenz = run.results[0].report.lorenz.pretax.map((pt, j) => {
    const row: Record<string, number> = { p: Math.round(pt.p * 100), equal: Math.round(pt.p * 1000) / 10, pre: +(pt.share * 100).toFixed(2) };
    run.results.forEach((r, i) => (row[`p${i}`] = +(r.report.lorenz.disposable[j].share * 100).toFixed(2)));
    return row;
  });
  const bands = run.results[0].report.bands.map((b, j) => {
    const row: Record<string, number | string> = { band: b.band };
    run.results.forEach((r, i) => (row[`p${i}`] = +((r.report.bands[j]?.net ?? 0) * 100).toFixed(2)));
    return row;
  });
  const chosen = run.results.find((r) => r.policy_id === sel)!;
  const comp = chosen.report.bands.map((b) => ({
    band: b.band,
    "Income tax": +(b.income_tax * 100).toFixed(2),
    GST: +(b.gst * 100).toFixed(2),
    "Wealth tax": +(b.wealth_tax * 100).toFixed(2),
    Transfers: +(b.transfers * 100).toFixed(2),
  }));

  return (
    <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
      <Card withBorder padding="md">
        <Title order={5}>Lorenz curves</Title>
        <Text size="xs" c="dimmed" mb="sm">Cumulative share of income held by the poorest x% of people. Disposable income for each policy; dashed lines show perfect equality and pre-tax income.</Text>
        <LineChart
          h={300}
          data={lorenz}
          dataKey="p"
          series={[{ name: "equal", label: "Perfect equality", color: "gray.4" }, { name: "pre", label: "Pre-tax (baseline)", color: "gray.5" }, ...series(run)]}
          strokeDasharray="0"
          withDots={false}
          unit="%"
          withLegend
          legendProps={{ verticalAlign: "bottom" }}
          xAxisLabel="Poorest % of people"
          lineProps={(s) => (s.name === "equal" || s.name === "pre" ? { strokeDasharray: "4 4" } : {})}
        />
      </Card>
      <Card withBorder padding="md">
        <Title order={5}>Net tax rate by income group</Title>
        <Text size="xs" c="dimmed" mb="sm">Taxes minus transfers as a share of pre-tax income, by percentile of income per person. Negative = net receiver.</Text>
        <LineChart h={300} data={bands} dataKey="band" series={series(run)} unit="%" withLegend legendProps={{ verticalAlign: "bottom" }} referenceLines={[{ y: 0, color: "gray.5" }]} />
      </Card>
      <Card withBorder padding="md" style={{ gridColumn: "1 / -1" }}>
        <Group justify="space-between" mb="sm">
          <div>
            <Title order={5}>What each income group pays and receives</Title>
            <Text size="xs" c="dimmed">Share of pre-tax income, by percentile.</Text>
          </div>
          <Select data={run.results.map((x) => ({ value: x.policy_id, label: x.policy_name }))} value={sel} onChange={(v) => v && setSel(v)} w={380} allowDeselect={false} />
        </Group>
        <BarChart
          h={300}
          data={comp}
          dataKey="band"
          type="stacked"
          unit="%"
          withLegend
          series={[
            { name: "Income tax", color: "ledger.6" },
            { name: "GST", color: "orange.5" },
            { name: "Wealth tax", color: "grape.5" },
            { name: "Transfers", color: "teal.5" },
          ]}
        />
      </Card>
    </SimpleGrid>
  );
}

function InfoGapTab({ run }: { run: Run }) {
  const [sel, setSel] = useState(run.results[0].policy_id);
  const chosen = run.results.find((r) => r.policy_id === sel)!;
  return (
    <Stack gap="lg">
      <Card withBorder padding={0}>
        <Table.ScrollContainer minWidth={900}>
          <Table verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Policy</Table.Th>
                <Table.Th ta="right">Benefit capture</Table.Th>
                <Table.Th ta="right">…if everyone knew</Table.Th>
                <Table.Th ta="right">Unclaimed benefits</Table.Th>
                <Table.Th ta="right">Extra tax from unawareness</Table.Th>
                <Table.Th ta="right">Welfare cost of the gap</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {run.results.map((r) => {
                const s = r.report.summary;
                const full = r.full_information;
                const cost = full ? 1 - s.welfare.ede_utility_pc / full.ede_utility_pc : null;
                return (
                  <Table.Tr key={r.policy_id}>
                    <Table.Td><Text size="sm">{r.policy_name}</Text></Table.Td>
                    <Table.Td ta="right" className="num">{pct(s.information.benefit_capture_rate)}</Table.Td>
                    <Table.Td ta="right" className="num">{pct(full?.benefit_capture_rate ?? null)}</Table.Td>
                    <Table.Td ta="right" className="num">{money(s.information.unclaimed_benefits)}</Table.Td>
                    <Table.Td ta="right" className="num">{money(s.information.extra_tax_from_unawareness)}</Table.Td>
                    <Table.Td ta="right" className="num">{cost === null ? "–" : pct(cost, 2)}</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
      <Card withBorder padding="md">
        <Group justify="space-between" mb="sm">
          <div>
            <Title order={5}>Who loses from not knowing</Title>
            <Text size="xs" c="dimmed">Utility per person under the information gap compared with full information, by set.</Text>
          </div>
          <Select data={run.results.map((x) => ({ value: x.policy_id, label: x.policy_name }))} value={sel} onChange={(v) => v && setSel(v)} w={380} allowDeselect={false} />
        </Group>
        <Table.ScrollContainer minWidth={760}>
          <Table verticalSpacing={6} striped="even">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Population set</Table.Th>
                <Table.Th ta="right">Benefit capture</Table.Th>
                <Table.Th ta="right">Extra tax / person</Table.Th>
                <Table.Th ta="right">Utility lost / person</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {chosen.report.sets.map((s, i) => {
                const full = chosen.full_information?.sets[i]?.utility_pc;
                return (
                  <Table.Tr key={s.id}>
                    <Table.Td><Text size="sm">{s.name}</Text></Table.Td>
                    <Table.Td ta="right" className="num">{pct(s.benefit_capture, 0)}</Table.Td>
                    <Table.Td ta="right" className="num">{rupees(s.unaware_extra_tax_pc)}</Table.Td>
                    <Table.Td ta="right" className="num">{full === undefined ? "–" : rupees(full - s.utility_pc)}</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
    </Stack>
  );
}

function DynamicsTab({ run }: { run: Run }) {
  const [sel, setSel] = useState(run.results[0].policy_id);
  const chosen = run.results.find((r) => r.policy_id === sel)!;
  const periods = run.results[0].history.map((h) => h.period);
  const across = (key: "net_revenue" | "gini_disposable", scale = 1) =>
    periods.map((p, j) => {
      const row: Record<string, number> = { period: p + 1 };
      run.results.forEach((r, i) => (row[`p${i}`] = +((r.history[j]?.[key] ?? 0) * scale).toFixed(4)));
      return row;
    });
  const aware = chosen.history.map((h) => ({
    period: h.period + 1,
    Rebate: +(h.aware_rebate * 100).toFixed(1),
    Deductions: +(h.aware_deductions * 100).toFixed(1),
    Transfers: +(h.aware_transfers * 100).toFixed(1),
    "Benefit capture": +((h.benefit_capture_rate ?? 0) * 100).toFixed(1),
    "Under-reporting": +(h.evader_share_of_formal * 100).toFixed(1),
  }));
  return (
    <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
      <Card withBorder padding="md">
        <Title order={5} mb="sm">Net revenue over time (₹ lakh crore)</Title>
        <LineChart h={260} data={across("net_revenue", 1e-12)} dataKey="period" series={series(run)} withLegend legendProps={{ verticalAlign: "bottom" }} xAxisLabel="Period" />
      </Card>
      <Card withBorder padding="md">
        <Title order={5} mb="sm">Gini of disposable income over time</Title>
        <LineChart h={260} data={across("gini_disposable")} dataKey="period" series={series(run)} withLegend legendProps={{ verticalAlign: "bottom" }} xAxisLabel="Period" yAxisProps={{ domain: ["auto", "auto"] }} />
      </Card>
      <Card withBorder padding="md" style={{ gridColumn: "1 / -1" }}>
        <Group justify="space-between" mb="sm">
          <Title order={5}>Awareness and behaviour over time</Title>
          <Select data={run.results.map((x) => ({ value: x.policy_id, label: x.policy_name }))} value={sel} onChange={(v) => v && setSel(v)} w={380} allowDeselect={false} />
        </Group>
        <LineChart
          h={280}
          data={aware}
          dataKey="period"
          unit="%"
          withLegend
          legendProps={{ verticalAlign: "bottom" }}
          series={[
            { name: "Rebate", color: "ledger.6" },
            { name: "Deductions", color: "cyan.6" },
            { name: "Transfers", color: "lime.7" },
            { name: "Benefit capture", color: "orange.6" },
            { name: "Under-reporting", color: "red.6" },
          ]}
          xAxisLabel="Period"
        />
      </Card>
    </SimpleGrid>
  );
}

function TransfersTab({ run }: { run: Run }) {
  return (
    <Stack gap="lg">
      {run.results.map((r) => (
        <Card key={r.policy_id} withBorder padding="md">
          <Text fw={600} mb="xs">{r.policy_name}</Text>
          {r.report.transfers.length === 0 ? <Text size="sm" c="dimmed">No transfer schemes.</Text> : (
            <Table.ScrollContainer minWidth={700}>
              <Table verticalSpacing={6}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Scheme</Table.Th>
                    <Table.Th ta="right">Households reached</Table.Th>
                    <Table.Th ta="right">Government spending</Table.Th>
                    <Table.Th ta="right">Reached households</Table.Th>
                    <Table.Th ta="right">Capture of entitlement</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {r.report.transfers.map((t) => (
                    <Table.Tr key={t.id}>
                      <Table.Td>{t.name}</Table.Td>
                      <Table.Td ta="right" className="num">{people(t.beneficiary_households)}</Table.Td>
                      <Table.Td ta="right" className="num">{money(t.spending)}</Table.Td>
                      <Table.Td ta="right" className="num">{money(t.received)}</Table.Td>
                      <Table.Td ta="right" className="num">{pct(t.capture_rate)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Card>
      ))}
    </Stack>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Text className="eyebrow">{label}</Text>
      <Text fw={600} size="sm">{children}</Text>
    </div>
  );
}

export default function RunPage() {
  const { id = "" } = useParams();
  const { data: run, error } = useLoad(() => api.run(id), [id]);
  const hasGap = useMemo(() => !!run && (run.request.mode === "M2" || run.request.mode === "M3"), [run]);

  if (error) return <Alert color="red" title="Could not load this run">{error}</Alert>;
  if (!run) return <Group justify="center" p="xl"><Loader /></Group>;

  return (
    <>
      <PageHeader eyebrow="Results" title={run.name} description={`${run.economy.name} · ${run.mode_label}${run.request.mode === "M3" ? ` · ${run.request.periods} periods` : ""}`} />
      <Card withBorder padding="md" mb="lg">
        <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }}>
          <Stat label="Baseline">{run.results[0].policy_name}</Stat>
          <Stat label="Policies tested">{run.results.length - 1}</Stat>
          <Stat label="Comparison">{run.request.revenue_neutral ? "Equal revenue" : "As designed"}</Stat>
          <Stat label="Inequality aversion">ε = {run.request.inequality_aversion}</Stat>
          <Stat label="Synthetic households">{people(run.sampled_households)} → {people(run.represented_population)} people</Stat>
          <Stat label="Computed">{when(run.created_at)} · {run.seconds}s</Stat>
        </SimpleGrid>
      </Card>

      <Verdicts run={run} />

      <Tabs defaultValue="score" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="score">Scoreboard</Tabs.Tab>
          <Tabs.Tab value="sets">Population sets</Tabs.Tab>
          <Tabs.Tab value="dist">Distribution</Tabs.Tab>
          {hasGap && <Tabs.Tab value="info">Information gap</Tabs.Tab>}
          {run.request.mode === "M3" && <Tabs.Tab value="dyn">Over time</Tabs.Tab>}
          <Tabs.Tab value="transfers">Transfers</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="score"><Scoreboard run={run} /></Tabs.Panel>
        <Tabs.Panel value="sets"><SetsTab run={run} /></Tabs.Panel>
        <Tabs.Panel value="dist"><DistributionTab run={run} /></Tabs.Panel>
        {hasGap && <Tabs.Panel value="info"><InfoGapTab run={run} /></Tabs.Panel>}
        {run.request.mode === "M3" && <Tabs.Panel value="dyn"><DynamicsTab run={run} /></Tabs.Panel>}
        <Tabs.Panel value="transfers"><TransfersTab run={run} /></Tabs.Panel>
      </Tabs>
    </>
  );
}

