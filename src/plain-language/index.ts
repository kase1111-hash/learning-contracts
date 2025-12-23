/**
 * Plain-Language Interface
 *
 * Provides conversational contract creation and plain-language summaries.
 */

export * from './types';
export { PlainLanguageParser } from './parser';
export { PlainLanguageSummarizer } from './summarizer';
export { ConversationalContractBuilder, BuilderResponse } from './builder';
export {
  CONTRACT_TEMPLATES,
  getTemplateById,
  getTemplatesByType,
  searchTemplates,
} from './templates';
