# Pure Chat LLM v2.0.0 Release Notes

**Release Date**: February 15, 2026

## 🎉 Major Release: Performance & Simplification

Version 2.0.0 is a major release focused on dramatically improving performance through architectural simplification while maintaining all core functionality. This release includes **breaking changes** - please review the migration guide below.

## 📊 Key Metrics

- **Bundle Size**: 26% smaller (178KB → 131KB)
- **Code Reduction**: 3,851 lines removed, 179 lines added
- **Files Removed**: 13 files (~70KB of complex infrastructure)
- **Performance**: Faster load times and reduced memory footprint

## 🚀 What's New

### Simplified Architecture

Replaced the complex BlueFileResolver system with a lightweight recursive implementation built directly into the Chat class. The new system:

- ✅ Preserves all core features (recursive links, images, audio, sections)
- ✅ Prevents stack overflow on large media files (8KB chunked processing)
- ✅ Simpler configuration (one setting vs. complex object)
- ✅ Better cycle detection and depth limiting

### Code Quality Tools

- Added **Knip** integration for detecting unused code
- Improved type safety with @typescript-eslint/parser v8.55.0
- Enhanced error handling and edge case coverage

## 💥 Breaking Changes

### Removed Features

- **Blue Resolution Tree View**: No longer available (file resolution happens automatically)
- **Blue Resolution Graph View**: Removed along with visualization utilities
- **13 Files Removed**: Including BlueFileResolver, UI components, ports, and adapters

### API Changes

If you have custom code or plugins that interact with Pure Chat LLM:

- `getChatGPTinstructions()` no longer accepts a `context` parameter
- `completeChatResponse()` no longer accepts a `context` parameter

### Settings Changes

- **Old**: Complex `blueFileResolution` object with multiple properties
- **New**: Simple `maxRecursionDepth` number (default: 10)

### Type Removals

The following TypeScript types have been removed:

- `ResolutionEvent`
- `ResolutionNodeData`
- `ResolutionTreeData`
- `ResolutionStatus`
- `BLUE_RESOLUTION_VIEW_TYPE`

## 📝 Migration Guide

### For Regular Users

1. **Settings**: Your settings will be automatically migrated. The old `blueFileResolution` settings are replaced by a single `maxRecursionDepth` value.
2. **Views**: The Blue Resolution Tree is no longer available. File resolution now happens automatically in the background.
3. **Functionality**: All core features (recursive file links, images, audio) continue to work as before.

### For Plugin Developers

If you have custom code that uses Pure Chat LLM's API:

1. Remove the `context` parameter from calls to `getChatGPTinstructions()` and `completeChatResponse()`
2. Update any code that references removed types
3. The new `resolveContentRecursive()` method is private - use the public APIs instead

## 🔧 Technical Improvements

### Performance

- **Chunked Binary Encoding**: Large images and audio files are now processed in 8KB chunks, preventing stack overflow errors
- **Reduced Memory Footprint**: Smaller bundle size means faster loading and less memory usage
- **Optimized File Resolution**: Simpler code path with better performance

### Code Quality

- **Type Safety**: Removed unsafe type assertions, added explicit type checks
- **Error Handling**: Better handling of edge cases in recursive resolution
- **Documentation**: Comprehensive inline comments explaining design decisions

### Security

- ✅ No vulnerabilities found in CodeQL security scan
- ✅ Proper input validation and cycle detection
- ✅ Safe handling of binary data

## 📚 Full Changelog

See [CHANGELOG.md](./CHANGELOG.md) for complete details of all changes, fixes, and improvements.

## 🙏 Acknowledgments

Thank you to all users who provided feedback and helped identify areas for improvement. This release wouldn't be possible without your input!

## 📞 Support

If you encounter any issues or have questions:

- Check the [Migration Guide](#migration-guide) above
- Review the [CHANGELOG](./CHANGELOG.md)
- Open an issue on GitHub

---

**Upgrade Recommendation**: This is a recommended upgrade for all users. While there are breaking changes, the benefits in performance and simplicity make it worthwhile. Please review the migration guide before upgrading.
