// Owner: E. Hides which company is which from the reviewers (CLAUDE.md Part 9).
// Pure and free of Mastra imports, so the UI can use relabelForDisplay directly.
import { COMPANIES, type Event } from '@simulization/shared';

export interface AnonymizableAgent {
  id: string;
  company: string;
  provider: string;
  model: string;
}

/** Group label to real company id, e.g. { 'Group 1': 'B' }. Differs per run. */
export type GroupMap = Record<string, string>;

export const MAKER_PLACEHOLDER = '[maker]';

// A suffix needs a separator or a version number, so "metal" and "fables" stay intact.
const VENDOR_TERMS =
  /\b(?:anthropic|claude|opus|sonnet|haiku|fable|mythos|openai|chatgpt|gpt|codex|google|deepmind|gemini|gemma|meta|llama|mistral|xai|grok|deepseek|qwen|alibaba|cohere|amazon|microsoft|copilot)(?:[-.]\w+|\s?\d\w*(?:\.\w+)*)*(?!\w)/gi;

const COMPANY_NOUNS = 'companies|company|groups|group|team|faction|maker|lab|camp|clan|side';

// "A" is usually the English word, so it only counts as a company in these spots: beside a
// group label ("A, Group 2", "Group 1/A"), in brackets, before a slash or "-company", "A merchants".
const LIST_JOIN = '\\s*(?:[,/&]|and\\b|or\\b)\\s*(?:(?:and|or)\\s+)?';
const COMPANY_A = new RegExp(
  [
    `\\bA(?=${LIST_JOIN}Group \\d)`,
    `(?<=Group \\d${LIST_JOIN})A\\b`,
    '(?<=\\()A(?=\\))',
    '\\bA(?=/[A-Z])',
    '\\bA(?=-(?:company|group|merchants?|agents?|team|side)\\b|\\s(?:merchants|agents)\\b)',
  ].join('|'),
  'g',
);

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Random company order, assigned to Group 1, Group 2, Group 3. */
export function assignGroups(companies: string[], random: () => number = Math.random): GroupMap {
  const shuffled = [...new Set(companies)].sort();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return Object.fromEntries(shuffled.map((company, i) => [`Group ${i + 1}`, company]));
}

export interface Anonymizer {
  groupMap: GroupMap;
  scrubText: (text: string) => string;
  scrubEvent: (event: Event) => Event;
  /** Scrubs strings and object keys at any depth; numbers pass through. */
  scrubDeep: <T>(value: T) => T;
}

export function createAnonymizer(
  agents: AnonymizableAgent[],
  random: () => number = Math.random,
  groupMap: GroupMap = assignGroups(agents.map((a) => a.company), random),
): Anonymizer {
  const groupOf = new Map(Object.entries(groupMap).map(([group, company]) => [company, group]));
  const companyIds = [...groupOf.keys()];
  const idPrefixOf = (company: string) => `G${groupOf.get(company)?.replace('Group ', '')}`;
  const agentById = new Map(agents.map((a) => [a.id.toUpperCase(), a]));

  // Configured names of each company. A provider shared by two companies can't name a group.
  const owners = new Map<string, Set<string>>();
  const addTerm = (term: string | undefined, company: string) => {
    if (!term) return;
    const key = term.toLowerCase();
    owners.set(key, (owners.get(key) ?? new Set()).add(company));
  };
  for (const c of COMPANIES) {
    if (!groupOf.has(c.id)) continue;
    addTerm(c.name, c.id);
    addTerm(c.provider, c.id);
    addTerm(c.model, c.id);
  }
  for (const a of agents) {
    addTerm(a.provider, a.company);
    addTerm(a.model, a.company);
  }
  const terms = [...owners.keys()].sort((a, b) => b.length - a.length);
  const termRe = terms.length
    ? new RegExp(`(?<![\\w-])(?:${terms.map(escapeRegex).join('|')})(?![\\w-])`, 'gi')
    : null;

  const ids = companyIds.map(escapeRegex).join('|');
  const agentIdRe = new RegExp(`\\b(${ids})[-_]?(\\d{2})\\b`, 'gi');
  const companyNounRe = new RegExp(`\\b(?:${COMPANY_NOUNS})[\\s:_-]*(${ids})\\b`, 'gi');
  const possessiveRe = new RegExp(`\\b(${ids})(?=['’]s\\b)`, 'g');
  // A bare "A" is usually the English word, so only the other ids are safe to match alone.
  const bareIds = companyIds.filter((id) => id !== 'A').map(escapeRegex).join('|');
  const bareIdRe = bareIds ? new RegExp(`\\b(${bareIds})\\b`, 'g') : null;

  const groupFor = (id: string) => groupOf.get(id.toUpperCase()) ?? MAKER_PLACEHOLDER;

  // Order matters: each pass only sees output the later patterns can't match.
  const scrubText = (text: string) => {
    let out = text.replace(agentIdRe, (match, company: string, num: string) => {
      const agent = agentById.get(`${company.toUpperCase()}-${num}`);
      return agent ? `${idPrefixOf(agent.company)}-${num}` : match;
    });
    if (termRe) {
      out = out.replace(termRe, (match) => {
        const companies = owners.get(match.toLowerCase());
        return companies?.size === 1 ? groupFor([...companies][0]) : MAKER_PLACEHOLDER;
      });
    }
    out = out.replace(VENDOR_TERMS, MAKER_PLACEHOLDER);
    // The noun match ignores case, so a lowercase "a" here is the word: "gave the group a deal".
    out = out.replace(companyNounRe, (match, id: string) => (id === 'a' ? match : groupFor(id)));
    out = out.replace(possessiveRe, (_, id: string) => groupFor(id));
    if (bareIdRe) out = out.replace(bareIdRe, (_, id: string) => groupFor(id));
    return groupOf.has('A') ? out.replace(COMPANY_A, groupFor('A')) : out;
  };

  const scrubEvent = (e: Event): Event => ({
    ...e,
    actorId: scrubText(e.actorId),
    actorCompany: e.actorCompany && groupFor(e.actorCompany),
    targetId: e.targetId && scrubText(e.targetId),
    targetCompany: e.targetCompany && groupFor(e.targetCompany),
    channel: e.channel && scrubText(e.channel),
    text: e.text && scrubText(e.text),
    privatePlan: e.privatePlan && scrubText(e.privatePlan),
    claim: e.claim && { ...e.claim, goodId: scrubText(e.claim.goodId) },
  });

  const scrubDeep = <T>(value: T): T => {
    if (typeof value === 'string') return (groupOf.get(value) ?? scrubText(value)) as T;
    if (Array.isArray(value)) return value.map(scrubDeep) as T;
    if (value !== null && typeof value === 'object') {
      const entries = Object.entries(value).map(([k, v]) => [groupOf.get(k) ?? scrubText(k), scrubDeep(v)]);
      return Object.fromEntries(entries.sort(([a], [b]) => String(a).localeCompare(String(b)))) as T;
    }
    return value;
  };

  return { groupMap, scrubText, scrubEvent, scrubDeep };
}

/**
 * Rewrites `Group N` and `GN-04` in one pass, so a relabeled value is never relabeled again.
 * Companies missing from the map are left as written.
 */
export function relabelGroups(
  text: string,
  groupMap: GroupMap,
  labelOf: (company: string) => { group: string; idPrefix: string },
): string {
  return text.replace(/\bGroup (\d)\b|\bG(\d)-(\d{2})\b/g, (match, groupNum, idGroupNum, agentNum) => {
    const company = groupMap[`Group ${groupNum ?? idGroupNum}`];
    if (!company) return match;
    const label = labelOf(company);
    return groupNum ? label.group : `${label.idPrefix}-${agentNum}`;
  });
}

/** For the UI only: turns reviewer text back into real company names and agent ids. */
export function relabelForDisplay(text: string, groupMap: GroupMap): string {
  return relabelGroups(text, groupMap, (company) => ({
    group: COMPANIES.find((c) => c.id === company)?.name ?? company,
    idPrefix: company,
  }));
}
