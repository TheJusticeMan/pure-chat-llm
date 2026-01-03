import { defineToolParameters, InferArgs, Tool } from '../tools';
import { Notice } from 'obsidian';

const showNoticeParameters = defineToolParameters({
  type: 'object',
  properties: {
    message: {
      type: 'string',
      description: 'The message to display in the notice.',
    },
    duration: {
      type: 'integer',
      description: 'The duration in milliseconds to show the notice. Defaults to 5000.',
      default: 5000,
    },
  },
  required: ['message'],
} as const);

export type ShowNoticeArgs = InferArgs<typeof showNoticeParameters>;

export class ShowNoticeTool extends Tool<ShowNoticeArgs> {
  readonly name = 'show_obsidian_notice';
  readonly classification = 'UI';
  readonly description = 'Displays a transient toast notification (notice) in the Obsidian UI.';
  readonly parameters = showNoticeParameters;

  isAvailable(): boolean {
    return true;
  }

  async execute(args: ShowNoticeArgs): Promise<string> {
    const { message, duration = 5000 } = args;
    new Notice(message, duration);
    return `Successfully displayed notice: "${message}"`;
  }
}
