import {
  ActionIcon,
  AppShell,
  Burger,
  Group,
  NavLink,
  Stack,
  Text,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconBook2,
  IconChartHistogram,
  IconHome,
  IconMoon,
  IconPlayerPlay,
  IconReceiptTax,
  IconSun,
  IconUsersGroup,
} from "@tabler/icons-react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import DocsPage from "./pages/DocsPage";
import EconomiesPage from "./pages/EconomiesPage";
import EconomyPage from "./pages/EconomyPage";
import HomePage from "./pages/HomePage";
import PoliciesPage from "./pages/PoliciesPage";
import PolicyPage from "./pages/PolicyPage";
import RunPage from "./pages/RunPage";
import RunsPage from "./pages/RunsPage";
import SimulatePage from "./pages/SimulatePage";

const NAV = [
  { to: "/", label: "Overview", icon: IconHome, exact: true },
  { to: "/economies", label: "Economies", hint: "Population sets", icon: IconUsersGroup },
  { to: "/policies", label: "Tax policies", hint: "Slabs, GST, transfers", icon: IconReceiptTax },
  { to: "/simulate", label: "Run simulation", hint: "Compare policies", icon: IconPlayerPlay },
  { to: "/runs", label: "Results", hint: "Saved runs", icon: IconChartHistogram },
  { to: "/docs", label: "Docs", hint: "How the engine works", icon: IconBook2 },
];

function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme("light");
  return (
    <Tooltip label={scheme === "dark" ? "Light theme" : "Dark theme"}>
      <ActionIcon
        variant="subtle"
        color="gray"
        aria-label="Toggle colour theme"
        onClick={() => setColorScheme(scheme === "dark" ? "light" : "dark")}
      >
        {scheme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
      </ActionIcon>
    </Tooltip>
  );
}

export default function App() {
  const [opened, { toggle, close }] = useDisclosure();
  const { pathname } = useLocation();

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 240, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="lg"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <span className="nav-brand">KarLab</span>
            <Text size="xs" c="dimmed" visibleFrom="xs">
              Tax policy simulator
            </Text>
          </Group>
          <ThemeToggle />
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <Stack gap={2}>
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                component={Link}
                to={item.to}
                label={item.label}
                description={item.hint}
                leftSection={<item.icon size={18} stroke={1.6} />}
                active={active}
                onClick={close}
                variant="light"
              />
            );
          })}
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/economies" element={<EconomiesPage />} />
            <Route path="/economies/:id" element={<EconomyPage />} />
            <Route path="/policies" element={<PoliciesPage />} />
            <Route path="/policies/:id" element={<PolicyPage />} />
            <Route path="/simulate" element={<SimulatePage />} />
            <Route path="/runs" element={<RunsPage />} />
            <Route path="/runs/:id" element={<RunPage />} />
            <Route path="/docs" element={<DocsPage />} />
          </Routes>
        </div>
      </AppShell.Main>
    </AppShell>
  );
}
