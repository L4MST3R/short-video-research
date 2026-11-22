// Hook templates are lines with blanks in square brackets: "Stop [habit]."

export function blanksOf(template: string): string[] {
  const names: string[] = [];
  for (const match of template.matchAll(/\[([^\]]+)\]/g)) {
    const name = match[1]!.trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

/** The template with each blank replaced by its value; an empty value keeps the blank. */
export function fillTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\[([^\]]+)\]/g, (whole, name: string) => {
    const value = values[name.trim()]?.trim();
    return value ? value : whole;
  });
}
