import PureChatLLM from '../main';

 const nonKeyboardCharMap: [RegExp, string][] = [
  [/\u2013/g, '-'],
  [/\u2014/g, '--'],
  [/\u2019/g, "'"],
  [/\u201c/g, '"'],
  [/\u201d/g, '"'],
  [/\u2026/g, '...'],
  [/\u2018/g, "'"],
  [/\u2192/g, '->'],
  [/\u00a0/g, ' '],
  [/\u2022/g, '*'],
  [/\u2060/g, ''],
  [/\ufe0f/g, ''],
  [/\u2728/g, '*~*'],
  [/\u{1f608}/gu, '>:-)'],
  [/\u{1f338}/gu, '(*)'],
  [/\u{1f33c}/gu, '(*)'],
  [/\u{1f60a}/gu, '(^_^)'],
  [/\u{1f9ed}/gu, '|-O-|'],
  [/\u{1f54a}/gu, '(<\\~/)'],
];

const nonSafeCharacterFilter = /[^a-zA-Z`0-9~!@#$%^&*()_+\\=[\]{}|;:'",.<>/? \n\t-]/gu;

/**
 * Replaces non-keyboard characters in the input string with their keyboard equivalents.
 * @param plugin The PureChatLLM plugin instance.
 * @param input The input string to process.
 * @returns The input string with non-keyboard characters replaced.
 */
export function replaceNonKeyboardChars(plugin: PureChatLLM, input: string): string {
  const output = nonKeyboardCharMap.reduce(
    (acc, [regex, replacement]) => acc.replace(regex, replacement),
    input,
  );
  if (nonSafeCharacterFilter.test(output)) {
    plugin.console.warn('Input contains undocumented characters');
  }
  return output;
}
