export function toTitledName(displayName: string | null | undefined) {
  if (!displayName) {
    return displayName ?? ''
  }

  return displayName.charAt(0).toLocaleUpperCase('sv-SE') + displayName.slice(1)
}
