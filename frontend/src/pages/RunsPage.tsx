import { Alert, Badge, Button, Card, Group, Table, Text } from "@mantine/core";
import { IconPlayerPlay, IconTrash } from "@tabler/icons-react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import ConfirmButton from "../components/ConfirmButton";
import { PageHeader } from "../components/fields";
import { when } from "../format";
import { notifyError, notifyOk, useLoad } from "../hooks";

export default function RunsPage() {
  const runs = useLoad(api.runs);
  const navigate = useNavigate();
  return (
    <>
      <PageHeader
        eyebrow="Step 4"
        title="Results"
        description="Every simulation is saved with its settings, so results can be reopened and compared later."
        actions={<Button component={Link} to="/simulate" leftSection={<IconPlayerPlay size={16} />}>New run</Button>}
      />
      {runs.error && <Alert color="red" title="Could not load runs">{runs.error}</Alert>}
      <Card withBorder padding={0}>
        <Table.ScrollContainer minWidth={760}>
          <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Run</Table.Th>
                <Table.Th>Mode</Table.Th>
                <Table.Th>Policies</Table.Th>
                <Table.Th>Created</Table.Th>
                <Table.Th w={50} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {runs.data?.map((r) => (
                <Table.Tr key={r.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/runs/${r.id}`)}>
                  <Table.Td>
                    <Text size="sm" fw={600} component={Link} to={`/runs/${r.id}`}>{r.name}</Text>
                    <Text size="xs" c="dimmed">{r.economy.name}</Text>
                  </Table.Td>
                  <Table.Td><Badge variant="light">{r.mode}</Badge></Table.Td>
                  <Table.Td><Text size="sm" lineClamp={2}>{r.policies.join(" · ")}</Text></Table.Td>
                  <Table.Td><Text size="sm" style={{ whiteSpace: "nowrap" }}>{when(r.created_at)}</Text></Table.Td>
                  <Table.Td onClick={(e) => e.stopPropagation()}>
                    <ConfirmButton icon={<IconTrash size={16} />} label="Delete this run?" onConfirm={() => api.deleteRun(r.id).then(() => { notifyOk("Run deleted"); runs.reload(); }).catch(notifyError)} />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        {runs.data?.length === 0 && <Group p="lg"><Text size="sm" c="dimmed">No runs yet.</Text></Group>}
      </Card>
    </>
  );
}
