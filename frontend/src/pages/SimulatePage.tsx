import {
  Alert,
  Button,
  Card,
  Checkbox,
  Grid,
  Group,
  NumberInput,
  Radio,
  Select,
  SimpleGrid,
  Slider,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconPlayerPlay } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Label, PageHeader } from "../components/fields";
import { notifyError, useLoad } from "../hooks";
import type { Mode } from "../types";

const MODE_TEXT: Record<Mode, [string, string]> = {
  M0: ["Mechanical", "No behaviour change, full compliance, everyone claims. Fast accounting view."],
  M1: ["Full information", "Everyone knows the true rules and best-responds: effort, reporting and sector. Government moves first."],
  M2: ["Information gap", "Households act on what they know. Unaware households miss rebates, deductions and benefits."],
  M3: ["Adaptive over time", "Information gap repeated over several periods while awareness spreads and audit beliefs update."],
};

export default function SimulatePage() {
  const economies = useLoad(api.economies);
  const policies = useLoad(api.policies);
  const navigate = useNavigate();

  const [economyId, setEconomyId] = useState<string | null>(null);
  const [baselineId, setBaselineId] = useState<string | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("M2");
  const [periods, setPeriods] = useState(8);
  const [revenueNeutral, setRevenueNeutral] = useState(true);
  const [eps, setEps] = useState(1);
  const [samples, setSamples] = useState<number | "">("");
  const [name, setName] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!economyId && economies.data?.length) setEconomyId(economies.data[0].id);
  }, [economies.data, economyId]);
  useEffect(() => {
    if (!baselineId && policies.data?.length) {
      const base = policies.data.find((p) => p.origin === "baseline") ?? policies.data[0];
      setBaselineId(base.id);
      setCompare(policies.data.filter((p) => p.id !== base.id).slice(0, 3).map((p) => p.id));
    }
  }, [policies.data, baselineId]);

  async function run() {
    if (!economyId || !baselineId) return;
    setRunning(true);
    try {
      const result = await api.createRun({
        economy_id: economyId,
        baseline_policy_id: baselineId,
        policy_ids: compare.filter((id) => id !== baselineId),
        mode,
        periods,
        revenue_neutral: revenueNeutral,
        inequality_aversion: eps,
        samples_per_set: samples === "" ? null : samples,
        seed: null,
        name,
      });
      navigate(`/runs/${result.id}`);
    } catch (e) {
      notifyError(e, "The simulation failed");
    } finally {
      setRunning(false);
    }
  }

  const others = (policies.data ?? []).filter((p) => p.id !== baselineId);

  return (
    <>
      <PageHeader eyebrow="Step 3" title="Run a simulation" description="Every policy is run on the same synthetic households, so differences come from the policy, not from sampling." />
      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Stack gap="lg">
            <Card withBorder padding="lg">
              <Title order={4} mb="md">What to compare</Title>
              <Stack gap="md">
                <Select label="Economy" data={(economies.data ?? []).map((e) => ({ value: e.id, label: e.name }))} value={economyId} onChange={setEconomyId} allowDeselect={false} />
                <Select label={<Label text="Baseline policy" help="Everything is measured against this. Usually today's system." />} data={(policies.data ?? []).map((p) => ({ value: p.id, label: p.name }))} value={baselineId} onChange={setBaselineId} allowDeselect={false} />
                <div>
                  <Text size="sm" fw={500} mb={6}>Policies to test</Text>
                  <Checkbox.Group value={compare} onChange={setCompare}>
                    <Stack gap={8}>
                      {others.map((p) => (
                        <Checkbox key={p.id} value={p.id} label={p.name} description={p.description} styles={{ description: { maxWidth: 640 } }} />
                      ))}
                    </Stack>
                  </Checkbox.Group>
                </div>
              </Stack>
            </Card>
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Stack gap="lg">
            <Card withBorder padding="lg">
              <Title order={4} mb="md">How people respond</Title>
              <Radio.Group value={mode} onChange={(v) => setMode(v as Mode)}>
                <Stack gap="sm">
                  {(Object.keys(MODE_TEXT) as Mode[]).map((m) => (
                    <Radio key={m} value={m} label={`${m} · ${MODE_TEXT[m][0]}`} description={MODE_TEXT[m][1]} />
                  ))}
                </Stack>
              </Radio.Group>
              {mode === "M3" && (
                <NumberInput mt="md" label="Number of periods" value={periods} onChange={(v) => setPeriods(Math.min(Math.max(Number(v) || 1, 1), 50))} min={1} max={50} />
              )}
            </Card>
            <Card withBorder padding="lg">
              <Title order={4} mb="md">Comparison settings</Title>
              <Stack gap="md">
                <Switch
                  checked={revenueNeutral}
                  onChange={(e) => setRevenueNeutral(e.currentTarget.checked)}
                  label="Compare at equal revenue"
                  description="Returns any surplus (or covers any deficit) with an equal lump sum per household, so no policy looks better just by collecting less."
                />
                <div>
                  <Group justify="space-between" mb={4}>
                    <Text size="sm" fw={500}><Label text="Inequality aversion (ε)" help="Used by the welfare measure. 0 = rupees count the same for everyone; 1 = log; 2+ = strong preference for equality." /></Text>
                    <Text size="sm" className="num">{eps.toFixed(1)}</Text>
                  </Group>
                  <Slider value={eps} onChange={setEps} min={0} max={4} step={0.1} marks={[{ value: 0 }, { value: 1 }, { value: 2 }, { value: 4 }]} />
                </div>
                <SimpleGrid cols={2}>
                  <NumberInput label="Samples per set" placeholder="Economy default" value={samples} onChange={(v) => setSamples(v === "" ? "" : Number(v))} min={100} max={20000} step={500} thousandSeparator="," />
                  <TextInput label="Run name" placeholder="Optional" value={name} onChange={(e) => setName(e.currentTarget.value)} />
                </SimpleGrid>
              </Stack>
            </Card>
            {compare.length === 0 && <Alert color="yellow" variant="light">Select at least one policy to compare, or run the baseline alone.</Alert>}
            <Button size="md" leftSection={<IconPlayerPlay size={18} />} onClick={run} loading={running} disabled={!economyId || !baselineId}>
              Run simulation
            </Button>
          </Stack>
        </Grid.Col>
      </Grid>
    </>
  );
}
