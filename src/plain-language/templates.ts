/**
 * Contract Templates
 *
 * Pre-defined templates for common contract patterns.
 * These accelerate contract creation by providing sensible defaults.
 */

import { ContractType, RetentionDuration, BoundaryMode } from '../types';
import { ContractTemplate, ConversationQuestion } from './types';

/**
 * Common questions used across templates
 */
const COMMON_QUESTIONS: Record<string, ConversationQuestion> = {
  specificDomains: {
    id: 'specific_domains',
    text: 'Which specific areas should this apply to?',
    answerType: 'domains',
    required: false,
    helpText: 'Leave empty to apply to all related areas, or specify to limit scope.',
  },
  retentionDuration: {
    id: 'retention_days',
    text: 'How many days should memories be kept?',
    answerType: 'duration',
    defaultValue: 30,
    required: false,
    helpText: 'Enter a number of days. After this, memories will be automatically frozen.',
  },
  tools: {
    id: 'tools',
    text: 'Which tools or environments does this apply to?',
    answerType: 'text',
    required: false,
    helpText: 'Examples: VS Code, terminal, browser, OBS',
  },
  contexts: {
    id: 'contexts',
    text: 'Are there specific contexts or projects this should apply to?',
    answerType: 'text',
    required: false,
    helpText: 'Examples: project-name, streaming, debugging',
  },
  recallApproval: {
    id: 'recall_approval',
    text: 'Should the assistant ask your permission before recalling memories?',
    answerType: 'confirm',
    defaultValue: false,
    required: false,
    helpText: 'If yes, you\'ll be asked each time. If no, memories can be recalled automatically.',
  },
};

/**
 * Template: Coding Best Practices
 * For learning reusable coding tips and techniques
 */
const CODING_TEMPLATE: ContractTemplate = {
  id: 'coding-best-practices',
  name: 'Coding Best Practices',
  description: 'Learn and remember reusable coding tips, patterns, and best practices from your programming sessions.',
  keywords: ['coding', 'programming', 'code', 'best practice', 'tip', 'pattern', 'technique', 'python', 'javascript', 'typescript'],
  defaults: {
    contractType: ContractType.PROCEDURAL,
    domains: ['coding'],
    contexts: [],
    tools: [],
    retention: RetentionDuration.PERMANENT,
    classificationCap: 3,
    allowGeneralization: true,
    generalizationConditions: [
      'Within coding domain only',
      'No personal data patterns',
      'Applied to similar contexts',
    ],
    requiresOwner: false,
    boundaryModeMin: BoundaryMode.NORMAL,
  },
  questions: [
    {
      id: 'languages',
      text: 'Which programming languages does this apply to?',
      answerType: 'text',
      required: false,
      helpText: 'Examples: Python, JavaScript, TypeScript, Go',
    },
    COMMON_QUESTIONS.contexts,
    COMMON_QUESTIONS.tools,
    COMMON_QUESTIONS.recallApproval,
  ],
  exampleSummary: 'You allow the assistant to learn and reuse coding best practices from your Python sessions in personal projects using VS Code. These tips will be stored permanently and applied automatically in similar future sessions. Nothing will be shared outside this system. You can revoke this contract at any time.',
};

/**
 * Template: Gaming/Streaming Episodes
 * For capturing specific gameplay moments
 */
const GAMING_TEMPLATE: ContractTemplate = {
  id: 'gaming-streaming',
  name: 'Gaming & Streaming Moments',
  description: 'Capture and remember specific gameplay moments, strategies, or highlights from your streams.',
  keywords: ['gaming', 'game', 'stream', 'streaming', 'gameplay', 'twitch', 'play', 'moment', 'highlight'],
  defaults: {
    contractType: ContractType.EPISODIC,
    domains: ['gaming'],
    contexts: ['streaming'],
    tools: [],
    retention: RetentionDuration.TIMEBOUND,
    classificationCap: 2,
    allowGeneralization: false,
    generalizationConditions: [],
    requiresOwner: true,
    boundaryModeMin: BoundaryMode.NORMAL,
  },
  questions: [
    {
      id: 'games',
      text: 'Which games or platforms does this apply to?',
      answerType: 'text',
      required: false,
      helpText: 'Examples: Fortnite, Minecraft, any game',
    },
    {
      id: 'streaming_platform',
      text: 'Which streaming platform are you using?',
      answerType: 'choice',
      choices: [
        { value: 'twitch', label: 'Twitch' },
        { value: 'youtube', label: 'YouTube' },
        { value: 'other', label: 'Other' },
        { value: 'none', label: 'Not streaming' },
      ],
      required: false,
    },
    COMMON_QUESTIONS.retentionDuration,
    COMMON_QUESTIONS.recallApproval,
  ],
  exampleSummary: 'You allow the assistant to capture and store specific moments from your Fortnite streams on Twitch. Each moment is saved separately — no combining into general strategies. Memories are kept for 30 days, then automatically frozen. Recall requires your approval each time. Nothing is ever shared outside this system.',
};

/**
 * Template: Personal Journal
 * For session-only personal reflections
 */
const JOURNAL_TEMPLATE: ContractTemplate = {
  id: 'personal-journal',
  name: 'Personal Journal',
  description: 'Allow observation of personal reflections for the current session only, without storing any memories.',
  keywords: ['personal', 'journal', 'diary', 'reflection', 'private', 'thoughts', 'feelings'],
  defaults: {
    contractType: ContractType.OBSERVATION,
    domains: ['personal'],
    contexts: ['journaling'],
    tools: [],
    retention: RetentionDuration.SESSION,
    classificationCap: 0,
    allowGeneralization: false,
    generalizationConditions: [],
    requiresOwner: true,
    boundaryModeMin: BoundaryMode.NORMAL,
  },
  questions: [
    {
      id: 'confirm_no_storage',
      text: 'Confirm: No memories will be stored. The assistant will only help during this session.',
      answerType: 'confirm',
      defaultValue: true,
      required: true,
    },
  ],
  exampleSummary: 'You allow the assistant to observe your personal journaling session. It will help you in the moment but will NOT store any memories. Everything is forgotten when the session ends. Your private thoughts remain private.',
};

/**
 * Template: Work Projects
 * For learning patterns from professional work
 */
const WORK_TEMPLATE: ContractTemplate = {
  id: 'work-projects',
  name: 'Work Projects',
  description: 'Learn helpful patterns from your professional work while keeping sensitive data protected.',
  keywords: ['work', 'professional', 'business', 'job', 'project', 'client', 'office'],
  defaults: {
    contractType: ContractType.PROCEDURAL,
    domains: ['work'],
    contexts: [],
    tools: [],
    retention: RetentionDuration.TIMEBOUND,
    classificationCap: 4,
    allowGeneralization: true,
    generalizationConditions: [
      'No client-specific data',
      'No confidential information',
      'General patterns only',
    ],
    requiresOwner: true,
    boundaryModeMin: BoundaryMode.TRUSTED,
  },
  questions: [
    {
      id: 'project_type',
      text: 'What type of work projects?',
      answerType: 'text',
      required: false,
      helpText: 'Examples: software development, data analysis, documentation',
    },
    COMMON_QUESTIONS.retentionDuration,
    {
      id: 'sensitivity',
      text: 'Does this involve highly confidential or sensitive information?',
      answerType: 'confirm',
      defaultValue: false,
      required: true,
      helpText: 'If yes, additional protections will be applied.',
    },
  ],
  exampleSummary: 'You allow the assistant to learn general work patterns from your professional projects. No client-specific or confidential data will be stored. Patterns are kept for 90 days and require your approval to recall. Higher trust mode is required for access.',
};

/**
 * Template: Prohibited Domains
 * For explicitly forbidding learning in sensitive areas
 */
const PROHIBITED_TEMPLATE: ContractTemplate = {
  id: 'prohibited-domains',
  name: 'Prohibited Domains',
  description: 'Explicitly forbid any learning in specified sensitive domains like medical, financial, or legal.',
  keywords: ['never', 'prohibit', 'forbid', 'block', 'medical', 'financial', 'legal', 'sensitive', 'off-limits'],
  defaults: {
    contractType: ContractType.PROHIBITED,
    domains: [],
    contexts: [],
    tools: [],
    retention: RetentionDuration.SESSION,
    classificationCap: 0,
    allowGeneralization: false,
    generalizationConditions: [],
    requiresOwner: true,
    boundaryModeMin: BoundaryMode.RESTRICTED,
  },
  questions: [
    {
      id: 'prohibited_domains',
      text: 'Which domains should be completely off-limits for learning?',
      answerType: 'domains',
      required: true,
      helpText: 'Examples: medical, financial, legal. These will override all other contracts.',
    },
  ],
  exampleSummary: 'You PROHIBIT all learning in medical, financial, and legal domains. The assistant will never store any memories or learn any patterns from these areas. This overrides any other contracts. This prohibition cannot be revoked, only amended.',
};

/**
 * Template: Learning/Study Sessions
 * For episodic learning during study sessions
 */
const STUDY_TEMPLATE: ContractTemplate = {
  id: 'study-sessions',
  name: 'Study Sessions',
  description: 'Capture key learnings and insights from your study or learning sessions.',
  keywords: ['study', 'learning', 'education', 'course', 'lesson', 'tutorial', 'class'],
  defaults: {
    contractType: ContractType.EPISODIC,
    domains: ['learning'],
    contexts: [],
    tools: [],
    retention: RetentionDuration.PERMANENT,
    classificationCap: 2,
    allowGeneralization: false,
    generalizationConditions: [],
    requiresOwner: false,
    boundaryModeMin: BoundaryMode.NORMAL,
  },
  questions: [
    {
      id: 'subject',
      text: 'What subject or topic are you studying?',
      answerType: 'text',
      required: false,
      helpText: 'Examples: machine learning, web development, mathematics',
    },
    COMMON_QUESTIONS.tools,
    COMMON_QUESTIONS.recallApproval,
  ],
  exampleSummary: 'You allow the assistant to capture and store specific learnings from your study sessions on machine learning. Each insight is kept separately for easy recall. Memories are stored permanently until you revoke. You can review stored learnings at any time.',
};

/**
 * Template: Strategic Planning
 * For high-level strategic learning (requires high trust)
 */
const STRATEGIC_TEMPLATE: ContractTemplate = {
  id: 'strategic-planning',
  name: 'Strategic Planning',
  description: 'Allow deep strategic learning for long-term planning and decision-making. Requires high trust mode.',
  keywords: ['strategy', 'strategic', 'planning', 'long-term', 'decision', 'big picture', 'comprehensive'],
  defaults: {
    contractType: ContractType.STRATEGIC,
    domains: [],
    contexts: [],
    tools: [],
    retention: RetentionDuration.PERMANENT,
    classificationCap: 4,
    allowGeneralization: true,
    generalizationConditions: [
      'High-confidence patterns only',
      'Reviewed by owner',
      'Within approved domains',
    ],
    requiresOwner: true,
    boundaryModeMin: BoundaryMode.TRUSTED,
  },
  questions: [
    {
      id: 'strategy_domains',
      text: 'What areas should strategic learning apply to?',
      answerType: 'domains',
      required: true,
      helpText: 'Examples: business, career, personal development',
    },
    {
      id: 'confirm_high_trust',
      text: 'Strategic learning requires high trust mode. Do you understand and accept this?',
      answerType: 'confirm',
      defaultValue: false,
      required: true,
      helpText: 'This means the assistant will only recall strategic learnings in trusted or privileged environments.',
    },
  ],
  exampleSummary: 'You allow the assistant to build long-term strategic insights for business planning. This deep learning requires trusted mode and your approval to recall. Strategies are built from high-confidence patterns only and reviewed by you. This is a powerful contract for building genuine partnership.',
};

/**
 * All available templates
 */
export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  CODING_TEMPLATE,
  GAMING_TEMPLATE,
  JOURNAL_TEMPLATE,
  WORK_TEMPLATE,
  PROHIBITED_TEMPLATE,
  STUDY_TEMPLATE,
  STRATEGIC_TEMPLATE,
];

/**
 * Get template by ID
 */
export function getTemplateById(id: string): ContractTemplate | null {
  return CONTRACT_TEMPLATES.find(t => t.id === id) || null;
}

/**
 * Get templates by contract type
 */
export function getTemplatesByType(type: ContractType): ContractTemplate[] {
  return CONTRACT_TEMPLATES.filter(t => t.defaults.contractType === type);
}

/**
 * Search templates by keyword
 */
export function searchTemplates(query: string): ContractTemplate[] {
  const normalizedQuery = query.toLowerCase();
  return CONTRACT_TEMPLATES.filter(template => {
    // Check name and description
    if (template.name.toLowerCase().includes(normalizedQuery)) return true;
    if (template.description.toLowerCase().includes(normalizedQuery)) return true;
    // Check keywords
    return template.keywords.some(k => k.includes(normalizedQuery));
  });
}
