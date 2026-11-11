import { Anchor, Badge, Button, Card, Group, SimpleGrid, Stack, Table, Text, ThemeIcon, Title } from "@mantine/core";
import { IconArrowRight, IconPlayerPlay, IconReceiptTax, IconReportAnalytics, IconUsersGroup } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { PageHeader } from "../components/fields";
import { people, when } from "../format";
import { useLoad } from "../hooks";

const STEPS = [
  {
    icon: IconUsersGroup,
    title: "Describe the economy",
    text: "Build population sets: who they are, how income and wealth are distributed, what they spend on, how they behave and what they know.",
    to: "/economies",
    action: "Open economies",
  },
  {
    icon: IconReceiptTax,
    title: "Design tax policies",
    text: "Combine income tax slabs, GST rates, wealth tax, transfers and enforcement. Generate textbook optima as baselines.",
    to: "/policies",
    action: "Open policies",
  },
  {
    icon: IconPlayerPlay,
    title: "Run and compare",
    text: "Pick a baseline, the policies to test, and how people respond: no behaviour, full information, an information gap, or learning over time.",
    to: "/simulate",
    action: "Start a run",
  },
  {
    icon: IconReportAnalytics,
    title: "Read the results",
    text: "Revenue, equality, equity, efficiency and welfare for the whole economy and for every population set, with winners, losers and Pareto checks.",
    to: "/runs",
    action: "View results",
  },
];

const MODES = [
  ["M0", "Mechanical", "Nobody changes behaviour. Pure accounting: who pays what the morning after."],
  ["M1", "Full information", "Everyone knows the true rules and best-responds: work effort, reporting, sector. Government moves first (Stackelberg)."],
  ["M2", "Information gap", "People act on the policy as they perceive it. Unaware households miss rebates, deductions and benefits."],
  ["M3", "Adaptive", "M2 repeated over periods. Awareness spreads between neighbours and audit beliefs update."],
];

export default function HomePage() {
  const economies = useLoad(api.economies);
  const policies = useLoad(api.policies);
  const runs = useLoad(api.runs);

  return (
    <>
      <PageHeader
        eyebrow="KarLab"
        title="Test tax policies on a simulated economy"
        description="Describe a country as a set of population groups, design tax structures, and compare them against today's system and textbook optimal-tax theory. No code required."
      />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="xl">
        {STEPS.map((s, i) => (
          <Card key={s.title} withBorder padding="lg">
            <Stack gap="sm" h="100%">
              <Group gap="sm">
                <ThemeIcon variant="light" size="lg">
                  <s.icon size={20} />
                </ThemeIcon>
                <Text className="eyebrow">Step {i + 1}</Text>
              </Group>
              <Title order={4}>{s.title}</Title>
              <Text size="sm" c="dimmed" style={{ flex: 1 }}>
                {s.text}
              </Text>
              <Button component={Link} to={s.to} variant="subtle" rightSection={<IconArrowRight size={16} />} px={0} justify="flex-start">
                {s.action}
              </Button>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <Card withBorder padding="lg">
          <Title order={4} mb="sm">
            How people respond
          </Title>
          <Table verticalSpacing="sm">
            <Table.Tbody>
              {MODES.map(([code, name, text]) => (
                <Table.Tr key={code}>
                  <Table.Td w={60}>
                    <Badge variant="light">{code}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text fw={600} size="sm">
                      {name}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {text}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>

        <Stack gap="lg">
          <Card withBorder padding="lg">
            <Group justify="space-between" mb="xs">
              <Title order={4}>Workspace</Title>
            </Group>
            <SimpleGrid cols={3}>
              <div>
                <Text className="eyebrow">Economies</Text>
                <Text size="xl" fw={600}>{economies.data?.length ?? "–"}</Text>
              </div>
              <div>
                <Text className="eyebrow">Policies</Text>
                <Text size="xl" fw={600}>{policies.data?.length ?? "–"}</Text>
              </div>
              <div>
                <Text className="eyebrow">Saved runs</Text>
                <Text size="xl" fw={600}>{runs.data?.length ?? "–"}</Text>
              </div>
            </SimpleGrid>
            {economies.data?.map((e) => (
              <Text size="sm" mt="sm" key={e.id}>
                <Anchor component={Link} to={`/economies/${e.id}`}>{e.name}</Anchor>{" "}
                <Text span c="dimmed">· {e.set_count} sets · {people(e.population)} people</Text>
              </Text>
            ))}
          </Card>
          <Card withBorder padding="lg">
            <Title order={4} mb="xs">Recent runs</Title>
            {runs.data && runs.data.length === 0 && (
              <Text size="sm" c="dimmed">No runs yet. Start one from “Run simulation”.</Text>
            )}
            <Stack gap={6}>
              {runs.data?.slice(0, 5).map((r) => (
                <Group key={r.id} justify="space-between" wrap="nowrap">
                  <Anchor component={Link} to={`/runs/${r.id}`} size="sm" truncate>
                    {r.name}
                  </Anchor>
                  <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>{when(r.created_at)}</Text>
                </Group>
              ))}
            </Stack>
          </Card>
        </Stack>
      </SimpleGrid>
    </>
  );
}
