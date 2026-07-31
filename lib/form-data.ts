// Small readers for pulling text fields out of a FormData in Server Actions.
//
// FormData.get returns `FormDataEntryValue | null` (a string or an uploaded
// File). Reading into a local lets `typeof` narrow it to string with no cast;
// non-string entries (a File, or a missing field) collapse to an empty string.

export function readString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

export function readTrimmed(formData: FormData, key: string): string {
  return readString(formData, key).trim()
}
