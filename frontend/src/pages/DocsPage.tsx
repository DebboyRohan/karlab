import { Box, Grid, NavLink, Stack, Text } from "@mantine/core";
import { PageHeader } from "../components/fields";
import { IntroSection, OverviewSection, ParametersSection, PolicySection, RunSection, SamplerSection } from "../docs/SectionsInputs";
import { AnalyticsSection, EngineSection, ReadingSection, ReferencesSection, TheorySection } from "../docs/SectionsEngine";
import { scrollToId } from "../docs/parts";

const CONTENTS = [
  { id: "about", label: "About this guide" },
  { id: "overview", label: "At a glance" },
  { id: "parameters", label: "1 · Population parameters" },
  { id: "distributions", label: "Why these distributions", sub: true },
  { id: "sampler", label: "2 · Synthetic population" },
  { id: "policy", label: "3 · Writing a tax policy" },
  { id: "run", label: "4 · Setting up a run" },
  { id: "engine", label: "5 · The engine, step by step" },
  { id: "analytics", label: "6 · The analytics" },
  { id: "theory", label: "7 · Theory baselines" },
  { id: "reading", label: "Reading the results" },
  { id: "references", label: "References" },
];

export default function DocsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Docs"
        title="How KarLab works"
        description="From population parameters to the results screen: every step of the engine with its mathematics, the economics behind it, and references."
      />
      <Grid gutter="xl">
        <Grid.Col span={{ base: 12, lg: 9 }} className="doc-body">
          <IntroSection />
          <OverviewSection />
          <ParametersSection />
          <SamplerSection />
          <PolicySection />
          <RunSection />
          <EngineSection />
          <AnalyticsSection />
          <TheorySection />
          <ReadingSection />
          <ReferencesSection />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 3 }} visibleFrom="lg">
          <Box className="doc-toc">
            <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb="xs">
              Contents
            </Text>
            <Stack gap={0}>
              {CONTENTS.map((c) => (
                <NavLink
                  key={c.id}
                  label={c.label}
                  href={`#${c.id}`}
                  pl={c.sub ? "lg" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToId(c.id);
                  }}
                />
              ))}
            </Stack>
          </Box>
        </Grid.Col>
      </Grid>
    </>
  );
}
