import { BarChart } from "@mantine/charts";
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Drawer,
  Grid,
  Group,
  Loader,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Slider,
  Stack,
  Table,
  Tabs,
  TagsInput,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useEffect, useState } from "react";
import { api } from "../api";
import { money, people, pct, shortMoney } from "../format";
import type { Distribution, PopulationSet, SetPreview } from "../types";
import { Label, MoneyInput, PercentInput, PlainNumber } from "./fields";

const GST_LABELS: Record<string, string> = {
  exempt: "Exempt goods (food staples, etc.)",
  reduced: "Reduced-rate goods",
  standard: "Standard-rate goods & services",
  demerit: "Demerit / luxury goods",
};

const AWARE_LABELS: Record<string, [string, string]> = {
  rebate: ["Knows about the income tax rebate", "Unaware households do not claim the rebate (where a claim is needed)."],
  deductions: ["Knows about savings-linked deductions", "Only aware households use optional deductions like 80C."],
  transfers: ["Knows about the transfer schemes", "Unaware households do not claim benefits that need an application."],
};

function DistributionFields({ value, onChange, what }: { value: Distribution; onChange: (d: Distribution) => void; what: string }) {
  const set = (patch: Partial<Distribution>) => onChange({ ...value, ...patch });
  return (
    <Stack gap="sm">
      <Select
        label={<Label text={`${what} distribution`} help="Lognormal fits most of the population. Use a Pareto tail for groups whose top incomes are very spread out." />}
        value={value.kind}
        onChange={(v) => v && set({ kind: v as Distribution["kind"] })}
        data={[
          { value: "lognormal", label: "Lognormal" },
          { value: "lognormal_pareto", label: "Lognormal with Pareto top tail" },
          { value: "pareto", label: "Pareto (top groups)" },
        ]}
        allowDeselect={false}
      />
      <SimpleGrid cols={2}>
        <MoneyInput label={`Median household ${what.toLowerCase()}`} value={value.median} onChange={(v) => set({ median: v })} />
        {value.kind !== "pareto" && (
          <NumberInput
            label={<Label text="Spread (log σ)" help="0.3 is tight, 0.6 is typical, 1.0+ is very unequal within the set." />}
            value={value.sigma}
            onChange={(v) => set({ sigma: Number(v) || 0.01 })}
            step={0.05}
            min={0.01}
            max={3}
            decimalScale={2}
          />
        )}
        {value.kind !== "lognormal" && (
          <NumberInput
            label={<Label text="Pareto tail index (α)" help="Smaller α means a fatter tail. Top incomes are often between 1.5 and 2.5." />}
            value={value.pareto_alpha}
            onChange={(v) => set({ pareto_alpha: Math.max(Number(v) || 1.01, 1.01) })}
            step={0.1}
            min={1.01}
            decimalScale={2}
          />
        )}
        {value.kind === "lognormal_pareto" && (
          <PercentInput
            label="Tail starts at percentile"
            value={value.tail_start_quantile}
            onChange={(v) => set({ tail_start_quantile: Math.min(Math.max(v, 0.5), 0.995) })}
          />
        )}
      </SimpleGrid>
    </Stack>
  );
}

function SliderField({ label, help, value, onChange }: { label: string; help?: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Group justify="space-between" mb={4}>
        <Text size="sm" fw={500}><Label text={label} help={help} /></Text>
        <Text size="sm" className="num">{pct(value, 0)}</Text>
      </Group>
      <Slider value={value} onChange={onChange} min={0} max={1} step={0.01} label={(v) => pct(v, 0)} />
    </div>
  );
}

function Preview({ set }: { set: PopulationSet }) {
  const [debounced] = useDebouncedValue(set, 450);
  const [data, setData] = useState<SetPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [which, setWhich] = useState<"income" | "wealth">("income");

  useEffect(() => {
    let live = true;
    api.previewSet(debounced).then((d) => live && (setData(d), setError(null))).catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, [debounced]);

  if (error) return <Alert color="red" title="Preview unavailable">{error}</Alert>;
  if (!data) return <Group justify="center" p="xl"><Loader size="sm" /></Group>;

  const hist = (which === "income" ? data.income_histogram : data.wealth_histogram).map((b) => ({
    bin: shortMoney(Math.sqrt(b.lo * b.hi)),
    share: +(b.share * 100).toFixed(2),
  }));
  const stats = which === "income" ? data.income_household : data.wealth_household;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600}>Live preview</Text>
        <SegmentedControl size="xs" value={which} onChange={(v) => setWhich(v as "income" | "wealth")} data={[{ value: "income", label: "Income" }, { value: "wealth", label: "Wealth" }]} />
      </Group>
      <Text size="xs" c="dimmed">Share of people by household {which} (log scale, ₹/year)</Text>
      <BarChart h={200} data={hist} dataKey="bin" series={[{ name: "share", color: which === "income" ? "ledger.6" : "orange.6", label: "% of people" }]} tickLine="none" gridAxis="y" withTooltip valueFormatter={(v) => `${v}%`} barProps={{ radius: 2 }} />
      <Table withRowBorders={false} verticalSpacing={4} fz="sm">
        <Table.Tbody>
          {(["p10", "p25", "p50", "p75", "p90", "p99"] as const).map((k) => (
            <Table.Tr key={k}>
              <Table.Td c="dimmed">{k.toUpperCase().replace("P", "P")} household {which}</Table.Td>
              <Table.Td ta="right" className="num">{money(stats[k])}</Table.Td>
            </Table.Tr>
          ))}
          <Table.Tr>
            <Table.Td c="dimmed">Mean</Table.Td>
            <Table.Td ta="right" className="num">{money(stats.mean)}</Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>
      <Divider />
      <SimpleGrid cols={2} spacing="xs">
        <div><Text className="eyebrow">Households</Text><Text className="num">{people(data.households)}</Text></div>
        <div><Text className="eyebrow">Median income / person</Text><Text className="num">{money(data.income_per_capita.p50)}</Text></div>
        <div><Text className="eyebrow">Total income</Text><Text className="num">{money(data.total_income)}</Text></div>
        <div><Text className="eyebrow">Avg spending share</Text><Text className="num">{pct(data.spending_share)}</Text></div>
      </SimpleGrid>
    </Stack>
  );
}

export default function SetEditor({
  value,
  opened,
  onClose,
  onApply,
}: {
  value: PopulationSet | null;
  opened: boolean;
  onClose: () => void;
  onApply: (s: PopulationSet) => void;
}) {
  const [s, setS] = useState<PopulationSet | null>(value);
  useEffect(() => setS(value), [value]);
  if (!s) return null;

  const up = (patch: Partial<PopulationSet>) => setS({ ...s, ...patch });
  const sub = <K extends keyof PopulationSet>(key: K, patch: Partial<PopulationSet[K]>) =>
    setS({ ...s, [key]: { ...(s[key] as object), ...patch } } as PopulationSet);
  const src = s.income_sources;
  const srcTotal = src.wage + src.self_employment + src.agriculture + src.capital;
  const basketTotal = Object.values(s.consumption.basket).reduce((a, b) => a + b, 0);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="min(1180px, 100vw)"
      title={<Group gap="xs"><Text fw={700}>{s.name || "Population set"}</Text><Badge variant="light">{s.region.replace("_", "-")}</Badge></Group>}
    >
      <Grid gutter="xl">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Tabs defaultValue="who" keepMounted={false}>
            <Tabs.List mb="md">
              <Tabs.Tab value="who">Who</Tabs.Tab>
              <Tabs.Tab value="income">Income & wealth</Tabs.Tab>
              <Tabs.Tab value="spending">Spending</Tabs.Tab>
              <Tabs.Tab value="behaviour">Behaviour</Tabs.Tab>
              <Tabs.Tab value="information">Information</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="who">
              <Stack gap="sm">
                <SimpleGrid cols={2}>
                  <TextInput label="Name" value={s.name} onChange={(e) => up({ name: e.currentTarget.value })} />
                  <TextInput label={<Label text="Set id" help="Short unique id, used in exports. Letters, digits, _ and -." />} value={s.id} onChange={(e) => up({ id: e.currentTarget.value.replace(/[^A-Za-z0-9_-]/g, "_") })} />
                </SimpleGrid>
                <Textarea label="Description" autosize minRows={2} value={s.description} onChange={(e) => up({ description: e.currentTarget.value })} />
                <div>
                  <Text size="sm" fw={500} mb={4}>Region</Text>
                  <SegmentedControl value={s.region} onChange={(v) => up({ region: v as PopulationSet["region"] })} data={[{ value: "urban", label: "Urban" }, { value: "semi_urban", label: "Semi-urban" }, { value: "rural", label: "Rural" }]} />
                </div>
                <SimpleGrid cols={3}>
                  <PlainNumber label="People represented" value={s.population} onChange={(v) => up({ population: Math.max(v, 1) })} min={1} />
                  <NumberInput label="Household size" value={s.demographics.household_size} onChange={(v) => sub("demographics", { household_size: Math.max(Number(v) || 1, 1) })} min={1} step={0.1} decimalScale={1} />
                  <NumberInput label={<Label text="Earners per household" help="Income tax is individual in India, so household income is split across earners." />} value={s.demographics.earners_per_household} onChange={(v) => sub("demographics", { earners_per_household: Math.max(Number(v) || 1, 1) })} min={1} step={0.1} decimalScale={1} />
                </SimpleGrid>
                <TagsInput label={<Label text="Tags" help="Used by transfer targeting rules, e.g. farmer, bpl." />} value={s.tags} onChange={(v) => up({ tags: v })} placeholder="Add tag and press Enter" />
                <TagsInput label="Data sources" value={s.sources} onChange={(v) => up({ sources: v })} placeholder="e.g. PLFS 2023-24, Table 12" />
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="income">
              <Stack gap="md">
                <DistributionFields what="Income" value={s.income} onChange={(d) => up({ income: d })} />
                <Card withBorder padding="sm">
                  <Group justify="space-between" mb="xs">
                    <Text size="sm" fw={600}>Income sources</Text>
                    <Text size="xs" c={Math.abs(srcTotal - 1) < 0.005 ? "dimmed" : "orange"}>Total {pct(srcTotal, 0)} (scaled to 100%)</Text>
                  </Group>
                  <SimpleGrid cols={4}>
                    <PercentInput label="Wages" value={src.wage} onChange={(v) => sub("income_sources", { wage: v })} />
                    <PercentInput label="Self-employment" value={src.self_employment} onChange={(v) => sub("income_sources", { self_employment: v })} />
                    <PercentInput label="Agriculture" value={src.agriculture} onChange={(v) => sub("income_sources", { agriculture: v })} />
                    <PercentInput label="Capital" value={src.capital} onChange={(v) => sub("income_sources", { capital: v })} />
                  </SimpleGrid>
                </Card>
                <PercentInput label="Formal sector share" help="Share of households whose income is visible to the income tax system." value={s.formal_share} onChange={(v) => up({ formal_share: v })} />
                <Divider label="Wealth" labelPosition="left" />
                <DistributionFields what="Wealth" value={s.wealth} onChange={(d) => up({ wealth: d })} />
                <SimpleGrid cols={2}>
                  <PercentInput label="Inherited (generational) share" value={s.inherited_wealth_share} onChange={(v) => up({ inherited_wealth_share: v })} />
                  <NumberInput label={<Label text="Income–wealth correlation" help="Rank correlation between a household's income and its wealth." />} value={s.income_wealth_correlation} onChange={(v) => up({ income_wealth_correlation: Math.max(-0.99, Math.min(0.99, Number(v) || 0)) })} step={0.05} min={-0.99} max={0.99} decimalScale={2} />
                </SimpleGrid>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="spending">
              <Stack gap="md">
                <SimpleGrid cols={3}>
                  <PercentInput label="Spending share at median" help="Consumption as a share of disposable income for the median household." value={s.consumption.apc_at_median} onChange={(v) => sub("consumption", { apc_at_median: v })} max={150} />
                  <NumberInput label={<Label text="Change with income" help="Elasticity of the spending share to income. −0.15 means richer households spend a smaller share." />} value={s.consumption.apc_income_elasticity} onChange={(v) => sub("consumption", { apc_income_elasticity: Number(v) || 0 })} step={0.05} max={0.5} decimalScale={2} />
                  <PercentInput label="Bought informally" help="Share of spending where GST is not collected (local markets, cash)." value={s.consumption.informal_purchase_share} onChange={(v) => sub("consumption", { informal_purchase_share: v })} />
                </SimpleGrid>
                <Card withBorder padding="sm">
                  <Group justify="space-between" mb="xs">
                    <Text size="sm" fw={600}>What they buy (GST categories)</Text>
                    <Text size="xs" c={Math.abs(basketTotal - 1) < 0.005 ? "dimmed" : "orange"}>Total {pct(basketTotal, 0)} (scaled to 100%)</Text>
                  </Group>
                  <SimpleGrid cols={2}>
                    {Object.keys(GST_LABELS).map((k) => (
                      <PercentInput key={k} label={GST_LABELS[k]} value={s.consumption.basket[k] ?? 0} onChange={(v) => sub("consumption", { basket: { ...s.consumption.basket, [k]: v } })} />
                    ))}
                  </SimpleGrid>
                </Card>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="behaviour">
              <Stack gap="md">
                <SimpleGrid cols={2}>
                  <NumberInput label={<Label text="Elasticity of taxable income" help="How strongly reported income responds to the net-of-tax rate. Literature range 0.1–0.6; higher for top earners." />} value={s.behavior.eti} onChange={(v) => sub("behavior", { eti: Math.max(Number(v) || 0, 0) })} step={0.05} min={0} max={2} decimalScale={2} />
                  <NumberInput label={<Label text="Risk aversion" help="Relative risk aversion used in the evasion decision. 1 = log utility." />} value={s.behavior.risk_aversion} onChange={(v) => sub("behavior", { risk_aversion: Math.max(Number(v) || 0.1, 0.1) })} step={0.5} min={0.1} max={10} decimalScale={1} />
                </SimpleGrid>
                <SliderField label="Share that can switch formal/informal" value={s.behavior.mobility} onChange={(v) => sub("behavior", { mobility: v })} />
                <SliderField label="Income lost when switching sector" value={s.behavior.informality_penalty} onChange={(v) => sub("behavior", { informality_penalty: v })} />
                <SliderField label="Evadable share of the tax base" help="Income not reported by a third party (employer TDS, banks). Salaries ≈ 0–10%, small business ≈ 60–80%." value={s.behavior.evadable_share} onChange={(v) => sub("behavior", { evadable_share: v })} />
                <SliderField label="Tax morale" help="Moral cost per rupee evaded. Above (1 − audit odds × (1 + penalty)) people stop evading." value={s.behavior.tax_morale} onChange={(v) => sub("behavior", { tax_morale: v })} />
                <SliderField label="Access to avoidance" help="Share of wealth that can be kept out of a wealth tax base through planning." value={s.behavior.avoidance_access} onChange={(v) => sub("behavior", { avoidance_access: v })} />
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="information">
              <Stack gap="md">
                <Text size="sm" c="dimmed">These settings only matter in modes M2 and M3. In M0 and M1 everyone is fully informed.</Text>
                {Object.entries(AWARE_LABELS).map(([k, [label, help]]) => (
                  <SliderField key={k} label={label} help={help} value={s.information.awareness[k] ?? 1} onChange={(v) => sub("information", { awareness: { ...s.information.awareness, [k]: v } })} />
                ))}
                <div>
                  <Text size="sm" fw={500} mb={4}><Label text="How they read tax rates" help="Many people respond to their average rate rather than the marginal rate on the next rupee." /></Text>
                  <SegmentedControl value={s.information.rate_perception} onChange={(v) => sub("information", { rate_perception: v as "exact" | "average" })} data={[{ value: "exact", label: "Know the marginal rate" }, { value: "average", label: "Use the average rate" }]} />
                </div>
                <SimpleGrid cols={3}>
                  <NumberInput
                    label={<Label text="Believed audit odds" help="Leave empty to use the true probability." />}
                    value={s.information.perceived_audit_prob === null ? "" : +(s.information.perceived_audit_prob * 100).toFixed(2)}
                    onChange={(v) => sub("information", { perceived_audit_prob: v === "" ? null : Math.min(Math.max(Number(v) / 100, 0), 1) })}
                    suffix="%"
                    placeholder="Same as true"
                    min={0}
                    max={100}
                    decimalScale={2}
                  />
                  <MoneyInput label="Cost to file or claim" help="Time, travel, documents and agent fees for claiming a benefit." value={s.information.compliance_cost} onChange={(v) => sub("information", { compliance_cost: v })} />
                  <PercentInput label="Peer learning per period" help="M3 only: chance per period of learning from aware people in the same set, scaled by how many are aware." value={s.information.peer_learning} onChange={(v) => sub("information", { peer_learning: v })} />
                </SimpleGrid>
                <PercentInput label="Literacy" help="Descriptive; useful when deriving awareness from survey data." value={s.information.literacy} onChange={(v) => sub("information", { literacy: v })} />
              </Stack>
            </Tabs.Panel>
          </Tabs>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card withBorder padding="md" style={{ position: "sticky", top: 70 }}>
            <Preview set={s} />
          </Card>
        </Grid.Col>
      </Grid>
      <Group justify="flex-end" mt="xl" pb="md">
        <Button variant="default" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onApply(s)} disabled={!s.id || !s.name}>Apply changes</Button>
      </Group>
    </Drawer>
  );
}
