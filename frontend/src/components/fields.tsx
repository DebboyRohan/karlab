import { Group, NumberInput, type NumberInputProps, Text, Title, Tooltip } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import type { ReactNode } from "react";

type Base = Omit<NumberInputProps, "value" | "onChange">;

export function Label({ text, help }: { text: string; help?: string }) {
  if (!help) return <>{text}</>;
  return (
    <Group gap={4} wrap="nowrap" component="span">
      {text}
      <Tooltip label={help} multiline w={280} withArrow>
        <IconInfoCircle size={14} style={{ opacity: 0.6 }} />
      </Tooltip>
    </Group>
  );
}

/** Edits a 0–1 share shown as a percentage. */
export function PercentInput({
  value,
  onChange,
  label,
  help,
  ...rest
}: Base & { value: number; onChange: (v: number) => void; label: string; help?: string }) {
  return (
    <NumberInput
      label={<Label text={label} help={help} />}
      value={Math.round(value * 10000) / 100}
      onChange={(v) => onChange((typeof v === "number" ? v : Number(v) || 0) / 100)}
      suffix="%"
      min={0}
      max={100}
      decimalScale={2}
      {...rest}
    />
  );
}

/** Edits a rupee amount with Indian digit grouping. */
export function MoneyInput({
  value,
  onChange,
  label,
  help,
  ...rest
}: Base & { value: number; onChange: (v: number) => void; label: string; help?: string }) {
  return (
    <NumberInput
      label={<Label text={label} help={help} />}
      value={value}
      onChange={(v) => onChange(typeof v === "number" ? v : Number(v) || 0)}
      prefix="₹"
      thousandSeparator=","
      thousandsGroupStyle="lakh"
      min={0}
      decimalScale={0}
      {...rest}
    />
  );
}

export function PlainNumber({
  value,
  onChange,
  label,
  help,
  ...rest
}: Base & { value: number; onChange: (v: number) => void; label: string; help?: string }) {
  return (
    <NumberInput
      label={<Label text={label} help={help} />}
      value={value}
      onChange={(v) => onChange(typeof v === "number" ? v : Number(v) || 0)}
      thousandSeparator=","
      thousandsGroupStyle="lakh"
      {...rest}
    />
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Group justify="space-between" align="flex-end" mb="lg" wrap="wrap" gap="md">
      <div style={{ minWidth: 0, maxWidth: 760 }}>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <Title order={2}>{title}</Title>
        {description && (
          <Text c="dimmed" mt={4} size="sm">
            {description}
          </Text>
        )}
      </div>
      {actions && <Group gap="xs">{actions}</Group>}
    </Group>
  );
}
