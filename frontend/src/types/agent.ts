export type AgentId = 'researcher' | 'analyst' | 'alternative' | 'critic' | 'specialist';

export type AgentVisualStatus = 
  | 'idle'
  | 'queued'
  | 'thinking'
  | 'speaking'
  | 'responding'
  | 'reviewing'
  | 'criticising'
  | 'revising'
  | 'completed'
  | 'failed'
  | 'recovering'
  | 'taking_over'
  | 'listening'
  | 'cancelled';

export interface AgentProfile {
  id: AgentId;
  name: string;
  role: string;
  badge: string;
  color: string;
  accentHex: string;
  avatarSeed: string;
  description: string;
}

export const AGENT_PROFILES: Record<AgentId, AgentProfile> = {
  researcher: {
    id: 'researcher',
    name: 'Researcher',
    role: 'Evidence Gathering & Document Retrieval',
    badge: 'EMPIRICAL',
    color: 'from-blue-600 to-cyan-500',
    accentHex: '#38BDF8',
    avatarSeed: 'Felix',
    description: 'Discovers verified facts, extracts citations, and parses domain literature.'
  },
  analyst: {
    id: 'analyst',
    name: 'Analyst',
    role: 'Logical Reasoning & Feasibility Analysis',
    badge: 'DEDUCTIVE',
    color: 'from-emerald-500 to-green-600',
    accentHex: '#5DD62C',
    avatarSeed: 'Zack',
    description: 'Breaks complex tasks down systematically and scrutinizes logical dependencies.'
  },
  alternative: {
    id: 'alternative',
    name: 'Alternative Thinker',
    role: 'Creative Strategies & Divergent Paradigms',
    badge: 'LATERAL',
    color: 'from-amber-500 to-orange-600',
    accentHex: '#F59E0B',
    avatarSeed: 'Aneka',
    description: 'Explores non-traditional vectors, out-of-the-box paradigms, and counter-perspectives.'
  },
  critic: {
    id: 'critic',
    name: 'Critic',
    role: 'Contradiction Detection & Quality Audit',
    badge: 'ADVERSARIAL',
    color: 'from-rose-500 to-red-600',
    accentHex: '#F43F5E',
    avatarSeed: 'Milo',
    description: 'Identifies fallacies, hallucinations, unsupported claims, and safety risks.'
  },
  specialist: {
    id: 'specialist',
    name: 'Specialist',
    role: 'Technical Synthesis & Implementation',
    badge: 'EXECUTIVE',
    color: 'from-purple-500 to-indigo-600',
    accentHex: '#B833A8',
    avatarSeed: 'Avery',
    description: 'Formulates concrete execution blueprints and production-ready recommendations.'
  }
};

