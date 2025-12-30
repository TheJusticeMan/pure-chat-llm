import { defineToolParameters, InferArgs, Tool } from '../tools';
import { EditReview } from './EditReview';

const createNoteParameters = defineToolParameters({
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description:
        "The full relative path for the note within the vault, including the filename and .md extension (e.g., 'Projects/AI Agent.md').",
    },
    content: {
      type: 'string',
      description: 'The main body content of the note in Markdown format.',
    },
    properties: {
      type: 'object',
      description:
        'An optional object containing key-value pairs to be inserted as YAML frontmatter (Properties).',
      additionalProperties: {
        type: ['string', 'number', 'boolean', 'array'],
        items: { type: 'string' },
      },
    },
    overwrite: {
      type: 'boolean',
      description:
        'If true, will overwrite an existing file at the same path. Defaults to false.',
      default: false,
    },
  },
  required: ['path', 'content'],
} as const);

export type CreateNoteArgs = InferArgs<typeof createNoteParameters>;

export class CreateNoteTool extends Tool<CreateNoteArgs> {
  readonly name = 'create_obsidian_note';
  readonly description =
    'Creates a new markdown note in the Obsidian vault with optional frontmatter properties. This triggers a user review before saving.';
  readonly parameters = createNoteParameters;

  isAvailable(): boolean {
    return true; // Always available
  }

  async execute(args: CreateNoteArgs): Promise<string> {
    const { path, content, properties, overwrite } = args;
    const app = this.chat.plugin.app;

    this.status(`Requesting user approval to create/update "${path}"...`);

    // Delegate execution to the Review Modal
    return await EditReview.prompt(
      app,
      path,
      content,
      properties as Record<string, unknown> | undefined,
      overwrite ?? false,
      'Create/Update Note via Tool'
    );
  }
}