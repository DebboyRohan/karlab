import { Anchor, Table, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

export function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** One top-level section of the Docs page; `id` is its anchor in the contents list. */
export function Section({ id, title, lead, children }: { id: string; title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="doc-section">
      <Title order={2} mb="xs">
        {title}
      </Title>
      {lead && (
        <Text size="lg" mb="md">
          {lead}
        </Text>
      )}
      {children}
    </section>
  );
}

export function H3({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <Title order={4} mt="lg" mb="xs" id={id}>
      {children}
    </Title>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <Text mb="sm">{children}</Text>;
}

export function DocTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <Table.ScrollContainer minWidth={640} mb="md">
      <Table striped withTableBorder verticalSpacing="xs" fz="sm">
        <Table.Thead>
          <Table.Tr>
            {head.map((h) => (
              <Table.Th key={h}>{h}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row, i) => (
            <Table.Tr key={i}>
              {row.map((cell, j) => (
                <Table.Td key={j}>{cell}</Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

/** An in-text citation that jumps to the entry in the reference list. */
export function Cite({ id, children }: { id: string; children: ReactNode }) {
  return (
    <Anchor
      href={`#ref-${id}`}
      onClick={(e) => {
        e.preventDefault();
        scrollToId(`ref-${id}`);
      }}
    >
      {children}
    </Anchor>
  );
}

/** A code location in the repository, shown in monospace. */
export function Src({ children }: { children: ReactNode }) {
  return <code className="doc-src">{children}</code>;
}
