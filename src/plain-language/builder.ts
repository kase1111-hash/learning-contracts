/**
 * Conversational Contract Builder
 *
 * Manages the interactive conversation flow for building contracts
 * from plain language descriptions.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ContractType,
  RetentionDuration,
  BoundaryMode,
} from '../types';
import {
  ConversationState,
  ConversationStep,
  ConversationQuestion,
  ConversationAnswer,
  ContractDraftFromLanguage,
  ContractTemplate,
} from './types';
import { PlainLanguageParser } from './parser';
import { PlainLanguageSummarizer } from './summarizer';
import { CONTRACT_TEMPLATES, getTemplateById } from './templates';

/**
 * Response from the builder after processing input
 */
export interface BuilderResponse {
  /** Message to show the user */
  message: string;
  /** Questions to ask (if any) */
  questions: ConversationQuestion[];
  /** Whether the conversation is complete */
  isComplete: boolean;
  /** The draft contract (when complete) */
  draft?: ContractDraftFromLanguage;
  /** Plain-language summary of the draft */
  summary?: string;
  /** Current step in the flow */
  currentStep: ConversationStep;
  /** Suggested templates (if any) */
  suggestedTemplates?: ContractTemplate[];
}

/**
 * Conversational Contract Builder
 */
export class ConversationalContractBuilder {
  private parser: PlainLanguageParser;
  private summarizer: PlainLanguageSummarizer;
  private conversations: Map<string, ConversationState>;

  constructor() {
    this.parser = new PlainLanguageParser();
    this.summarizer = new PlainLanguageSummarizer();
    this.conversations = new Map();
  }

  /**
   * Start a new conversation
   */
  startConversation(userId: string): BuilderResponse {
    const conversationId = uuidv4();
    const state: ConversationState = {
      conversationId,
      userId,
      currentStep: ConversationStep.INITIAL,
      answers: [],
      parsedIntent: {},
      askedQuestions: [],
      isComplete: false,
      startedAt: new Date(),
      lastActivityAt: new Date(),
    };

    this.conversations.set(conversationId, state);

    return {
      message: "Let's create a Learning Contract. What would you like the assistant to learn about? You can describe it in your own words, or I can show you some templates.",
      questions: [
        {
          id: 'initial_intent',
          text: 'What should the assistant learn?',
          answerType: 'text',
          required: true,
          helpText: 'Examples: "Learn coding tips from my Python sessions" or "Never learn anything about my finances"',
        },
      ],
      isComplete: false,
      currentStep: ConversationStep.INITIAL,
      suggestedTemplates: CONTRACT_TEMPLATES.slice(0, 3), // Show first 3 templates as suggestions
    };
  }

  /**
   * Process user input in the conversation
   */
  processInput(
    conversationId: string,
    input: string | ConversationAnswer
  ): BuilderResponse {
    const state = this.conversations.get(conversationId);
    if (!state) {
      return this.createErrorResponse('Conversation not found. Please start a new conversation.');
    }

    state.lastActivityAt = new Date();

    // Handle based on current step
    switch (state.currentStep) {
      case ConversationStep.INITIAL:
        return this.handleInitialInput(state, input);
      case ConversationStep.CONTRACT_TYPE:
        return this.handleContractTypeInput(state, input);
      case ConversationStep.DOMAINS:
        return this.handleDomainsInput(state, input);
      case ConversationStep.CONTEXTS:
        return this.handleContextsInput(state, input);
      case ConversationStep.TOOLS:
        return this.handleToolsInput(state, input);
      case ConversationStep.RETENTION:
        return this.handleRetentionInput(state, input);
      case ConversationStep.GENERALIZATION:
        return this.handleGeneralizationInput(state, input);
      case ConversationStep.RECALL:
        return this.handleRecallInput(state, input);
      case ConversationStep.REVIEW:
        return this.handleReviewInput(state, input);
      default:
        return this.createErrorResponse('Invalid conversation state.');
    }
  }

  /**
   * Use a template to populate the conversation
   */
  useTemplate(conversationId: string, templateId: string): BuilderResponse {
    const state = this.conversations.get(conversationId);
    if (!state) {
      return this.createErrorResponse('Conversation not found. Please start a new conversation.');
    }

    const template = getTemplateById(templateId);
    if (!template) {
      return this.createErrorResponse(`Template "${templateId}" not found.`);
    }

    // Apply template defaults to parsed intent
    state.parsedIntent = {
      contractType: template.defaults.contractType,
      domains: template.defaults.domains || [],
      contexts: template.defaults.contexts || [],
      tools: template.defaults.tools || [],
      retention: template.defaults.retention,
      allowGeneralization: template.defaults.allowGeneralization,
      classificationCap: template.defaults.classificationCap,
      requireRecallApproval: template.defaults.requiresOwner,
      ambiguities: [],
      confidence: 0.9,
      rawInput: `[Using template: ${template.name}]`,
    };

    state.lastActivityAt = new Date();

    // If template has questions, ask them
    if (template.questions.length > 0) {
      state.currentStep = ConversationStep.DOMAINS; // Start asking template questions

      return {
        message: `Great! Using the "${template.name}" template. Let me ask a few questions to customize it.`,
        questions: template.questions,
        isComplete: false,
        currentStep: state.currentStep,
      };
    }

    // No questions - go straight to review
    return this.goToReview(state);
  }

  /**
   * Handle initial intent input
   */
  private handleInitialInput(
    state: ConversationState,
    input: string | ConversationAnswer
  ): BuilderResponse {
    const textInput = typeof input === 'string' ? input : String(input.value);

    // Parse the natural language input
    const parseResult = this.parser.parse(textInput);

    if (!parseResult.success || !parseResult.intent) {
      return {
        message: parseResult.error || "I couldn't understand that. Could you describe what you'd like the assistant to learn in different words?",
        questions: [
          {
            id: 'initial_intent',
            text: 'What should the assistant learn?',
            answerType: 'text',
            required: true,
          },
        ],
        isComplete: false,
        currentStep: ConversationStep.INITIAL,
      };
    }

    // Store parsed intent
    state.parsedIntent = parseResult.intent;
    state.answers.push({
      questionId: 'initial_intent',
      value: textInput,
      rawText: textInput,
    });

    // If we found a matching template, suggest it
    if (parseResult.suggestedTemplate) {
      return {
        message: `I found a template that might fit: "${parseResult.suggestedTemplate.name}". Would you like to use it, or continue with a custom contract?`,
        questions: [
          {
            id: 'use_template',
            text: 'Use this template?',
            answerType: 'choice',
            choices: [
              { value: 'yes', label: `Yes, use "${parseResult.suggestedTemplate.name}"` },
              { value: 'no', label: 'No, create a custom contract' },
            ],
            required: true,
          },
        ],
        isComplete: false,
        currentStep: state.currentStep,
        suggestedTemplates: [parseResult.suggestedTemplate],
      };
    }

    // Move to the next step based on what's missing
    return this.advanceConversation(state, parseResult.clarificationQuestions);
  }

  /**
   * Handle contract type input
   */
  private handleContractTypeInput(
    state: ConversationState,
    input: string | ConversationAnswer
  ): BuilderResponse {
    const value = typeof input === 'string' ? input : input.value;

    if (Object.values(ContractType).includes(value as ContractType)) {
      state.parsedIntent.contractType = value as ContractType;
      state.answers.push({ questionId: 'contract_type', value });
    }

    return this.advanceConversation(state, []);
  }

  /**
   * Handle domains input
   */
  private handleDomainsInput(
    state: ConversationState,
    input: string | ConversationAnswer
  ): BuilderResponse {
    const value = typeof input === 'string' ? input : input.value;

    if (typeof value === 'string') {
      state.parsedIntent.domains = value.split(',').map(d => d.trim()).filter(d => d);
    } else if (Array.isArray(value)) {
      state.parsedIntent.domains = value;
    }

    state.answers.push({ questionId: 'domains', value });

    return this.advanceConversation(state, []);
  }

  /**
   * Handle contexts input
   */
  private handleContextsInput(
    state: ConversationState,
    input: string | ConversationAnswer
  ): BuilderResponse {
    const value = typeof input === 'string' ? input : input.value;

    if (typeof value === 'string') {
      state.parsedIntent.contexts = value.split(',').map(c => c.trim()).filter(c => c);
    } else if (Array.isArray(value)) {
      state.parsedIntent.contexts = value;
    }

    state.answers.push({ questionId: 'contexts', value });

    return this.advanceConversation(state, []);
  }

  /**
   * Handle tools input
   */
  private handleToolsInput(
    state: ConversationState,
    input: string | ConversationAnswer
  ): BuilderResponse {
    const value = typeof input === 'string' ? input : input.value;

    if (typeof value === 'string') {
      state.parsedIntent.tools = value.split(',').map(t => t.trim()).filter(t => t);
    } else if (Array.isArray(value)) {
      state.parsedIntent.tools = value;
    }

    state.answers.push({ questionId: 'tools', value });

    return this.advanceConversation(state, []);
  }

  /**
   * Handle retention input
   */
  private handleRetentionInput(
    state: ConversationState,
    input: string | ConversationAnswer
  ): BuilderResponse {
    const value = typeof input === 'string' ? input : input.value;

    if (Object.values(RetentionDuration).includes(value as RetentionDuration)) {
      state.parsedIntent.retention = value as RetentionDuration;
    }

    state.answers.push({ questionId: 'retention', value });

    // If timebound, ask for duration
    if (value === RetentionDuration.TIMEBOUND && !state.parsedIntent.retentionDays) {
      return {
        message: 'How many days should memories be kept?',
        questions: [
          {
            id: 'retention_days',
            text: 'Number of days',
            answerType: 'duration',
            defaultValue: 30,
            required: true,
          },
        ],
        isComplete: false,
        currentStep: state.currentStep,
      };
    }

    return this.advanceConversation(state, []);
  }

  /**
   * Handle generalization input
   */
  private handleGeneralizationInput(
    state: ConversationState,
    input: string | ConversationAnswer
  ): BuilderResponse {
    const value = typeof input === 'string'
      ? input.toLowerCase() === 'yes' || input.toLowerCase() === 'true'
      : Boolean(input.value);

    state.parsedIntent.allowGeneralization = value;
    state.answers.push({ questionId: 'generalization', value });

    return this.advanceConversation(state, []);
  }

  /**
   * Handle recall input
   */
  private handleRecallInput(
    state: ConversationState,
    input: string | ConversationAnswer
  ): BuilderResponse {
    const value = typeof input === 'string'
      ? input.toLowerCase() === 'yes' || input.toLowerCase() === 'true'
      : Boolean(input.value);

    state.parsedIntent.requireRecallApproval = value;
    state.answers.push({ questionId: 'recall', value });

    return this.advanceConversation(state, []);
  }

  /**
   * Handle review confirmation
   */
  private handleReviewInput(
    state: ConversationState,
    input: string | ConversationAnswer
  ): BuilderResponse {
    const value = typeof input === 'string' ? input.toLowerCase() : String(input.value).toLowerCase();

    if (value === 'yes' || value === 'confirm' || value === 'true') {
      // Build the final draft
      const draft = this.buildContractDraft(state);
      state.contractDraft = draft;
      state.isComplete = true;
      state.currentStep = ConversationStep.COMPLETE;

      const summary = this.summarizer.summarizeDraft(draft);

      return {
        message: 'Contract draft created and ready for activation!',
        questions: [],
        isComplete: true,
        currentStep: ConversationStep.COMPLETE,
        draft,
        summary,
      };
    }

    if (value === 'no' || value === 'change' || value === 'edit') {
      // Go back to collect more info
      state.currentStep = ConversationStep.DOMAINS;
      return {
        message: 'No problem. What would you like to change?',
        questions: [
          {
            id: 'change_what',
            text: 'What would you like to change?',
            answerType: 'choice',
            choices: [
              { value: 'type', label: 'Contract type' },
              { value: 'domains', label: 'Domains/areas' },
              { value: 'retention', label: 'How long memories are kept' },
              { value: 'generalization', label: 'Whether patterns can be applied' },
              { value: 'recall', label: 'Whether to ask before recalling' },
              { value: 'start_over', label: 'Start over completely' },
            ],
            required: true,
          },
        ],
        isComplete: false,
        currentStep: state.currentStep,
      };
    }

    return {
      message: 'Please confirm "yes" to create the contract, or "no" to make changes.',
      questions: [
        {
          id: 'confirm',
          text: 'Create this contract?',
          answerType: 'confirm',
          required: true,
        },
      ],
      isComplete: false,
      currentStep: ConversationStep.REVIEW,
    };
  }

  /**
   * Advance the conversation to the next needed step
   */
  private advanceConversation(
    state: ConversationState,
    additionalQuestions: ConversationQuestion[]
  ): BuilderResponse {
    const intent = state.parsedIntent;

    // Determine what information is still missing
    const missingQuestions: ConversationQuestion[] = [];

    // Contract type
    if (!intent.contractType) {
      state.currentStep = ConversationStep.CONTRACT_TYPE;
      missingQuestions.push({
        id: 'contract_type',
        text: 'What type of learning would you like to allow?',
        answerType: 'choice',
        choices: [
          { value: ContractType.OBSERVATION, label: 'Observation Only', description: "Watch but don't store" },
          { value: ContractType.EPISODIC, label: 'Specific Episodes', description: 'Store specific moments' },
          { value: ContractType.PROCEDURAL, label: 'Learn Patterns', description: 'Learn reusable tips' },
          { value: ContractType.STRATEGIC, label: 'Strategic Learning', description: 'Build long-term strategies' },
          { value: ContractType.PROHIBITED, label: 'Prohibit Learning', description: 'Never learn in this area' },
        ],
        required: true,
      });
    }
    // Domains
    else if (!intent.domains || intent.domains.length === 0) {
      state.currentStep = ConversationStep.DOMAINS;
      missingQuestions.push({
        id: 'domains',
        text: 'What subject areas should this apply to?',
        answerType: 'domains',
        required: true,
        helpText: 'Examples: coding, personal, work, gaming, finance',
      });
    }
    // Retention
    else if (!intent.retention && intent.contractType !== ContractType.OBSERVATION) {
      state.currentStep = ConversationStep.RETENTION;
      missingQuestions.push({
        id: 'retention',
        text: 'How long should memories be kept?',
        answerType: 'choice',
        choices: [
          { value: RetentionDuration.SESSION, label: 'This session only' },
          { value: RetentionDuration.TIMEBOUND, label: 'For a limited time' },
          { value: RetentionDuration.PERMANENT, label: 'Permanently' },
        ],
        required: true,
      });
    }
    // Generalization
    else if (
      intent.allowGeneralization === null &&
      intent.contractType !== ContractType.OBSERVATION &&
      intent.contractType !== ContractType.PROHIBITED &&
      intent.contractType !== ContractType.EPISODIC
    ) {
      state.currentStep = ConversationStep.GENERALIZATION;
      missingQuestions.push({
        id: 'generalization',
        text: 'Should learned patterns be applied automatically to similar situations?',
        answerType: 'confirm',
        defaultValue: true,
        required: true,
        helpText: 'If yes, tips can be applied without asking. If no, each memory stays separate.',
      });
    }
    // All required info collected - go to review
    else {
      return this.goToReview(state);
    }

    // Combine with any additional clarification questions
    const allQuestions = [...missingQuestions, ...additionalQuestions];

    return {
      message: this.getStepMessage(state.currentStep),
      questions: allQuestions,
      isComplete: false,
      currentStep: state.currentStep,
    };
  }

  /**
   * Go to review step
   */
  private goToReview(state: ConversationState): BuilderResponse {
    state.currentStep = ConversationStep.REVIEW;

    // Build a preview draft
    const draft = this.buildContractDraft(state);
    const summary = this.summarizer.summarizeDraft(draft);

    return {
      message: `Here's what I understand:\n\n${summary}\n\nDoes this look right?`,
      questions: [
        {
          id: 'confirm',
          text: 'Create this contract?',
          answerType: 'confirm',
          required: true,
        },
      ],
      isComplete: false,
      currentStep: ConversationStep.REVIEW,
      draft,
      summary,
    };
  }

  /**
   * Build contract draft from conversation state
   */
  private buildContractDraft(state: ConversationState): ContractDraftFromLanguage {
    const intent = state.parsedIntent;

    // Apply defaults based on contract type
    const contractType = intent.contractType || ContractType.EPISODIC;
    const defaults = this.getTypeDefaults(contractType);

    // Calculate retention until date
    let retentionUntil: Date | undefined;
    if (intent.retention === RetentionDuration.TIMEBOUND && intent.retentionDays) {
      retentionUntil = new Date();
      retentionUntil.setDate(retentionUntil.getDate() + intent.retentionDays);
    }

    // Build generalization conditions
    const generalizationConditions: string[] = [];
    if (intent.allowGeneralization) {
      if (intent.domains && intent.domains.length > 0) {
        generalizationConditions.push(`Within ${intent.domains.join(', ')} domains only`);
      }
      if (intent.contexts && intent.contexts.length > 0) {
        generalizationConditions.push(`Within ${intent.contexts.join(', ')} contexts`);
      }
      generalizationConditions.push('No personal or sensitive data patterns');
    }

    const draft: ContractDraftFromLanguage = {
      createdBy: state.userId,
      contractType,
      domains: intent.domains || [],
      contexts: intent.contexts || [],
      tools: intent.tools || [],
      retention: intent.retention || defaults.retention,
      retentionUntil,
      classificationCap: intent.classificationCap || defaults.classificationCap,
      allowGeneralization: intent.allowGeneralization ?? defaults.allowGeneralization,
      generalizationConditions,
      requiresOwner: intent.requireRecallApproval ?? defaults.requiresOwner,
      boundaryModeMin: defaults.boundaryModeMin,
      plainLanguageSummary: '', // Will be filled by summarizer
    };

    // Generate summary
    draft.plainLanguageSummary = this.summarizer.summarizeDraft(draft);

    return draft;
  }

  /**
   * Get default values based on contract type
   */
  private getTypeDefaults(type: ContractType): {
    retention: RetentionDuration;
    classificationCap: number;
    allowGeneralization: boolean;
    requiresOwner: boolean;
    boundaryModeMin: BoundaryMode;
  } {
    switch (type) {
      case ContractType.OBSERVATION:
        return {
          retention: RetentionDuration.SESSION,
          classificationCap: 0,
          allowGeneralization: false,
          requiresOwner: true,
          boundaryModeMin: BoundaryMode.NORMAL,
        };
      case ContractType.EPISODIC:
        return {
          retention: RetentionDuration.TIMEBOUND,
          classificationCap: 3,
          allowGeneralization: false,
          requiresOwner: false,
          boundaryModeMin: BoundaryMode.NORMAL,
        };
      case ContractType.PROCEDURAL:
        return {
          retention: RetentionDuration.PERMANENT,
          classificationCap: 3,
          allowGeneralization: true,
          requiresOwner: false,
          boundaryModeMin: BoundaryMode.NORMAL,
        };
      case ContractType.STRATEGIC:
        return {
          retention: RetentionDuration.PERMANENT,
          classificationCap: 4,
          allowGeneralization: true,
          requiresOwner: true,
          boundaryModeMin: BoundaryMode.TRUSTED,
        };
      case ContractType.PROHIBITED:
        return {
          retention: RetentionDuration.SESSION,
          classificationCap: 0,
          allowGeneralization: false,
          requiresOwner: true,
          boundaryModeMin: BoundaryMode.RESTRICTED,
        };
      default:
        return {
          retention: RetentionDuration.SESSION,
          classificationCap: 2,
          allowGeneralization: false,
          requiresOwner: true,
          boundaryModeMin: BoundaryMode.NORMAL,
        };
    }
  }

  /**
   * Get message for current step
   */
  private getStepMessage(step: ConversationStep): string {
    const messages: Record<ConversationStep, string> = {
      [ConversationStep.INITIAL]: "What would you like the assistant to learn about?",
      [ConversationStep.CONTRACT_TYPE]: "What type of learning should be allowed?",
      [ConversationStep.DOMAINS]: "What subject areas does this apply to?",
      [ConversationStep.CONTEXTS]: "Are there specific contexts or projects?",
      [ConversationStep.TOOLS]: "Which tools or environments?",
      [ConversationStep.RETENTION]: "How long should memories be kept?",
      [ConversationStep.GENERALIZATION]: "Should learned patterns be applied automatically?",
      [ConversationStep.RECALL]: "Should the assistant ask before recalling memories?",
      [ConversationStep.REVIEW]: "Here's the contract summary. Does this look right?",
      [ConversationStep.COMPLETE]: "Contract created successfully!",
    };

    return messages[step] || "What would you like to do?";
  }

  /**
   * Create an error response
   */
  private createErrorResponse(message: string): BuilderResponse {
    return {
      message,
      questions: [],
      isComplete: false,
      currentStep: ConversationStep.INITIAL,
    };
  }

  /**
   * Get conversation state
   */
  getConversation(conversationId: string): ConversationState | null {
    return this.conversations.get(conversationId) || null;
  }

  /**
   * Cancel a conversation
   */
  cancelConversation(conversationId: string): boolean {
    return this.conversations.delete(conversationId);
  }

  /**
   * Clean up old conversations
   */
  cleanupOldConversations(maxAgeMs: number = 30 * 60 * 1000): number {
    const now = new Date();
    let cleaned = 0;

    for (const [id, state] of this.conversations) {
      const age = now.getTime() - state.lastActivityAt.getTime();
      if (age > maxAgeMs) {
        this.conversations.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }
}
