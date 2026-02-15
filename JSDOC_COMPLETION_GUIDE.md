# JSDoc Completion Guide

## Overview
This guide documents the pattern for completing JSDoc documentation across the codebase.

## Progress Summary

### Completed Files (✅ 0 JSDoc issues)
- ✅ `src/tools/UITools.ts` - 3 tool classes
- ✅ `src/tools/SearchTools.ts` - 3 tool classes  
- ✅ `src/tools/SystemTools.ts` - 2 tool classes + 1 modal

### Files Still Needing Completion

#### High Priority (Tool Classes)
- `src/tools/AITools.ts` - 3 classes (ImageGenerationTool, SmartConnectionsTool, SunoTool)
- `src/tools/VaultTools.ts` - 7 classes (largest file)

#### Medium Priority
- `src/core/Chat.ts` - 2 methods needing @returns
- `src/tools.ts` - Base Tool class
- `src/main.ts` - 2 methods

#### Lower Priority (UI Files)
- `src/ui/CodePreview.ts`
- `src/ui/Modals.ts`
- `src/ui/Settings.ts`
- `src/ui/SideView.ts`
- `src/ui/VoiceCallSideView.ts`

#### Utility Files
- `src/utils/BooleanSearchParser.ts`
- Various other utils

## Standard Pattern

### For Tool Classes

```typescript
/**
 * Brief description of what this tool does
 */
export class ToolName extends Tool<ArgsType> {
  readonly name = 'tool_name';
  readonly classification = 'Category'; // UI, Vault, System, or AI
  readonly description = 'User-facing description';
  readonly parameters = toolParameters;
  
  /**
   * Checks if the tool is available for use
   * @returns Always returns true as this tool is always available
   */
  isAvailable() {
    return true;
  }
  
  /**
   * Executes the tool with the given arguments
   * @param args - The arguments containing [describe key parameters]
   * @returns A formatted string with [describe what's returned]
   */
  async execute(args: ArgsType): Promise<string> {
    // implementation
  }
}
```

### For Methods Missing @returns

```typescript
/**
 * Method description
 * @param paramName - Description of the parameter
 * @returns Description of what the method returns
 */
methodName(paramName: Type): ReturnType {
  // implementation
}
```

### For Constructors

```typescript
/**
 * Creates a new instance of ClassName
 * @param param1 - Description of parameter 1
 * @param param2 - Description of parameter 2
 */
constructor(param1: Type1, param2: Type2) {
  // implementation
}
```

## Verification

After completing JSDoc for a file, verify with:
```bash
npx eslint src/path/to/file.ts
```

Should show: `✖ 0 problems`

## Common JSDoc Issues

1. **Missing @returns**: Add return value documentation
2. **Missing @param descriptions**: Add meaningful parameter descriptions
3. **Empty JSDoc blocks**: Fill with actual descriptions
4. **Incorrect @param names**: Match actual parameter names

## Tips

- Keep descriptions concise but meaningful
- Focus on WHAT the code does, not HOW
- Use present tense ("Returns", "Checks", "Executes")
- Be specific about parameter types and purposes
- Document error cases where relevant

## Current Metrics

- **Total files**: 34 TypeScript files
- **Files completed**: 3 (UITools, SearchTools, SystemTools)
- **Original issues**: 352 (103 errors, 249 warnings)
- **Estimated remaining**: ~340 issues across 31 files

## Next Steps

1. Complete AITools.ts (3 classes)
2. Complete VaultTools.ts (7 classes - largest remaining)
3. Fix core/Chat.ts methods
4. Complete UI files
5. Complete utility files
6. Run full lint to verify 0 issues

