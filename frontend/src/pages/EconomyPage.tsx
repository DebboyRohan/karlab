import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { IconCopy, IconDeviceFloppy, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { Label, MoneyInput, PageHeader, PlainNumber } from "../components/fields";
import SetEditor from "../components/SetEditor";
import { money, num, people, pct } from "../format";
import { notifyError, notifyOk, useLoad } from "../hooks";
import type { CalibrationRow, Economy, Mode, PopulationSet } from "../types";

const REGION_COLOR = { urban: "ledger", semi_urban: "orange", rural: "lime" } as const;

function CalibrationPanel({ economy, dirty, save }: { economy: Economy; dirty: boolean; save: () => Promise<boolean> }) {
  const policies = useLoad(api.policies);
  const [policyId, setPolicyId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("M2");
  const [rows, setRows] = useState<CalibrationRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!policyId && policies.data?.length) {
      setPolicyId((policies.data.find((p) => p.origin === "baseline") ?? policies.data[0]).id);
    }
  }, [policies.data, policyId]);

  async function check() {
    if (!policyId) return;
    setBusy(true);
    try {
      if (dirty && !(await save())) return;
      setRows(await api.calibration(economy.id, policyId, mode));
    } catch (e) {
      notifyError(e, "Calibration failed");
    } finally {
      setBusy(false);
    }
  }

  const fmt = (r: CalibrationRow, v: number | null) =>
    v === null ? "–" : r.unit === "money" ? money(v) : r.unit === "people" ? people(v) : num(v, 3);

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed" maw={760}>
        Aggregated population sets should reproduce national totals. Run today's tax system on the economy and compare the
        simulated totals with official figures. Within 10% is marked good, within 30% needs attention.
      </Text>
      <Group align="flex-end">
        <Select label="Policy that represents today's system" data={(policies.data ?? []).map((p) => ({ value: p.id, label: p.name }))} value={policyId} onChange={setPolicyId} w={380} allowDeselect={false} />
        <Select label="Behaviour" data={[{ value: "M0", label: "M0 – mechanical" }, { value: "M1", label: "M1 – full information" }, { value: "M2", label: "M2 – information gap" }]} value={mode} onChange={(v) => setMode((v as Mode) ?? "M2")} w={220} allowDeselect={false} />
        <Button onClick={check} loading={busy}>{dirty ? "Save and check" : "Check calibration"}</Button>
      </Group>
      {rows && (
        <Card withBorder padding={0}>
          <Table.ScrollContainer minWidth={620}>
            <Table verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Aggregate</Table.Th>
                  <Table.Th ta="right">Simulated</Table.Th>
                  <Table.Th ta="right">Target</Table.Th>
                  <Table.Th ta="right">Simulated ÷ target</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((r) => (
                  <Table.Tr key={r.key}>
                    <Table.Td>{r.label}</Table.Td>
                    <Table.Td ta="right" className="num">{fmt(r, r.simulated)}</Table.Td>
                    <Table.Td ta="right" className="num">{fmt(r, r.target)}</Table.Td>
                    <Table.Td ta="right" className="num">{r.ratio === null ? "–" : `${r.ratio.toFixed(2)}×`}</Table.Td>
                    <Table.Td>
                      {r.status === null ? <Text size="xs" c="dimmed">No target</Text> : (
                        <Badge color={r.status === "good" ? "teal" : r.status === "warn" ? "yellow" : "red"} variant="light">
                          {r.status === "good" ? "Matches" : r.status === "warn" ? "Close" : "Off"}
                        </Badge>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}
    </Stack>
  );
}

export default function EconomyPage() {
  const { id = "" } = useParams();
  const loaded = useLoad(() => api.economy(id), [id]);
  const [eco, setEco] = useState<Economy | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{ index: number; set: PopulationSet } | null>(null);
  const meta = useLoad(api.meta);

  useEffect(() => {
    if (loaded.data) {
      setEco(loaded.data);
      setDirty(false);
    }
  }, [loaded.data]);

  const totals = useMemo(() => {
    if (!eco) return null;
    const pop = eco.sets.reduce((a, s) => a + s.population, 0);
    const hh = eco.sets.reduce((a, s) => a + s.population / s.demographics.household_size, 0);
    return { pop, hh };
  }, [eco]);

  if (loaded.error) return <Alert color="red" title="Could not load economy">{loaded.error}</Alert>;
  if (!eco || !totals) return <Group justify="center" p="xl"><Loader /></Group>;

  const update = (patch: Partial<Economy>) => {
    setEco({ ...eco, ...patch });
    setDirty(true);
  };

  async function save(): Promise<boolean> {
    if (!eco) return false;
    setSaving(true);
    try {
      const saved = await api.saveEconomy(eco);
      setEco(saved);
      setDirty(false);
      notifyOk("Economy saved");
      return true;
    } catch (e) {
      notifyError(e, "Could not save");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function uniqueSetId(base: string) {
    let candidate = base;
    let i = 2;
    while (eco!.sets.some((s) => s.id === candidate)) candidate = `${base}_${i++}`;
    return candidate;
  }

  function addSet() {
    if (!meta.data) return;
    const s = { ...structuredClone(meta.data.templates.population_set), id: uniqueSetId("new_set"), name: "New population set" };
    setEditing({ index: -1, set: s });
  }

  function applySet(s: PopulationSet) {
    if (!editing) return;
    const clash = eco!.sets.some((x, i) => x.id === s.id && i !== editing.index);
    if (clash) {
      notifyError(new Error(`Another set already uses the id “${s.id}”.`), "Choose a different id");
      return;
    }
    const sets = [...eco!.sets];
    if (editing.index < 0) sets.push(s);
    else sets[editing.index] = s;
    update({ sets });
    setEditing(null);
  }

  const t = eco.targets;
  const setTarget = (k: keyof Economy["targets"], v: number | null) => update({ targets: { ...t, [k]: v } });

  return (
    <>
      <PageHeader
        eyebrow="Economy"
        title={eco.name}
        description={`${eco.sets.length} population sets · ${people(totals.pop)} people · ${people(totals.hh)} households`}
        actions={
          <>
            {dirty && <Badge color="yellow" variant="light">Unsaved changes</Badge>}
            <Button leftSection={<IconDeviceFloppy size={16} />} onClick={save} loading={saving} disabled={!dirty}>
              Save
            </Button>
          </>
        }
      />

      <Tabs defaultValue="sets">
        <Tabs.List mb="md">
          <Tabs.Tab value="sets">Population sets</Tabs.Tab>
          <Tabs.Tab value="calibration">Calibration</Tabs.Tab>
          <Tabs.Tab value="details">Details & settings</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="sets">
          <Group justify="space-between" mb="sm">
            <Text size="sm" c="dimmed">Click a row to edit. Each set is sampled into synthetic households when you run a simulation.</Text>
            <Button variant="light" leftSection={<IconPlus size={16} />} onClick={addSet} disabled={!meta.data}>Add population set</Button>
          </Group>
          <Card withBorder padding={0}>
            <Table.ScrollContainer minWidth={980}>
              <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Population set</Table.Th>
                    <Table.Th>Region</Table.Th>
                    <Table.Th ta="right">People</Table.Th>
                    <Table.Th ta="right">Share</Table.Th>
                    <Table.Th ta="right">Median household income</Table.Th>
                    <Table.Th ta="right">Formal</Table.Th>
                    <Table.Th ta="right">ETI</Table.Th>
                    <Table.Th ta="right">Knows schemes</Table.Th>
                    <Table.Th w={100} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {eco.sets.map((s, i) => (
                    <Table.Tr key={s.id} style={{ cursor: "pointer" }} onClick={() => setEditing({ index: i, set: structuredClone(s) })}>
                      <Table.Td>
                        <Text size="sm" fw={600}>{s.name}</Text>
                        <Group gap={4} mt={2}>
                          {s.tags.map((tag) => <Badge key={tag} size="xs" variant="outline" color="gray">{tag}</Badge>)}
                        </Group>
                      </Table.Td>
                      <Table.Td miw={130}><Badge variant="light" color={REGION_COLOR[s.region]} style={{ overflow: "visible" }}>{s.region.replace("_", "-")}</Badge></Table.Td>
                      <Table.Td ta="right" className="num">{people(s.population)}</Table.Td>
                      <Table.Td ta="right" className="num">{pct(s.population / totals.pop)}</Table.Td>
                      <Table.Td ta="right" className="num">{money(s.income.median)}</Table.Td>
                      <Table.Td ta="right" className="num">{pct(s.formal_share, 0)}</Table.Td>
                      <Table.Td ta="right" className="num">{s.behavior.eti.toFixed(2)}</Table.Td>
                      <Table.Td ta="right" className="num">{pct(s.information.awareness.transfers ?? 1, 0)}</Table.Td>
                      <Table.Td onClick={(ev) => ev.stopPropagation()}>
                        <Group gap={2} justify="flex-end" wrap="nowrap">
                          <Tooltip label="Edit"><ActionIcon variant="subtle" color="gray" aria-label="Edit" onClick={() => setEditing({ index: i, set: structuredClone(s) })}><IconPencil size={16} /></ActionIcon></Tooltip>
                          <Tooltip label="Duplicate">
                            <ActionIcon variant="subtle" color="gray" aria-label="Duplicate" onClick={() => {
                              const copy = { ...structuredClone(s), id: uniqueSetId(`${s.id}_copy`), name: `${s.name} (copy)` };
                              const sets = [...eco.sets];
                              sets.splice(i + 1, 0, copy);
                              update({ sets });
                            }}><IconCopy size={16} /></ActionIcon>
                          </Tooltip>
                          <Tooltip label="Remove">
                            <ActionIcon variant="subtle" color="red" aria-label="Remove" disabled={eco.sets.length <= 1} onClick={() => update({ sets: eco.sets.filter((_, j) => j !== i) })}><IconTrash size={16} /></ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="calibration">
          <Stack gap="lg">
            <Card withBorder padding="md">
              <Text fw={600} mb="sm">National targets</Text>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
                <PlainNumber label="Population" value={t.population ?? 0} onChange={(v) => setTarget("population", v || null)} />
                <MoneyInput label="Total pre-tax household income" value={t.total_income ?? 0} onChange={(v) => setTarget("total_income", v || null)} />
                <MoneyInput label="Personal income tax revenue" value={t.income_tax_revenue ?? 0} onChange={(v) => setTarget("income_tax_revenue", v || null)} />
                <MoneyInput label="GST revenue" value={t.gst_revenue ?? 0} onChange={(v) => setTarget("gst_revenue", v || null)} />
                <PlainNumber label="Income tax payers" value={t.income_tax_payers ?? 0} onChange={(v) => setTarget("income_tax_payers", v || null)} />
                <NumberInput label="Gini of pre-tax income" value={t.gini_income ?? ""} onChange={(v) => setTarget("gini_income", v === "" ? null : Number(v))} min={0} max={1} step={0.01} decimalScale={3} />
              </SimpleGrid>
              <Text size="xs" c="dimmed" mt="xs">Leave a target at 0 to skip it.</Text>
            </Card>
            <CalibrationPanel economy={eco} dirty={dirty} save={save} />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="details">
          <Card withBorder padding="md" maw={820}>
            <Stack gap="sm">
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput label="Name" value={eco.name} onChange={(e) => update({ name: e.currentTarget.value })} />
                <TextInput label="Year" value={eco.year} onChange={(e) => update({ year: e.currentTarget.value })} placeholder="e.g. 2025-26" />
              </SimpleGrid>
              <Textarea label="Description" autosize minRows={3} value={eco.description} onChange={(e) => update({ description: e.currentTarget.value })} />
              <SimpleGrid cols={{ base: 1, sm: 3 }}>
                <NumberInput label={<Label text="Samples per set" help="Synthetic households drawn per set. More is smoother but slower; 1,500 is a good default." />} value={eco.settings.samples_per_set} onChange={(v) => update({ settings: { ...eco.settings, samples_per_set: Math.min(Math.max(Number(v) || 100, 100), 20000) } })} min={100} max={20000} step={500} thousandSeparator="," />
                <MoneyInput label="Poverty line (per person per year)" value={eco.settings.poverty_line_per_capita} onChange={(v) => update({ settings: { ...eco.settings, poverty_line_per_capita: Math.max(v, 1) } })} />
                <NumberInput label={<Label text="Random seed" help="Same seed, same synthetic households. Change it to check results are not luck." />} value={eco.settings.seed} onChange={(v) => update({ settings: { ...eco.settings, seed: Number(v) || 0 } })} min={0} />
              </SimpleGrid>
            </Stack>
          </Card>
        </Tabs.Panel>
      </Tabs>

      <SetEditor value={editing?.set ?? null} opened={!!editing} onClose={() => setEditing(null)} onApply={applySet} />
    </>
  );
}
