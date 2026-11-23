export type LanguageSearchOption = {
  value: string;
  label: string;
  native?: string | null;
};

/** Match a language option against its visible name, native display name, or ISO code. */
export function matchesLanguageOption(option: LanguageSearchOption, query: string): boolean {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return true;

  return [option.label, option.value, option.native ?? ""]
    .some(value => value.toLocaleLowerCase().includes(term));
}
