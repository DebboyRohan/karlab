import { ActionIcon, Alert, Button, Card, Group, Menu, Table, Text } from "@mantine/core";
import { IconCopy, IconDots, IconPlus, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { PageHeader } from "../components/fields";
import { people } from "../format";
import { notifyError, notifyOk, useLoad } from "../hooks";
import ConfirmButton from "../components/ConfirmButton";

export default function EconomiesPage() {
  const list = useLoad(api.economies);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function createBlank() {
    setBusy(true);
    try {
      const meta = await api.meta();
      const e = await api.createEconomy({
        id: "new",
        name: "New economy",
        description: "",
        currency: "₹",
        year: "",
        sets: [{ ...meta.templates.population_set, id: "set_1", name: "First population set" }],
        targets: { population: null, total_income: null, income_tax_revenue: null, gst_revenue: null, income_tax_payers: null, gini_income: null },
        settings: { samples_per_set: 1500, poverty_line_per_capita: 36000, seed: 7 },
      });
      navigate(`/economies/${e.id}`);
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Step 1"
        title="Economies"
        description="An economy is a list of population sets. Each set stands for many real people and describes their income, wealth, spending, behaviour and awareness of the tax system."
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={createBlank} loading={busy}>
            New economy
          </Button>
        }
      />
      {list.error && <Alert color="red" title="Could not load economies">{list.error}</Alert>}
      <Card withBorder padding={0}>
        <Table.ScrollContainer minWidth={640}>
          <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Year</Table.Th>
                <Table.Th ta="right">Population sets</Table.Th>
                <Table.Th ta="right">People represented</Table.Th>
                <Table.Th w={50} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {list.data?.map((e) => (
                <Table.Tr key={e.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/economies/${e.id}`)}>
                  <Table.Td>
                    <Text fw={600} size="sm" component={Link} to={`/economies/${e.id}`}>{e.name}</Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>{e.description}</Text>
                  </Table.Td>
                  <Table.Td>{e.year || "–"}</Table.Td>
                  <Table.Td ta="right" className="num">{e.set_count}</Table.Td>
                  <Table.Td ta="right" className="num">{people(e.population)}</Table.Td>
                  <Table.Td onClick={(ev) => ev.stopPropagation()}>
                    <Menu position="bottom-end">
                      <Menu.Target>
                        <ActionIcon variant="subtle" color="gray" aria-label="More actions">
                          <IconDots size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<IconCopy size={14} />}
                          onClick={() =>
                            api.duplicateEconomy(e.id).then(() => { notifyOk("Economy duplicated"); list.reload(); }).catch(notifyError)
                          }
                        >
                          Duplicate
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                    <ConfirmButton
                      icon={<IconTrash size={16} />}
                      label={`Delete “${e.name}”? This cannot be undone.`}
                      onConfirm={() => api.deleteEconomy(e.id).then(() => { notifyOk("Economy deleted"); list.reload(); }).catch(notifyError)}
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        {list.data?.length === 0 && (
          <Group p="lg"><Text c="dimmed" size="sm">No economies yet. Create one to get started.</Text></Group>
        )}
      </Card>
    </>
  );
}
