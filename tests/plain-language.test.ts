/**
 * Plain-Language Interface Tests
 */

import {
  LearningContractsSystem,
  PlainLanguageParser,
  PlainLanguageSummarizer,
  ConversationalContractBuilder,
  ContractType,
  ContractState,
  RetentionDuration,
  BoundaryMode,
  CONTRACT_TEMPLATES,
  searchTemplates,
  getTemplateById,
} from '../src';

describe('PlainLanguageParser', () => {
  let parser: PlainLanguageParser;

  beforeEach(() => {
    parser = new PlainLanguageParser();
  });

  describe('parse', () => {
    test('should parse coding-related input', () => {
      const result = parser.parse('Learn coding tips from my Python programming sessions');

      expect(result.success).toBe(true);
      expect(result.intent).not.toBeNull();
      expect(result.intent!.domains).toContain('coding');
      expect(result.intent!.domains).toContain('python');
    });

    test('should detect procedural contract type', () => {
      const result = parser.parse('Learn reusable best practices and techniques from coding');

      expect(result.success).toBe(true);
      expect(result.intent!.contractType).toBe(ContractType.PROCEDURAL);
    });

    test('should detect prohibited contract type', () => {
      const result = parser.parse('Never learn anything about my finances or medical records');

      expect(result.success).toBe(true);
      expect(result.intent!.contractType).toBe(ContractType.PROHIBITED);
      expect(result.intent!.domains).toContain('finance');
      expect(result.intent!.domains).toContain('medical');
    });

    test('should detect observation contract type', () => {
      const result = parser.parse('Just observe my sessions without storing anything');

      expect(result.success).toBe(true);
      expect(result.intent!.contractType).toBe(ContractType.OBSERVATION);
    });

    test('should detect episodic contract type', () => {
      const result = parser.parse('Capture specific moments from my gaming streams');

      expect(result.success).toBe(true);
      expect(result.intent!.contractType).toBe(ContractType.EPISODIC);
      expect(result.intent!.domains).toContain('gaming');
    });

    test('should detect retention duration', () => {
      const result = parser.parse('Keep coding tips forever and permanently');

      expect(result.success).toBe(true);
      expect(result.intent!.retention).toBe(RetentionDuration.PERMANENT);
    });

    test('should extract retention days', () => {
      const result = parser.parse('Store memories for 30 days');

      expect(result.success).toBe(true);
      expect(result.intent!.retentionDays).toBe(30);
    });

    test('should detect tools', () => {
      const result = parser.parse('Learn coding patterns from VS Code and terminal usage');

      expect(result.success).toBe(true);
      expect(result.intent!.tools).toContain('vs-code');
      expect(result.intent!.tools).toContain('terminal');
    });

    test('should reject too-short input', () => {
      const result = parser.parse('hi');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should identify ambiguities', () => {
      const result = parser.parse('learn some stuff');

      expect(result.success).toBe(true);
      expect(result.intent!.ambiguities.length).toBeGreaterThan(0);
    });

    test('should suggest matching template', () => {
      const result = parser.parse('Learn coding best practices and tips from my Python sessions');

      expect(result.success).toBe(true);
      expect(result.suggestedTemplate).not.toBeNull();
      expect(result.suggestedTemplate!.id).toBe('coding-best-practices');
    });
  });

  describe('refineIntent', () => {
    test('should refine intent with answers', () => {
      const result = parser.parse('learn some coding');
      const intent = result.intent!;

      const refined = parser.refineIntent(intent, [
        { questionId: 'retention', value: RetentionDuration.PERMANENT },
        { questionId: 'contract_type', value: ContractType.PROCEDURAL },
      ]);

      expect(refined.retention).toBe(RetentionDuration.PERMANENT);
      expect(refined.contractType).toBe(ContractType.PROCEDURAL);
      expect(refined.confidence).toBeGreaterThan(intent.confidence);
    });
  });
});

describe('PlainLanguageSummarizer', () => {
  let summarizer: PlainLanguageSummarizer;
  let system: LearningContractsSystem;

  beforeEach(() => {
    summarizer = new PlainLanguageSummarizer();
    system = new LearningContractsSystem();
  });

  describe('summarize', () => {
    test('should generate prose summary', () => {
      const contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
        contexts: ['project-alpha'],
      });

      const summary = summarizer.summarize(contract, { format: 'prose' });

      expect(summary).toContain('Episodic Learning');
      expect(summary).toContain('coding');
      expect(summary).toContain('revoke');
    });

    test('should generate bullet summary', () => {
      const contract = system.createProceduralContract('alice', {
        domains: ['coding'],
      });

      const summary = summarizer.summarize(contract, { format: 'bullets' });

      expect(summary).toContain('**Type:**');
      expect(summary).toContain('Procedural');
      expect(summary).toContain('**Domains:**');
    });

    test('should include warnings when requested', () => {
      let contract = system.createStrategicContract('alice', {
        domains: ['business'],
      });

      const summary = summarizer.summarize(contract, { includeWarnings: true });

      expect(summary).toContain('high trust');
    });

    test('should include technical details when requested', () => {
      const contract = system.createEpisodicContract('alice', {
        domains: ['test'],
      });

      const summary = summarizer.summarize(contract, { includeTechnical: true });

      expect(summary).toContain('ID=');
      expect(summary).toContain('Classification Cap=');
    });
  });

  describe('shortSummary', () => {
    test('should generate short summary', () => {
      const contract = system.createProceduralContract('alice', {
        domains: ['coding', 'debugging'],
      });

      const summary = summarizer.shortSummary(contract);

      expect(summary).toContain('Procedural');
      expect(summary).toContain('coding');
      expect(summary).toContain('Draft');
    });
  });
});

describe('ConversationalContractBuilder', () => {
  let builder: ConversationalContractBuilder;

  beforeEach(() => {
    builder = new ConversationalContractBuilder();
  });

  describe('startConversation', () => {
    test('should start a new conversation', () => {
      const response = builder.startConversation('alice');

      expect(response.isComplete).toBe(false);
      expect(response.questions.length).toBeGreaterThan(0);
      expect(response.message).toContain('Learning Contract');
    });
  });

  describe('processInput', () => {
    test('should process natural language input', () => {
      builder.startConversation('alice');
      // Get the actual conversation ID
      const conversations = (builder as any).conversations as Map<string, unknown>;
      const actualConversationId = Array.from(conversations.keys())[0];

      const response = builder.processInput(
        actualConversationId,
        'Learn coding best practices from my Python sessions permanently'
      );

      expect(response.isComplete).toBe(false);
      // Should move forward in the conversation
    });

    test('should handle invalid conversation ID', () => {
      const response = builder.processInput('invalid-id', 'test input');

      expect(response.message).toContain('not found');
    });
  });

  describe('useTemplate', () => {
    test('should apply template to conversation', () => {
      builder.startConversation('alice');
      const conversations = (builder as any).conversations as Map<string, unknown>;
      const conversationId = Array.from(conversations.keys())[0];

      const response = builder.useTemplate(conversationId, 'coding-best-practices');

      expect(response.message).toContain('Coding Best Practices');
    });

    test('should handle invalid template ID', () => {
      builder.startConversation('alice');
      const conversations = (builder as any).conversations as Map<string, unknown>;
      const conversationId = Array.from(conversations.keys())[0];

      const response = builder.useTemplate(conversationId, 'invalid-template');

      expect(response.message).toContain('not found');
    });
  });

  describe('cancelConversation', () => {
    test('should cancel an existing conversation', () => {
      builder.startConversation('alice');
      const conversations = (builder as any).conversations as Map<string, unknown>;
      const conversationId = Array.from(conversations.keys())[0];

      const result = builder.cancelConversation(conversationId);

      expect(result).toBe(true);
      expect(builder.getConversation(conversationId)).toBeNull();
    });
  });
});

describe('Contract Templates', () => {
  test('should have predefined templates', () => {
    expect(CONTRACT_TEMPLATES.length).toBeGreaterThan(0);
  });

  test('should have coding template', () => {
    const template = getTemplateById('coding-best-practices');

    expect(template).not.toBeNull();
    expect(template!.defaults.contractType).toBe(ContractType.PROCEDURAL);
  });

  test('should have gaming template', () => {
    const template = getTemplateById('gaming-streaming');

    expect(template).not.toBeNull();
    expect(template!.defaults.contractType).toBe(ContractType.EPISODIC);
  });

  test('should have prohibited template', () => {
    const template = getTemplateById('prohibited-domains');

    expect(template).not.toBeNull();
    expect(template!.defaults.contractType).toBe(ContractType.PROHIBITED);
  });

  test('should search templates by keyword', () => {
    const results = searchTemplates('coding');

    expect(results.length).toBeGreaterThan(0);
    expect(results.some(t => t.id === 'coding-best-practices')).toBe(true);
  });

  test('should search templates by description', () => {
    const results = searchTemplates('gameplay');

    expect(results.length).toBeGreaterThan(0);
    expect(results.some(t => t.id === 'gaming-streaming')).toBe(true);
  });
});

describe('LearningContractsSystem - Plain Language Integration', () => {
  let system: LearningContractsSystem;

  beforeEach(() => {
    system = new LearningContractsSystem();
  });

  describe('startPlainLanguageConversation', () => {
    test('should start a conversation', () => {
      const response = system.startPlainLanguageConversation('alice');

      expect(response.isComplete).toBe(false);
      expect(response.questions.length).toBeGreaterThan(0);
    });
  });

  describe('parseNaturalLanguage', () => {
    test('should parse natural language input', () => {
      const result = system.parseNaturalLanguage(
        'Learn coding patterns from my Python sessions'
      );

      expect(result.success).toBe(true);
      expect(result.intent!.domains).toContain('coding');
    });
  });

  describe('getContractSummary', () => {
    test('should return summary for existing contract', () => {
      const contract = system.createEpisodicContract('alice', {
        domains: ['test'],
      });

      const summary = system.getContractSummary(contract.contract_id);

      expect(summary).not.toBeNull();
      expect(summary).toContain('Episodic');
    });

    test('should return null for non-existent contract', () => {
      const summary = system.getContractSummary('non-existent-id');

      expect(summary).toBeNull();
    });
  });

  describe('getContractShortSummary', () => {
    test('should return short summary', () => {
      const contract = system.createProceduralContract('alice', {
        domains: ['coding'],
      });

      const summary = system.getContractShortSummary(contract.contract_id);

      expect(summary).not.toBeNull();
      expect(summary!.length).toBeLessThan(100);
    });
  });

  describe('getContractTemplates', () => {
    test('should return all templates', () => {
      const templates = system.getContractTemplates();

      expect(templates.length).toBeGreaterThan(0);
    });
  });

  describe('searchContractTemplates', () => {
    test('should search templates', () => {
      const results = system.searchContractTemplates('gaming');

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('createContractFromPlainLanguage', () => {
    test('should create contract from plain-language draft', () => {
      const draft = {
        createdBy: 'alice',
        contractType: ContractType.PROCEDURAL,
        domains: ['coding'],
        contexts: ['personal-projects'],
        tools: ['vs-code'],
        retention: RetentionDuration.PERMANENT,
        classificationCap: 3,
        allowGeneralization: true,
        generalizationConditions: ['Within coding domain only'],
        requiresOwner: false,
        boundaryModeMin: BoundaryMode.NORMAL,
        plainLanguageSummary: 'Test summary',
      };

      const contract = system.createContractFromPlainLanguage(draft);

      expect(contract.contract_type).toBe(ContractType.PROCEDURAL);
      expect(contract.scope.domains).toContain('coding');
      expect(contract.scope.contexts).toContain('personal-projects');
      expect(contract.generalization_rules.allowed).toBe(true);
      expect(contract.state).toBe(ContractState.DRAFT);
    });
  });
});
