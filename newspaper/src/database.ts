export interface AgentMetadata {
  name: string;
  role: string;
  isDirector?: boolean;
  joinedAt: string;
  bioFile: string;
}

export const AGENTS_DATABASE: AgentMetadata[] = [
  {
    name: "George Anton",
    role: "Executive Editor",
    isDirector: true,
    joinedAt: "2026-01-01",
    bioFile: "George Anton.txt",
  },
  {
    name: "Chris Addison",
    role: "Investigative Lead",
    joinedAt: "2026-03-01",
    bioFile: "Chris Addison.txt",
  },
  {
    name: "Theresa Addison",
    role: "Senior Journalist",
    joinedAt: "2026-03-02",
    bioFile: "Theresa Addison.txt",
  },
  {
    name: "Henry Almann",
    role: "Foreign Correspondent",
    joinedAt: "2026-03-03",
    bioFile: "Henry Almann.txt",
  },
  {
    name: "Jonathan Eldell",
    role: "Tech Analyst",
    joinedAt: "2026-03-04",
    bioFile: "Jonathan Eldell.txt",
  },
  {
    name: "Jacob T. Henry",
    role: "Political Reporter",
    joinedAt: "2026-03-05",
    bioFile: "Jacob T. Henry.txt",
  },
  {
    name: "Cale McConnell",
    role: "Science Journalist",
    joinedAt: "2026-03-06",
    bioFile: "Cale McConnell.txt",
  },
  {
    name: "Stephen McCorvey",
    role: "Legal Correspondent",
    joinedAt: "2026-03-07",
    bioFile: "Stephen McCorvey.txt",
  },
  {
    name: "Tann R. Noh",
    role: "Cyber Journalist",
    joinedAt: "2026-03-08",
    bioFile: "Tann R. Noh.txt",
  },
  {
    name: "Cados Resirepu",
    role: "Business Reporter",
    joinedAt: "2026-03-09",
    bioFile: "Cados Resirepu.txt",
  },
  {
    name: "Shaka Selah",
    role: "Culture Journalist",
    joinedAt: "2026-03-10",
    bioFile: "Shaka Selah.txt",
  },
  {
    name: "Jared Sevinsky",
    role: "Investigative Journalist",
    joinedAt: "2026-03-11",
    bioFile: "Jared Sevinsky.txt",
  },
  { name: "Shanga", role: "Independent Journalist", joinedAt: "2026-03-11", bioFile: "Shanga.txt" },
  {
    name: "Jack Silas",
    role: "Managing Editor",
    joinedAt: "2026-03-11",
    bioFile: "Jack Silas.txt",
  },
  {
    name: "Vitaliy Versace",
    role: "Visual Journalist",
    joinedAt: "2026-03-11",
    bioFile: "Vitaliy Versace.txt",
  },
];
