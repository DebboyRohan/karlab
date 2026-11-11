import { ActionIcon, Alert, Badge, Button, Card, Group, Modal, NumberInput, Radio, Select, Stack, Table, Text, Tooltip } from "@mantine/core";
import { IconCopy, IconMathFunction, IconPlus, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import ConfirmButton from "../components/ConfirmButton";
import { Label, PageHeader } from "../components/fields";
import { money, pct } from "../format";
import { notifyError, notifyOk, useLoad } from "../hooks";
import type { Policy } from "../types";

export const ORIGIN_BADGE: Record<Policy["origin"], { label: string; color: string }> = {
  baseline: { label: "Status quo", color: "gray" },
  theory: { label: "Theory", color: "grape" },
  user: { label: "Custom", color: "ledger" },
};

function TheoryModal({ opened, onClose, policies }: { opened: boolean; onClose: () => void; policies: Policy[] }) {
  const economies = useLoad(api.economies);
  const navigate = useNavigate();
  const [kind, setKind] = useState<"linear" | "saez">("linear");
  const [economyId, setEconomyId] = useState<string | null>(null);
  const [policyId, setPolicyId] = useState<string | null>(policies.find((p) => p.origin === "baseline")?.id ?? null);
  const [eps, setEps] = useState(1);
  const [busy, setBusy] = useState(false);
  const eco = economyId ?? economies.data?.[0]?.id ?? null;

  async function generate() {
    if (!eco) return;
    setBusy(true);
    try {
      const p = kind === "linear" ? await api.linearOptimum(eco, eps) : await api.saezTopRate(eco, policyId!, eps);
      notifyOk("Theory policy created");
      onClose();
      navigate(`/policies/${p.id}`);
    } catch (e) {
      notifyError(e, "Could not compute the theory policy");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={<Text fw={700}>Generate a policy from optimal-tax theory</Text>} size="lg">
      <Stack gap="md">
        <Radio.Group value={kind} onChange={(v) => setKind(v as "linear" | "saez")}>
          <Stack gap="sm">
            <Radio value="linear" label="Optimal flat tax with a universal grant" description="Piketty–Saez linear optimum: τ = (1 − ḡ) / (1 − ḡ + e), solved for this economy's income distribution and elasticities." />
            <Radio value="saez" label="Saez optimal top rate" description="Keep an existing policy, replace its top slab rate with τ = (1 − g) / (1 − g + a·e) using the Pareto tail above the top threshold." />
          </Stack>
        </Radio.Group>
        <Select label="Economy" data={(economies.data ?? []).map((e) => ({ value: e.id, label: e.name }))} value={eco} onChange={setEconomyId} allowDeselect={false} />
        {kind === "saez" && (
          <Select label="Policy to start from" data={policies.map((p) => ({ value: p.id, label: p.name }))} value={policyId} onChange={setPolicyId} allowDeselect={false} />
        )}
        <NumberInput label={<Label text="Inequality aversion (ε)" help="0 = only total income matters (utilitarian in money), 1 = log welfare, 2+ = strong preference for equality." />} value={eps} onChange={(v) => setEps(Number(v) || 0)} min={0} max={5} step={0.5} decimalScale={2} />
        <Alert variant="light" color="grape">
          Textbook formulas assume honest, formal, fully informed taxpayers. Comparing their result with how it performs in your
          economy is the point: it shows what the real-world frictions cost.
        </Alert>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button onClick={generate} loading={busy} disabled={!eco || (kind === "saez" && !policyId)}>Generate policy</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default function PoliciesPage() {
  const list = useLoad(api.policies);
  const navigate = useNavigate();
  const [theoryOpen, setTheoryOpen] = useState(false);

  async function createBlank() {
    try {
      const meta = await api.meta();
      const p = await api.createPolicy({ ...meta.templates.policy, name: "New policy" });
      navigate(`/policies/${p.id}`);
    } catch (e) {
      notifyError(e);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Step 2"
        title="Tax policies"
        description="A policy combines income tax slabs, GST rates, an optional wealth tax, transfer schemes and enforcement. Policies are shared across economies."
        actions={
          <>
            <Button variant="light" color="grape" leftSection={<IconMathFunction size={16} />} onClick={() => setTheoryOpen(true)}>From theory</Button>
            <Button leftSection={<IconPlus size={16} />} onClick={createBlank}>New policy</Button>
          </>
        }
      />
      {list.error && <Alert color="red" title="Could not load policies">{list.error}</Alert>}
      <Card withBorder padding={0}>
        <Table.ScrollContainer minWidth={860}>
          <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Policy</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th ta="right">Slabs</Table.Th>
                <Table.Th ta="right">Top rate</Table.Th>
                <Table.Th>GST</Table.Th>
                <Table.Th>Transfers</Table.Th>
                <Table.Th w={80} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {list.data?.map((p) => {
                const it = p.income_tax;
                const top = it.slabs[it.slabs.length - 1];
                return (
                  <Table.Tr key={p.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/policies/${p.id}`)}>
                    <Table.Td maw={420}>
                      <Text size="sm" fw={600} component={Link} to={`/policies/${p.id}`}>{p.name}</Text>
                      <Text size="xs" c="dimmed" lineClamp={2}>{p.description}</Text>
                    </Table.Td>
                    <Table.Td><Badge variant="light" color={ORIGIN_BADGE[p.origin].color}>{ORIGIN_BADGE[p.origin].label}</Badge></Table.Td>
                    <Table.Td ta="right" className="num">{it.enabled ? it.slabs.length : "off"}</Table.Td>
                    <Table.Td ta="right" className="num">{it.enabled ? `${pct(top.rate, 0)} above ${money(top.threshold)}` : "–"}</Table.Td>
                    <Table.Td>{p.consumption_tax.enabled ? Object.values(p.consumption_tax.rates).map((r) => pct(r, 0)).join(" / ") : "Off"}</Table.Td>
                    <Table.Td>{p.transfers.length ? p.transfers.map((t) => t.name).join(", ") : "None"}</Table.Td>
                    <Table.Td onClick={(ev) => ev.stopPropagation()}>
                      <Group gap={2} wrap="nowrap">
                        <Tooltip label="Duplicate">
                          <ActionIcon variant="subtle" color="gray" aria-label="Duplicate" onClick={() => api.duplicatePolicy(p.id).then(() => { notifyOk("Policy duplicated"); list.reload(); }).catch(notifyError)}>
                            <IconCopy size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <ConfirmButton icon={<IconTrash size={16} />} label={`Delete “${p.name}”?`} onConfirm={() => api.deletePolicy(p.id).then(() => { notifyOk("Policy deleted"); list.reload(); }).catch(notifyError)} />
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
      {list.data && <TheoryModal opened={theoryOpen} onClose={() => setTheoryOpen(false)} policies={list.data} />}
    </>
  );
}
