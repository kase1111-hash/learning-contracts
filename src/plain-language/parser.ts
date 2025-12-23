/**
 * Plain-Language Parser
 *
 * Parses natural language descriptions into contract parameters.
 * Uses pattern matching and keyword extraction to understand user intent.
 */

import { ContractType, RetentionDuration } from '../types';
import {
  ParsedIntent,
  ParseResult,
  ContractTemplate,
  ConversationQuestion,
} from './types';
import { CONTRACT_TEMPLATES } from './templates';

/**
 * Domain keyword mappings
 */
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  coding: ['code', 'coding', 'programming', 'development', 'software', 'developer'],
  python: ['python', 'py'],
  javascript: ['javascript', 'js', 'typescript', 'ts', 'node'],
  gaming: ['game', 'gaming', 'gameplay', 'stream', 'streaming', 'play'],
  personal: ['personal', 'private', 'diary', 'journal', 'journaling'],
  work: ['work', 'job', 'professional', 'business', 'office'],
  finance: ['finance', 'financial', 'money', 'banking', 'investment'],
  medical: ['medical', 'health', 'healthcare', 'doctor', 'hospital'],
  legal: ['legal', 'law', 'lawyer', 'attorney', 'court'],
  creative: ['creative', 'art', 'design', 'writing', 'music'],
  learning: ['learning', 'study', 'studying', 'education', 'course'],
};

/**
 * Contract type indicators
 */
const CONTRACT_TYPE_INDICATORS: Record<ContractType, string[]> = {
  [ContractType.OBSERVATION]: [
    'observe', 'watch', 'monitor', 'track', 'no storage', 'don\'t store',
    'do not store', 'just observe', 'only observe', 'without storing',
  ],
  [ContractType.EPISODIC]: [
    'specific', 'episode', 'moment', 'event', 'individual', 'particular',
    'this session', 'single', 'one-time', 'capture', 'save moment',
  ],
  [ContractType.PROCEDURAL]: [
    'pattern', 'heuristic', 'tip', 'best practice', 'technique', 'method',
    'reusable', 'apply', 'learn from', 'remember how', 'procedure',
  ],
  [ContractType.STRATEGIC]: [
    'strategy', 'strategic', 'long-term', 'longterm', 'high-level',
    'big picture', 'overall', 'comprehensive',
  ],
  [ContractType.PROHIBITED]: [
    'never', 'prohibit', 'forbidden', 'forbid', 'don\'t learn', 'do not learn',
    'block', 'prevent', 'exclude', 'off-limits', 'no learning',
  ],
};

/**
 * Retention duration indicators
 */
const RETENTION_INDICATORS: Record<RetentionDuration, string[]> = {
  [RetentionDuration.SESSION]: [
    'session', 'this session', 'session only', 'temporary', 'temp',
    'just now', 'for now', 'current session',
  ],
  [RetentionDuration.TIMEBOUND]: [
    'days', 'weeks', 'months', 'until', 'expire', 'expiry', 'time limit',
    'for a while', 'limited time',
  ],
  [RetentionDuration.PERMANENT]: [
    'permanent', 'forever', 'always', 'indefinitely', 'until revoked',
    'keep forever', 'never expire', 'long term',
  ],
};

/**
 * Tool/context keyword mappings
 */
const TOOL_KEYWORDS: Record<string, string[]> = {
  'vs-code': ['vscode', 'vs code', 'visual studio code'],
  'editor': ['editor', 'ide', 'text editor'],
  'terminal': ['terminal', 'command line', 'cli', 'shell', 'bash'],
  'browser': ['browser', 'chrome', 'firefox', 'web browser'],
  'git': ['git', 'github', 'gitlab', 'version control'],
  'debugger': ['debug', 'debugger', 'debugging'],
  'obs': ['obs', 'obs studio', 'streaming software'],
  'twitch': ['twitch', 'twitch.tv'],
  'discord': ['discord'],
};

/**
 * Context keyword mappings
 */
const CONTEXT_KEYWORDS: Record<string, string[]> = {
  'personal-projects': ['personal project', 'side project', 'hobby project', 'my project'],
  'work-projects': ['work project', 'job project', 'professional project', 'client project'],
  'streaming': ['stream', 'streaming', 'live stream', 'broadcast'],
  'debugging': ['debug', 'debugging', 'bug fix', 'troubleshoot'],
  'code-review': ['code review', 'reviewing code', 'pr review'],
};

/**
 * Plain-Language Parser
 */
export class PlainLanguageParser {
  /**
   * Parse natural language input into contract intent
   */
  parse(input: string): ParseResult {
    const normalizedInput = input.toLowerCase().trim();

    if (!normalizedInput || normalizedInput.length < 5) {
      return {
        success: false,
        intent: null,
        suggestedTemplate: null,
        clarificationQuestions: [],
        error: 'Input is too short. Please describe what you want to learn.',
      };
    }

    const intent = this.extractIntent(normalizedInput, input);
    const suggestedTemplate = this.findMatchingTemplate(normalizedInput);
    const clarificationQuestions = this.generateClarificationQuestions(intent);

    return {
      success: true,
      intent,
      suggestedTemplate,
      clarificationQuestions,
    };
  }

  /**
   * Extract intent from normalized input
   */
  private extractIntent(normalizedInput: string, rawInput: string): ParsedIntent {
    const contractType = this.detectContractType(normalizedInput);
    const domains = this.extractDomains(normalizedInput);
    const contexts = this.extractContexts(normalizedInput);
    const tools = this.extractTools(normalizedInput);
    const retention = this.detectRetention(normalizedInput);
    const retentionDays = this.extractRetentionDays(normalizedInput);
    const allowGeneralization = this.detectGeneralization(normalizedInput, contractType);
    const classificationCap = this.detectClassificationCap(normalizedInput);
    const requireRecallApproval = this.detectRecallApproval(normalizedInput);
    const ambiguities = this.detectAmbiguities(
      contractType, domains, retention, allowGeneralization
    );

    // Calculate confidence based on how much we could extract
    const confidence = this.calculateConfidence(
      contractType, domains, retention, ambiguities.length
    );

    return {
      contractType,
      domains,
      contexts,
      tools,
      retention,
      retentionDays,
      allowGeneralization,
      classificationCap,
      requireRecallApproval,
      rawInput,
      confidence,
      ambiguities,
    };
  }

  /**
   * Detect contract type from input
   */
  private detectContractType(input: string): ContractType | null {
    const scores: Record<ContractType, number> = {
      [ContractType.OBSERVATION]: 0,
      [ContractType.EPISODIC]: 0,
      [ContractType.PROCEDURAL]: 0,
      [ContractType.STRATEGIC]: 0,
      [ContractType.PROHIBITED]: 0,
    };

    for (const [type, keywords] of Object.entries(CONTRACT_TYPE_INDICATORS)) {
      for (const keyword of keywords) {
        if (input.includes(keyword)) {
          scores[type as ContractType] += 1;
        }
      }
    }

    const maxScore = Math.max(...Object.values(scores));
    if (maxScore === 0) {
      return null;
    }

    const topType = Object.entries(scores)
      .find(([_, score]) => score === maxScore)?.[0] as ContractType;

    return topType || null;
  }

  /**
   * Extract domains from input
   */
  private extractDomains(input: string): string[] {
    const domains: string[] = [];

    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      for (const keyword of keywords) {
        if (input.includes(keyword)) {
          if (!domains.includes(domain)) {
            domains.push(domain);
          }
          break;
        }
      }
    }

    return domains;
  }

  /**
   * Extract contexts from input
   */
  private extractContexts(input: string): string[] {
    const contexts: string[] = [];

    for (const [context, keywords] of Object.entries(CONTEXT_KEYWORDS)) {
      for (const keyword of keywords) {
        if (input.includes(keyword)) {
          if (!contexts.includes(context)) {
            contexts.push(context);
          }
          break;
        }
      }
    }

    return contexts;
  }

  /**
   * Extract tools from input
   */
  private extractTools(input: string): string[] {
    const tools: string[] = [];

    for (const [tool, keywords] of Object.entries(TOOL_KEYWORDS)) {
      for (const keyword of keywords) {
        if (input.includes(keyword)) {
          if (!tools.includes(tool)) {
            tools.push(tool);
          }
          break;
        }
      }
    }

    return tools;
  }

  /**
   * Detect retention preference
   */
  private detectRetention(input: string): RetentionDuration | null {
    for (const [retention, keywords] of Object.entries(RETENTION_INDICATORS)) {
      for (const keyword of keywords) {
        if (input.includes(keyword)) {
          return retention as RetentionDuration;
        }
      }
    }

    return null;
  }

  /**
   * Extract retention days from input
   */
  private extractRetentionDays(input: string): number | null {
    // Match patterns like "30 days", "2 weeks", "3 months"
    const dayMatch = input.match(/(\d+)\s*days?/);
    if (dayMatch) {
      return parseInt(dayMatch[1], 10);
    }

    const weekMatch = input.match(/(\d+)\s*weeks?/);
    if (weekMatch) {
      return parseInt(weekMatch[1], 10) * 7;
    }

    const monthMatch = input.match(/(\d+)\s*months?/);
    if (monthMatch) {
      return parseInt(monthMatch[1], 10) * 30;
    }

    return null;
  }

  /**
   * Detect generalization preference
   */
  private detectGeneralization(input: string, contractType: ContractType | null): boolean | null {
    // Prohibited and observation contracts never allow generalization
    if (contractType === ContractType.PROHIBITED || contractType === ContractType.OBSERVATION) {
      return false;
    }

    // Episodic contracts don't allow generalization by default
    if (contractType === ContractType.EPISODIC) {
      return false;
    }

    // Check for explicit indicators
    const noGeneralization = [
      'no generalization', 'don\'t generalize', 'do not generalize',
      'keep separate', 'individual', 'specific only',
    ];

    for (const phrase of noGeneralization) {
      if (input.includes(phrase)) {
        return false;
      }
    }

    const yesGeneralization = [
      'generalize', 'apply', 'reuse', 'learn pattern', 'learn tip',
      'best practice', 'technique',
    ];

    for (const phrase of yesGeneralization) {
      if (input.includes(phrase)) {
        return true;
      }
    }

    // Procedural and strategic default to allowing generalization
    if (contractType === ContractType.PROCEDURAL || contractType === ContractType.STRATEGIC) {
      return true;
    }

    return null;
  }

  /**
   * Detect classification cap preference
   */
  private detectClassificationCap(input: string): number | null {
    const sensitiveIndicators = ['sensitive', 'confidential', 'private', 'secret'];
    const publicIndicators = ['public', 'open', 'shared'];

    for (const indicator of sensitiveIndicators) {
      if (input.includes(indicator)) {
        return 4; // Higher classification for sensitive content
      }
    }

    for (const indicator of publicIndicators) {
      if (input.includes(indicator)) {
        return 2; // Lower classification for public content
      }
    }

    return null;
  }

  /**
   * Detect recall approval preference
   */
  private detectRecallApproval(input: string): boolean | null {
    const requireApproval = [
      'ask me', 'ask first', 'approval', 'approve', 'confirm',
      'permission', 'my permission',
    ];

    for (const phrase of requireApproval) {
      if (input.includes(phrase)) {
        return true;
      }
    }

    const autoApply = [
      'automatically', 'auto', 'without asking', 'quietly',
      'silently', 'in the background',
    ];

    for (const phrase of autoApply) {
      if (input.includes(phrase)) {
        return false;
      }
    }

    return null;
  }

  /**
   * Detect ambiguities that need clarification
   */
  private detectAmbiguities(
    contractType: ContractType | null,
    domains: string[],
    retention: RetentionDuration | null,
    allowGeneralization: boolean | null
  ): string[] {
    const ambiguities: string[] = [];

    if (!contractType) {
      ambiguities.push('contract_type');
    }

    if (domains.length === 0) {
      ambiguities.push('domains');
    }

    if (!retention) {
      ambiguities.push('retention');
    }

    if (allowGeneralization === null && contractType !== ContractType.PROHIBITED) {
      ambiguities.push('generalization');
    }

    return ambiguities;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    contractType: ContractType | null,
    domains: string[],
    retention: RetentionDuration | null,
    ambiguityCount: number
  ): number {
    let score = 0.5; // Base score

    if (contractType) score += 0.2;
    if (domains.length > 0) score += 0.15;
    if (retention) score += 0.1;

    // Reduce for ambiguities
    score -= ambiguityCount * 0.1;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Find a matching template based on input
   */
  private findMatchingTemplate(input: string): ContractTemplate | null {
    let bestMatch: ContractTemplate | null = null;
    let bestScore = 0;

    for (const template of CONTRACT_TEMPLATES) {
      let score = 0;
      for (const keyword of template.keywords) {
        if (input.includes(keyword.toLowerCase())) {
          score += 1;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = template;
      }
    }

    // Only return if we have a reasonable match
    return bestScore >= 2 ? bestMatch : null;
  }

  /**
   * Generate clarification questions for ambiguities
   */
  private generateClarificationQuestions(intent: ParsedIntent): ConversationQuestion[] {
    const questions: ConversationQuestion[] = [];

    if (intent.ambiguities.includes('contract_type')) {
      questions.push({
        id: 'contract_type',
        text: 'What type of learning would you like to allow?',
        answerType: 'choice',
        choices: [
          {
            value: ContractType.OBSERVATION,
            label: 'Observation Only',
            description: 'Watch and understand, but don\'t store any memories',
          },
          {
            value: ContractType.EPISODIC,
            label: 'Specific Episodes',
            description: 'Store specific moments or events, no generalizing',
          },
          {
            value: ContractType.PROCEDURAL,
            label: 'Learn Patterns',
            description: 'Learn reusable tips and techniques',
          },
          {
            value: ContractType.STRATEGIC,
            label: 'Strategic Learning',
            description: 'Build long-term strategies (requires high trust)',
          },
          {
            value: ContractType.PROHIBITED,
            label: 'Prohibit Learning',
            description: 'Explicitly forbid any learning in this area',
          },
        ],
        required: true,
        helpText: 'This determines what the assistant can learn and remember.',
      });
    }

    if (intent.ambiguities.includes('domains')) {
      questions.push({
        id: 'domains',
        text: 'What subject areas does this apply to?',
        answerType: 'domains',
        required: true,
        helpText: 'Examples: coding, personal, work, gaming, finance',
      });
    }

    if (intent.ambiguities.includes('retention')) {
      questions.push({
        id: 'retention',
        text: 'How long should learned information be kept?',
        answerType: 'choice',
        choices: [
          {
            value: RetentionDuration.SESSION,
            label: 'This session only',
            description: 'Forget everything when the session ends',
          },
          {
            value: RetentionDuration.TIMEBOUND,
            label: 'For a limited time',
            description: 'Keep for a specific number of days',
          },
          {
            value: RetentionDuration.PERMANENT,
            label: 'Permanently',
            description: 'Keep until you revoke this contract',
          },
        ],
        required: true,
        helpText: 'You can always revoke the contract to delete memories.',
      });
    }

    if (intent.ambiguities.includes('generalization')) {
      questions.push({
        id: 'generalization',
        text: 'Should the assistant be able to apply learned patterns to similar situations?',
        answerType: 'confirm',
        defaultValue: false,
        required: true,
        helpText: 'If yes, learned tips can be automatically applied. If no, each memory stays separate.',
      });
    }

    return questions;
  }

  /**
   * Refine intent based on clarification answers
   */
  refineIntent(
    intent: ParsedIntent,
    answers: Array<{ questionId: string; value: unknown }>
  ): ParsedIntent {
    const refined = { ...intent };

    for (const answer of answers) {
      switch (answer.questionId) {
        case 'contract_type':
          refined.contractType = answer.value as ContractType;
          refined.ambiguities = refined.ambiguities.filter(a => a !== 'contract_type');
          break;
        case 'domains':
          if (Array.isArray(answer.value)) {
            refined.domains = answer.value as string[];
          } else if (typeof answer.value === 'string') {
            refined.domains = (answer.value as string).split(',').map(d => d.trim());
          }
          refined.ambiguities = refined.ambiguities.filter(a => a !== 'domains');
          break;
        case 'retention':
          refined.retention = answer.value as RetentionDuration;
          refined.ambiguities = refined.ambiguities.filter(a => a !== 'retention');
          break;
        case 'generalization':
          refined.allowGeneralization = answer.value as boolean;
          refined.ambiguities = refined.ambiguities.filter(a => a !== 'generalization');
          break;
        case 'retention_days':
          refined.retentionDays = answer.value as number;
          break;
      }
    }

    // Recalculate confidence
    refined.confidence = this.calculateConfidence(
      refined.contractType,
      refined.domains,
      refined.retention,
      refined.ambiguities.length
    );

    return refined;
  }
}
