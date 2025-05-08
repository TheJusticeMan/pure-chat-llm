/**
 * Converts a given string to sentence case.
 * Each word in the string will have its first letter capitalized,
 * while the rest of the letters will be in lowercase.
 *
 * @param str - The input string to be converted to sentence case.
 * @returns A new string where each word starts with an uppercase letter
 *          followed by lowercase letters.
 *
 * @example
 * ```typescript
 * const result = toSentanceCase("hello world");
 * console.log(result); // "Hello World"
 * ```
 */
export function toSentanceCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
