/**
 * Plain-Language Summarizer
 *
 * Generates human-readable summaries of Learning Contracts.
 * Converts technical contract structures into clear, understandable descriptions.
 */

import {
  LearningContract,
  ContractType,
  ContractState,
  RetentionDuration,
  BoundaryMode,
} from '../types';
import { SummaryOptions, ContractDraftFromLanguage } from './types';

/**
 * Human-readable names for contract types
 */
const CONTRACT_TYPE_NAMES: Record<ContractType, string> = {
  [ContractType.OBSERVATION]: 'Observation Only',
  [ContractType.EPISODIC]: 'Episodic Learning',
  [ContractType.PROCEDURAL]: 'Procedural Learning',
  [ContractType.STRATEGIC]: 'Strategic Learning',
  [ContractType.PROHIBITED]: 'Prohibited Domain',
};

/**
 * Human-readable descriptions for contract types
 */
const CONTRACT_TYPE_DESCRIPTIONS: Record<ContractType, string> = {
  [ContractType.OBSERVATION]: 'observe but not store memories',
  [ContractType.EPISODIC]: 'capture and store specific moments',
  [ContractType.PROCEDURAL]: 'learn reusable tips and patterns',
  [ContractType.STRATEGIC]: 'build long-term strategies',
  [ContractType.PROHIBITED]: 'NEVER learn anything',
};

/**
 * Human-readable names for contract states
 */
const STATE_NAMES: Record<ContractState, string> = {
  [ContractState.DRAFT]: 'Draft',
  [ContractState.REVIEW]: 'Pending Review',
  [ContractState.ACTIVE]: 'Active',
  [ContractState.EXPIRED]: 'Expired',
  [ContractState.REVOKED]: 'Revoked',
  [ContractState.AMENDED]: 'Amended',
};

/**
 * Human-readable retention descriptions
 */
const RETENTION_DESCRIPTIONS: Record<RetentionDuration, string> = {
  [RetentionDuration.SESSION]: 'forgotten when the session ends',
  [RetentionDuration.TIMEBOUND]: 'kept for a limited time',
  [RetentionDuration.PERMANENT]: 'kept permanently until you revoke',
};

/**
 * Human-readable boundary mode descriptions
 */
const BOUNDARY_MODE_DESCRIPTIONS: Record<BoundaryMode, string> = {
  [BoundaryMode.RESTRICTED]: 'restricted environments only',
  [BoundaryMode.NORMAL]: 'normal trust level',
  [BoundaryMode.TRUSTED]: 'trusted environments',
  [BoundaryMode.PRIVILEGED]: 'privileged/highest trust',
};

/**
 * Plain-Language Summarizer
 */
export class PlainLanguageSummarizer {
  /**
   * Generate a plain-language summary of a contract
   */
  summarize(contract: LearningContract, options: SummaryOptions = {}): string {
    const {
      includeTechnical = false,
      format = 'prose',
      includeWarnings = true,
    } = options;

    if (format === 'bullets') {
      return this.generateBulletSummary(contract, includeTechnical, includeWarnings);
    }

    return this.generateProseSummary(contract, includeTechnical, includeWarnings);
  }

  /**
   * Generate a prose-style summary
   */
  private generateProseSummary(
    contract: LearningContract,
    includeTechnical: boolean,
    includeWarnings: boolean
  ): string {
    const parts: string[] = [];

    // Opening statement
    parts.push(this.generateOpeningStatement(contract));

    // What can be learned
    parts.push(this.generateLearningDescription(contract));

    // Scope
    if (contract.scope.domains.length > 0 || contract.scope.contexts.length > 0) {
      parts.push(this.generateScopeDescription(contract));
    }

    // Retention
    parts.push(this.generateRetentionDescription(contract));

    // Recall rules
    parts.push(this.generateRecallDescription(contract));

    // Security
    parts.push(this.generateSecurityDescription(contract));

    // Revocability
    parts.push(this.generateRevocabilityDescription(contract));

    // Warnings
    if (includeWarnings) {
      const warnings = this.generateWarnings(contract);
      if (warnings) {
        parts.push(warnings);
      }
    }

    // Technical details
    if (includeTechnical) {
      parts.push(this.generateTechnicalDetails(contract));
    }

    return parts.join(' ');
  }

  /**
   * Generate a bullet-point summary
   */
  private generateBulletSummary(
    contract: LearningContract,
    includeTechnical: boolean,
    includeWarnings: boolean
  ): string {
    const bullets: string[] = [];

    // Contract type and status
    bullets.push(`**Type:** ${CONTRACT_TYPE_NAMES[contract.contract_type]}`);
    bullets.push(`**Status:** ${STATE_NAMES[contract.state]}`);

    // What's allowed
    if (contract.contract_type === ContractType.PROHIBITED) {
      bullets.push('**Learning:** Completely forbidden');
    } else {
      bullets.push(`**Memory Storage:** ${contract.memory_permissions.may_store ? 'Allowed' : 'Not allowed'}`);
      bullets.push(`**Generalization:** ${contract.generalization_rules.allowed ? 'Allowed' : 'Not allowed'}`);
    }

    // Scope
    if (contract.scope.domains.length > 0) {
      bullets.push(`**Domains:** ${contract.scope.domains.join(', ')}`);
    }
    if (contract.scope.contexts.length > 0) {
      bullets.push(`**Contexts:** ${contract.scope.contexts.join(', ')}`);
    }
    if (contract.scope.tools.length > 0) {
      bullets.push(`**Tools:** ${contract.scope.tools.join(', ')}`);
    }

    // Retention
    bullets.push(`**Retention:** ${this.formatRetention(contract)}`);

    // Recall
    bullets.push(`**Recall requires:** ${contract.recall_rules.requires_owner ? 'Your approval' : 'No approval needed'}`);
    bullets.push(`**Trust level needed:** ${BOUNDARY_MODE_DESCRIPTIONS[contract.recall_rules.boundary_mode_min]}`);

    // Transferability
    bullets.push(`**Can be shared:** ${contract.scope.transferable ? 'Yes' : 'No (stays on this system)'}`);

    // Revocability
    bullets.push(`**Can be revoked:** ${contract.revocable ? 'Yes, anytime' : 'No (can only expire)'}`);

    // Technical
    if (includeTechnical) {
      bullets.push(`**Contract ID:** ${contract.contract_id}`);
      bullets.push(`**Created:** ${contract.created_at.toISOString()}`);
      bullets.push(`**Classification Cap:** ${contract.memory_permissions.classification_cap}`);
      bullets.push(`**Max Abstraction:** ${contract.scope.max_abstraction}`);
    }

    // Warnings
    if (includeWarnings) {
      const warningList = this.getWarningList(contract);
      if (warningList.length > 0) {
        bullets.push('');
        bullets.push('**Warnings:**');
        warningList.forEach(w => bullets.push(`  - ${w}`));
      }
    }

    return bullets.map(b => `• ${b}`).join('\n');
  }

  /**
   * Generate opening statement
   */
  private generateOpeningStatement(contract: LearningContract): string {
    const typeName = CONTRACT_TYPE_NAMES[contract.contract_type];
    const statusName = STATE_NAMES[contract.state].toLowerCase();

    if (contract.contract_type === ContractType.PROHIBITED) {
      return `This is a ${typeName} contract (${statusName}) that explicitly FORBIDS all learning.`;
    }

    return `This is a ${typeName} contract (${statusName}).`;
  }

  /**
   * Generate learning description
   */
  private generateLearningDescription(contract: LearningContract): string {
    const action = CONTRACT_TYPE_DESCRIPTIONS[contract.contract_type];

    if (contract.contract_type === ContractType.PROHIBITED) {
      return `The assistant must ${action} in the specified domains.`;
    }

    if (contract.contract_type === ContractType.OBSERVATION) {
      return `You allow the assistant to ${action} — nothing is stored.`;
    }

    let desc = `You allow the assistant to ${action}`;

    if (contract.generalization_rules.allowed) {
      desc += ' and apply them in similar future situations';
    }

    desc += '.';

    return desc;
  }

  /**
   * Generate scope description
   */
  private generateScopeDescription(contract: LearningContract): string {
    const parts: string[] = [];

    if (contract.scope.domains.length > 0) {
      parts.push(`in ${this.formatList(contract.scope.domains)}`);
    }

    if (contract.scope.contexts.length > 0) {
      parts.push(`within ${this.formatList(contract.scope.contexts)} contexts`);
    }

    if (contract.scope.tools.length > 0) {
      parts.push(`using ${this.formatList(contract.scope.tools)}`);
    }

    if (parts.length === 0) {
      return 'This applies broadly without specific domain restrictions.';
    }

    return `This applies ${parts.join(', ')}.`;
  }

  /**
   * Generate retention description
   */
  private generateRetentionDescription(contract: LearningContract): string {
    if (contract.contract_type === ContractType.OBSERVATION) {
      return 'Nothing is stored, so retention does not apply.';
    }

    if (contract.contract_type === ContractType.PROHIBITED) {
      return 'Since learning is prohibited, nothing will be retained.';
    }

    const retention = this.formatRetention(contract);
    return `Memories are ${retention}.`;
  }

  /**
   * Generate recall description
   */
  private generateRecallDescription(contract: LearningContract): string {
    if (contract.contract_type === ContractType.OBSERVATION) {
      return '';
    }

    if (contract.contract_type === ContractType.PROHIBITED) {
      return '';
    }

    const parts: string[] = [];

    if (contract.recall_rules.requires_owner) {
      parts.push('Recalling memories requires your approval each time');
    } else {
      parts.push('Memories can be recalled automatically without asking');
    }

    if (contract.recall_rules.boundary_mode_min !== BoundaryMode.NORMAL) {
      parts.push(`in ${BOUNDARY_MODE_DESCRIPTIONS[contract.recall_rules.boundary_mode_min]}`);
    }

    return parts.join(' ') + '.';
  }

  /**
   * Generate security description
   */
  private generateSecurityDescription(contract: LearningContract): string {
    if (contract.scope.transferable) {
      return 'Warning: This contract allows memories to be transferred outside this system.';
    }

    return 'Nothing will be shared outside this system.';
  }

  /**
   * Generate revocability description
   */
  private generateRevocabilityDescription(contract: LearningContract): string {
    if (contract.revocable) {
      return 'You can revoke this contract at any time to delete all associated memories.';
    }

    return 'This contract cannot be revoked — it can only expire or be amended.';
  }

  /**
   * Generate warnings
   */
  private generateWarnings(contract: LearningContract): string {
    const warnings = this.getWarningList(contract);
    if (warnings.length === 0) return '';

    return 'Note: ' + warnings.join('. ') + '.';
  }

  /**
   * Get list of warnings
   */
  private getWarningList(contract: LearningContract): string[] {
    const warnings: string[] = [];

    if (contract.contract_type === ContractType.STRATEGIC) {
      warnings.push('Strategic learning requires high trust mode');
    }

    if (contract.scope.transferable) {
      warnings.push('Memories can be transferred outside this system');
    }

    if (!contract.revocable) {
      warnings.push('This contract cannot be revoked');
    }

    if (contract.generalization_rules.allowed && contract.generalization_rules.conditions.length === 0) {
      warnings.push('Generalization is allowed without specific conditions');
    }

    if (contract.state === ContractState.EXPIRED) {
      warnings.push('This contract has expired — memories are frozen');
    }

    if (contract.state === ContractState.REVOKED) {
      warnings.push('This contract has been revoked — memories are inaccessible');
    }

    return warnings;
  }

  /**
   * Generate technical details
   */
  private generateTechnicalDetails(contract: LearningContract): string {
    return `[Technical: ID=${contract.contract_id}, Classification Cap=${contract.memory_permissions.classification_cap}, Max Abstraction=${contract.scope.max_abstraction}]`;
  }

  /**
   * Format retention
   */
  private formatRetention(contract: LearningContract): string {
    switch (contract.memory_permissions.retention) {
      case RetentionDuration.SESSION:
        return 'forgotten when the session ends';
      case RetentionDuration.TIMEBOUND:
        if (contract.memory_permissions.retention_until) {
          const date = contract.memory_permissions.retention_until;
          return `kept until ${date.toLocaleDateString()}`;
        }
        return 'kept for a limited time';
      case RetentionDuration.PERMANENT:
        return 'kept permanently until you revoke';
      default:
        return 'kept according to contract rules';
    }
  }

  /**
   * Format a list of items
   */
  private formatList(items: string[]): string {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
  }

  /**
   * Generate a summary from a draft (before contract is created)
   */
  summarizeDraft(draft: ContractDraftFromLanguage): string {
    const parts: string[] = [];

    // What's being allowed
    const action = CONTRACT_TYPE_DESCRIPTIONS[draft.contractType];
    if (draft.contractType === ContractType.PROHIBITED) {
      parts.push(`You PROHIBIT all learning ${action}`);
    } else {
      parts.push(`You allow the assistant to ${action}`);
    }

    // Scope
    if (draft.domains.length > 0) {
      parts.push(`in ${this.formatList(draft.domains)}`);
    }

    if (draft.contexts.length > 0) {
      parts.push(`within ${this.formatList(draft.contexts)}`);
    }

    if (draft.tools.length > 0) {
      parts.push(`using ${this.formatList(draft.tools)}`);
    }

    // Generalization
    if (draft.allowGeneralization && draft.contractType !== ContractType.PROHIBITED) {
      parts.push('. These can be applied in similar future situations');
    }

    // Retention
    parts.push(`. Memories are ${RETENTION_DESCRIPTIONS[draft.retention]}`);

    // Recall
    if (draft.requiresOwner) {
      parts.push('. Recall requires your approval each time');
    } else {
      parts.push('. Memories can be recalled automatically');
    }

    // Security
    parts.push('. Nothing will be shared outside this system');

    // Revocability
    if (draft.contractType !== ContractType.PROHIBITED) {
      parts.push('. You can revoke this at any time');
    }

    return parts.join('') + '.';
  }

  /**
   * Generate a short (one-line) description
   */
  shortSummary(contract: LearningContract): string {
    const type = CONTRACT_TYPE_NAMES[contract.contract_type];
    const domains = contract.scope.domains.length > 0
      ? contract.scope.domains.slice(0, 2).join(', ')
      : 'all domains';

    return `${type} for ${domains} (${STATE_NAMES[contract.state]})`;
  }
}
