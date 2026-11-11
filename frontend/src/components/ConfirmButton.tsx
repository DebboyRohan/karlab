import { ActionIcon, Button, Group, Popover, Text, Tooltip } from "@mantine/core";
import { useState, type ReactNode } from "react";

/** A destructive icon button that asks for confirmation in a popover. */
export default function ConfirmButton({
  icon,
  label,
  onConfirm,
  tooltip = "Delete",
}: {
  icon: ReactNode;
  label: string;
  onConfirm: () => void;
  tooltip?: string;
}) {
  const [opened, setOpened] = useState(false);
  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-end" withArrow shadow="md">
      <Popover.Target>
        <Tooltip label={tooltip} disabled={opened}>
          <ActionIcon variant="subtle" color="red" aria-label={tooltip} onClick={() => setOpened((o) => !o)}>
            {icon}
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown maw={260}>
        <Text size="sm" mb="sm">{label}</Text>
        <Group justify="flex-end" gap="xs">
          <Button size="xs" variant="default" onClick={() => setOpened(false)}>Cancel</Button>
          <Button size="xs" color="red" onClick={() => { setOpened(false); onConfirm(); }}>Delete</Button>
        </Group>
      </Popover.Dropdown>
    </Popover>
  );
}
