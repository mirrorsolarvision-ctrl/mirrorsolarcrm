/**
 * Recursively cleans and sanitizes data objects before sending to Cloud Firestore.
 * Cloud Firestore strictly prohibits `undefined` values and throws an error if any field
 * (even deeply nested) is undefined.
 *
 * This function:
 * 1. Drops properties whose value is `undefined`.
 * 2. Leaves `null`, boolean, numbers, and strings untouched.
 * 3. Converts Javascript `Date` instances to ISO strings.
 * 4. Preserves Firestore-native types (e.g. Timestamp, FieldValue).
 * 5. Recursively sanitizes nested plain objects and arrays (filtering out undefined items).
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return undefined as unknown as T;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (data instanceof Date) {
    return data.toISOString() as unknown as T;
  }
  // Preserve Firestore Timestamp and FieldValue instances
  if (
    typeof (data as any).toMillis === 'function' ||
    typeof (data as any).isEqual === 'function' ||
    (data as any)._methodName
  ) {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .map(item => sanitizeForFirestore(item))
      .filter(item => item !== undefined) as unknown as T;
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      const sanitized = sanitizeForFirestore(value);
      if (sanitized !== undefined) {
        result[key] = sanitized;
      }
    }
  }
  return result as T;
}
