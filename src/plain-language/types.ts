/**
 * Plain-Language Interface Types
 *
 * Types for the conversational contract creation and management interface.
 */

import {
  ContractType,
  RetentionDuration,
  BoundaryMode,
} from '../types';

/**
 * Intent extracted from natural language
 */
export interface ParsedIntent {
  /** Detected contract type */
  contractType: ContractType | null;
  /** Detected domains */
  domains: string[];
  /** Detected contexts */
  contexts: string[];
  /** Detected tools */
  tools: string[];
  /** Retention preference */
  retention: RetentionDuration | null;
  /** Retention duration in days (for timebound) */
  retentionDays: number | null;
  /** Whether generalization is desired */
  allowGeneralization: boolean | null;
  /** Classification level cap */
  classificationCap: number | null;
  /** Whether to require approval for recall */
  requireRecallApproval: boolean | null;
  /** Raw input text */
  rawInput: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Ambiguities that need clarification */
  ambiguities: string[];
}

/**
 * Question for conversational flow
 */
export interface ConversationQuestion {
  /** Unique question ID */
  id: string;
  /** The question text */
  text: string;
  /** Type of expected answer */
  answerType: 'text' | 'choice' | 'confirm' | 'duration' | 'domains';
  /** Available choices (for choice type) */
  choices?: Array<{ value: string; label: string; description?: string }>;
  /** Default value */
  defaultValue?: string | string[] | boolean | number;
  /** Whether this question is required */
  required: boolean;
  /** Help text for the user */
  helpText?: string;
}

/**
 * Answer to a conversation question
 */
export interface ConversationAnswer {
  /** Question ID this answers */
  questionId: string;
  /** The answer value */
  value: string | string[] | boolean | number;
  /** Raw text input (if applicable) */
  rawText?: string;
}

/**
 * State of a contract building conversation
 */
export interface ConversationState {
  /** Unique conversation ID */
  conversationId: string;
  /** User ID */
  userId: string;
  /** Current step in the conversation */
  currentStep: ConversationStep;
  /** Accumulated answers */
  answers: ConversationAnswer[];
  /** Parsed intent so far */
  parsedIntent: Partial<ParsedIntent>;
  /** Questions that have been asked */
  askedQuestions: string[];
  /** Whether the conversation is complete */
  isComplete: boolean;
  /** The built contract draft (when complete) */
  contractDraft?: ContractDraftFromLanguage;
  /** Timestamp when conversation started */
  startedAt: Date;
  /** Last activity timestamp */
  lastActivityAt: Date;
}

/**
 * Steps in the conversation flow
 */
export enum ConversationStep {
  /** Initial - gathering basic intent */
  INITIAL = 'initial',
  /** Determining contract type */
  CONTRACT_TYPE = 'contract_type',
  /** Gathering domain information */
  DOMAINS = 'domains',
  /** Gathering context information */
  CONTEXTS = 'contexts',
  /** Gathering tool restrictions */
  TOOLS = 'tools',
  /** Setting retention duration */
  RETENTION = 'retention',
  /** Setting generalization rules */
  GENERALIZATION = 'generalization',
  /** Setting recall requirements */
  RECALL = 'recall',
  /** Review and confirmation */
  REVIEW = 'review',
  /** Conversation complete */
  COMPLETE = 'complete',
}

/**
 * Contract draft built from plain language
 */
export interface ContractDraftFromLanguage {
  /** User who created the contract */
  createdBy: string;
  /** Contract type */
  contractType: ContractType;
  /** Domains */
  domains: string[];
  /** Contexts */
  contexts: string[];
  /** Tools */
  tools: string[];
  /** Retention duration type */
  retention: RetentionDuration;
  /** Retention end date (for timebound) */
  retentionUntil?: Date;
  /** Classification cap */
  classificationCap: number;
  /** Whether generalization is allowed */
  allowGeneralization: boolean;
  /** Generalization conditions */
  generalizationConditions: string[];
  /** Whether recall requires owner presence */
  requiresOwner: boolean;
  /** Minimum boundary mode for recall */
  boundaryModeMin: BoundaryMode;
  /** Plain-language description of the contract */
  plainLanguageSummary: string;
}

/**
 * Template for common contract patterns
 */
export interface ContractTemplate {
  /** Template ID */
  id: string;
  /** Template name */
  name: string;
  /** Description of what this template is for */
  description: string;
  /** Keywords that trigger this template */
  keywords: string[];
  /** Default values for this template */
  defaults: Partial<ContractDraftFromLanguage>;
  /** Questions to ask for this template */
  questions: ConversationQuestion[];
  /** Example plain-language summary */
  exampleSummary: string;
}

/**
 * Result of parsing natural language
 */
export interface ParseResult {
  /** Whether parsing was successful */
  success: boolean;
  /** Parsed intent */
  intent: ParsedIntent | null;
  /** Suggested template if one matches */
  suggestedTemplate: ContractTemplate | null;
  /** Questions to clarify ambiguities */
  clarificationQuestions: ConversationQuestion[];
  /** Error message if parsing failed */
  error?: string;
}

/**
 * Options for plain-language summary generation
 */
export interface SummaryOptions {
  /** Include technical details */
  includeTechnical?: boolean;
  /** Use bullet points vs prose */
  format?: 'prose' | 'bullets';
  /** Include warnings about restrictions */
  includeWarnings?: boolean;
}
