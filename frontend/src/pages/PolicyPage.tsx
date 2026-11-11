import { LineChart } from "@mantine/charts";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Loader,
  MultiSelect,
  NumberInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  TagsInput,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconDeviceFloppy, IconPlus, IconTrash } from "@tabler/icons-react";
import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { Label, MoneyInput, PageHeader, PercentInput, PlainNumber } from "../components/fields";
import { shortMoney } from "../format";
import { notifyError, notifyOk, useLoad } from "../hooks";
import type { IncomeTax, Policy, SchedulePoint, Transfer } from "../types";
import { ORIGIN_BADGE } from "./PoliciesPage";

const GST_LABELS: Record<string, string> = { exempt: "Exempt", reduced: "Reduced", standard: "Standard", demerit: "Demerit / luxury" };

function Section({ title, description, right, children }: { title: string; description?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <Card withBorder padding="lg">
      <Group justify="space-between" mb="md" align="flex-start">
        <div>
          <Title order={4}>{title}</Title>
          {description && <Text size="sm" c="dimmed">{description}</Text>}
        </div>
        {right}
      </Group>
      {children}
    </Card>
  );
}

function ScheduleChart({ it }: { it: IncomeTax }) {
  const [debounced] = useDebouncedValue(it, 400);
  const [points, setPoints] = useState<SchedulePoint[] | null>(null);
  useEffect(() => {
    let live = true;
    api.schedulePreview(debounced).then((p) => live && setPoints(p)).catch(() => live && setPoints(null));
    return () => { live = false; };
  }, [debounced]);
  if (!points) return <Group justify="center" p="xl"><Loader size="sm" /></Group>;
  const data = points.filter((_, i) => i % 2 === 0).map((p) => ({
    income: shortMoney(p.income),
    Average: +(p.average_rate * 100).toFixed(2),
    Marginal: +(Math.min(p.marginal_rate, 1.5) * 100).toFixed(2),
  }));
  return (
    <>
      <Text size="xs" c="dimmed" mb={4}>Tax rate on one salaried earner's income (₹/year), with rebate and standard deduction</Text>
      <LineChart
        h={240}
        data={data}
        dataKey="income"
        series={[{ name: "Marginal", color: "orange.6" }, { name: "Average", color: "ledger.6" }]}
        curveType="stepAfter"
        withDots={false}
        unit="%"
        withLegend
        tickLine="none"
        gridAxis="xy"
        xAxisProps={{ interval: 9 }}
      />
    </>
  );
}

function TransferCard({ t, onChange, onRemove }: { t: Transfer; onChange: (t: Transfer) => void; onRemove: () => void }) {
  const set = (patch: Partial<Transfer>) => onChange({ ...t, ...patch });
  const target = (patch: Partial<Transfer["target"]>) => set({ target: { ...t.target, ...patch } });
  return (
    <Card withBorder padding="md">
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <TextInput value={t.name} onChange={(e) => set({ name: e.currentTarget.value })} aria-label="Scheme name" style={{ flex: 1 }} fw={600} />
        <ActionIcon variant="subtle" color="red" aria-label="Remove scheme" onClick={onRemove}><IconTrash size={16} /></ActionIcon>
      </Group>
      <Stack gap="sm">
        <Group grow align="flex-end">
          <div>
            <Text size="sm" fw={500} mb={4}>Who can receive it</Text>
            <SegmentedControl fullWidth value={t.kind} onChange={(v) => set({ kind: v as Transfer["kind"] })} data={[{ value: "universal", label: "Everyone" }, { value: "targeted", label: "Targeted" }]} />
          </div>
          <MoneyInput label="Amount per household / year" value={t.amount_per_household} onChange={(v) => set({ amount_per_household: v })} />
        </Group>
        {t.kind === "targeted" && (
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <MultiSelect label="Regions" placeholder="Any region" data={[{ value: "urban", label: "Urban" }, { value: "semi_urban", label: "Semi-urban" }, { value: "rural", label: "Rural" }]} value={t.target.regions ?? []} onChange={(v) => target({ regions: v.length ? (v as Transfer["target"]["regions"]) : null })} />
            <TagsInput label={<Label text="Set tags (any of)" help="Matches the tags on population sets, e.g. farmer or bpl." />} placeholder="Any set" value={t.target.tags_any ?? []} onChange={(v) => target({ tags_any: v.length ? v : null })} />
            <NumberInput label={<Label text="Means test: reported income below" help="Uses income reported to the government, so evaders and informal workers can qualify." />} placeholder="No means test" prefix="₹" thousandSeparator="," thousandsGroupStyle="lakh" value={t.target.max_reported_income ?? ""} onChange={(v) => target({ max_reported_income: v === "" ? null : Number(v) })} min={0} />
          </SimpleGrid>
        )}
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <PercentInput label="Leakage" help="Share of spending lost before reaching households." value={t.leakage} onChange={(v) => set({ leakage: Math.min(v, 0.99) })} />
          <PercentInput label="Exclusion error" help="Eligible households who claim but are wrongly left out." value={t.exclusion_error} onChange={(v) => set({ exclusion_error: v })} />
          <PercentInput label="Inclusion error" help="Ineligible households who receive it anyway." value={t.inclusion_error} onChange={(v) => set({ inclusion_error: v })} />
          <Switch mt={28} label="Needs a claim" checked={t.requires_claim} onChange={(e) => set({ requires_claim: e.currentTarget.checked })} />
        </SimpleGrid>
      </Stack>
    </Card>
  );
}

export default function PolicyPage() {
  const { id = "" } = useParams();
  const loaded = useLoad(() => api.policy(id), [id]);
  const [p, setP] = useState<Policy | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loaded.data) { setP(loaded.data); setDirty(false); }
  }, [loaded.data]);

  if (loaded.error) return <Alert color="red" title="Could not load policy">{loaded.error}</Alert>;
  if (!p) return <Group justify="center" p="xl"><Loader /></Group>;

  const up = (patch: Partial<Policy>) => { setP({ ...p, ...patch }); setDirty(true); };
  const it = p.income_tax;
  const setIt = (patch: Partial<IncomeTax>) => up({ income_tax: { ...it, ...patch } });
  const setSlab = (i: number, patch: Partial<IncomeTax["slabs"][number]>) =>
    setIt({ slabs: it.slabs.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  async function save() {
    setSaving(true);
    try {
      const sorted = { ...p!, income_tax: { ...p!.income_tax, slabs: [...p!.income_tax.slabs].sort((a, b) => a.threshold - b.threshold) } };
      const saved = await api.savePolicy(sorted);
      setP(saved);
      setDirty(false);
      notifyOk("Policy saved");
    } catch (e) {
      notifyError(e, "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Tax policy"
        title={p.name}
        description={<Badge variant="light" color={ORIGIN_BADGE[p.origin].color}>{ORIGIN_BADGE[p.origin].label}</Badge>}
        actions={
          <>
            {dirty && <Badge color="yellow" variant="light">Unsaved changes</Badge>}
            <Button leftSection={<IconDeviceFloppy size={16} />} onClick={save} loading={saving} disabled={!dirty}>Save</Button>
          </>
        }
      />
      <Stack gap="lg">
        <Card withBorder padding="lg">
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <TextInput label="Name" value={p.name} onChange={(e) => up({ name: e.currentTarget.value })} />
            <Textarea label="Description" autosize minRows={1} value={p.description} onChange={(e) => up({ description: e.currentTarget.value })} />
          </SimpleGrid>
        </Card>

        <Section
          title="Income tax"
          description="Slabs apply to each earner's taxable income after deductions."
          right={<Switch label="Enabled" checked={it.enabled} onChange={(e) => setIt({ enabled: e.currentTarget.checked })} />}
        >
          {it.enabled && (
            <Grid gutter="xl">
              <Grid.Col span={{ base: 12, lg: 6 }}>
                <Table withRowBorders={false} verticalSpacing={4}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Income above (per earner)</Table.Th>
                      <Table.Th>Rate</Table.Th>
                      <Table.Th w={40} />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {it.slabs.map((s, i) => (
                      <Table.Tr key={i}>
                        <Table.Td>
                          <NumberInput aria-label="Threshold" value={s.threshold} onChange={(v) => setSlab(i, { threshold: Number(v) || 0 })} prefix="₹" thousandSeparator="," thousandsGroupStyle="lakh" min={0} disabled={i === 0} />
                        </Table.Td>
                        <Table.Td>
                          <NumberInput aria-label="Rate" value={+(s.rate * 100).toFixed(2)} onChange={(v) => setSlab(i, { rate: Math.min(Math.max(Number(v) || 0, 0), 100) / 100 })} suffix="%" min={0} max={100} decimalScale={2} />
                        </Table.Td>
                        <Table.Td>
                          <ActionIcon variant="subtle" color="red" aria-label="Remove slab" disabled={i === 0} onClick={() => setIt({ slabs: it.slabs.filter((_, j) => j !== i) })}><IconTrash size={16} /></ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
                <Button variant="subtle" size="xs" leftSection={<IconPlus size={14} />} mt="xs" onClick={() => {
                  const last = it.slabs[it.slabs.length - 1];
                  setIt({ slabs: [...it.slabs, { threshold: last.threshold + 400000, rate: Math.min(last.rate + 0.05, 1) }] });
                }}>Add slab</Button>
                <SimpleGrid cols={{ base: 1, sm: 2 }} mt="md">
                  <MoneyInput label="Standard deduction (salaried)" value={it.standard_deduction} onChange={(v) => setIt({ standard_deduction: v })} />
                  <MoneyInput label="Savings-linked deduction cap" help="Like Section 80C. Only households aware of it, and with savings, use it." value={it.optional_deduction_cap} onChange={(v) => setIt({ optional_deduction_cap: v })} />
                  <MoneyInput label="Rebate: taxable income up to" value={it.rebate_threshold} onChange={(v) => setIt({ rebate_threshold: v })} />
                  <MoneyInput label="Rebate: maximum amount" value={it.rebate_max} onChange={(v) => setIt({ rebate_max: v })} />
                  <PercentInput label="Cess on tax" value={it.cess} onChange={(v) => setIt({ cess: Math.min(v, 0.2) })} />
                </SimpleGrid>
                <Stack gap="xs" mt="md">
                  <Switch label="Rebate must be claimed (unaware earners miss it)" checked={it.rebate_requires_claim} onChange={(e) => setIt({ rebate_requires_claim: e.currentTarget.checked })} />
                  <Switch label="Agricultural income is exempt" checked={it.exempt_agriculture} onChange={(e) => setIt({ exempt_agriculture: e.currentTarget.checked })} />
                </Stack>
              </Grid.Col>
              <Grid.Col span={{ base: 12, lg: 6 }}>
                <ScheduleChart it={it} />
              </Grid.Col>
            </Grid>
          )}
        </Section>

        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
          <Section
            title="GST"
            description="Rates by category. Each population set says how its spending splits across categories."
            right={<Switch label="Enabled" checked={p.consumption_tax.enabled} onChange={(e) => up({ consumption_tax: { ...p.consumption_tax, enabled: e.currentTarget.checked } })} />}
          >
            {p.consumption_tax.enabled && (
              <SimpleGrid cols={2}>
                {Object.keys(GST_LABELS).map((k) => (
                  <PercentInput key={k} label={GST_LABELS[k]} value={p.consumption_tax.rates[k] ?? 0} onChange={(v) => up({ consumption_tax: { ...p.consumption_tax, rates: { ...p.consumption_tax.rates, [k]: v } } })} />
                ))}
              </SimpleGrid>
            )}
          </Section>
          <Section
            title="Wealth tax"
            description="Annual tax on household net wealth above a threshold."
            right={<Switch label="Enabled" checked={p.wealth_tax.enabled} onChange={(e) => up({ wealth_tax: { ...p.wealth_tax, enabled: e.currentTarget.checked } })} />}
          >
            {p.wealth_tax.enabled && (
              <SimpleGrid cols={2}>
                <MoneyInput label="Threshold" value={p.wealth_tax.threshold} onChange={(v) => up({ wealth_tax: { ...p.wealth_tax, threshold: v } })} />
                <PercentInput label="Rate" value={p.wealth_tax.rate} onChange={(v) => up({ wealth_tax: { ...p.wealth_tax, rate: Math.min(v, 0.2) } })} />
              </SimpleGrid>
            )}
          </Section>
        </SimpleGrid>

        <Section
          title="Transfers"
          description="Cash or in-kind schemes, valued in rupees per household per year."
          right={
            <Button variant="light" size="xs" leftSection={<IconPlus size={14} />} onClick={() =>
              up({ transfers: [...p.transfers, { id: `scheme_${Date.now().toString(36)}`, name: "New scheme", kind: "targeted", amount_per_household: 6000, target: { regions: null, tags_any: null, max_reported_income: null }, requires_claim: true, leakage: 0, exclusion_error: 0, inclusion_error: 0 }] })
            }>Add scheme</Button>
          }
        >
          <Stack gap="md">
            {p.transfers.length === 0 && <Text size="sm" c="dimmed">No transfer schemes.</Text>}
            {p.transfers.map((t, i) => (
              <TransferCard key={t.id} t={t} onChange={(nt) => up({ transfers: p.transfers.map((x, j) => (j === i ? nt : x)) })} onRemove={() => up({ transfers: p.transfers.filter((_, j) => j !== i) })} />
            ))}
          </Stack>
        </Section>

        <Section title="Enforcement and outreach" description="Audits and penalties drive evasion decisions; outreach speeds up awareness in mode M3.">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            <PercentInput label="Audit probability" value={p.enforcement.audit_prob} onChange={(v) => up({ enforcement: { ...p.enforcement, audit_prob: v } })} />
            <NumberInput label={<Label text="Penalty (× tax evaded)" help="On audit, evaders repay the tax plus this multiple of it." />} value={p.enforcement.penalty_rate} onChange={(v) => up({ enforcement: { ...p.enforcement, penalty_rate: Math.max(Number(v) || 0, 0) } })} min={0} max={10} step={0.5} decimalScale={2} />
            <PlainNumber
              label="Audit capacity (households / year)"
              help="Optional. If set, audit odds = capacity ÷ number of evaders, so evasion becomes a game between households. Leave at 0 for a fixed probability."
              value={p.enforcement.audit_capacity ?? 0}
              onChange={(v) => up({ enforcement: { ...p.enforcement, audit_capacity: v > 0 ? v : null } })}
              min={0}
            />
            <PercentInput label="Awareness campaign (per period)" help="Mode M3: extra chance each period that an unaware household learns about the rules." value={p.outreach} onChange={(v) => up({ outreach: v })} />
          </SimpleGrid>
        </Section>
      </Stack>
    </>
  );
}
