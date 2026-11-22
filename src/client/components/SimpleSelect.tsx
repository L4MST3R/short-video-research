import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";

/** A Select over a fixed list of labelled values. */
export function SimpleSelect<V extends string>({
  id,
  items,
  value,
  onChange,
  className,
  testId,
  ariaLabel,
}: {
  id?: string;
  items: readonly { value: V; label: string }[];
  value: V;
  onChange: (value: V) => void;
  className?: string;
  testId?: string;
  ariaLabel?: string;
}) {
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        if (typeof next === "string") onChange(next as V);
      }}
    >
      <SelectTrigger id={id} className={className} data-testid={testId} aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
