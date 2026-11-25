import type { LessonSummary } from "@/lib/db";

export interface LessonGroup {
  title: string;
  description: string;
  lessons: LessonSummary[];
}

type GroupDefinition = { title: string; description: string; positions: readonly number[] };

const groupedCategories: Record<string, readonly GroupDefinition[]> = {
  ai: [
    { title: "Start Here: AI Foundations", description: "What AI is, what to learn and in what order, and the Python and math you need, with runnable examples.", positions: [11, 1, 12, 13] },
    { title: "Core Concepts", description: "Machine learning, data and training, neural networks, transformers and LLMs, prompting, RAG, agents, evaluation and production.", positions: [2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 15] },
    { title: "24-Week Plan: Software Architect to AI Architect", description: "A week-by-week plan with daily tasks, weekend builds and checklists: classic ML, deep learning, LLM engineering, RAG, agents, evals, security, fine-tuning and production.", positions: [16, 17, 18, 19, 20, 21, 22, 23] },
  ],
  career: [
    { title: "Start Here: Plan Your Search", description: "Pick a clear target role, then build a resume, LinkedIn profile and portfolio that match it.", positions: [1, 2, 3, 4] },
    { title: "Finding Opportunities", description: "The best job sites, referrals and cold outreach, and certifications that help you get shortlisted.", positions: [5, 6, 7] },
    { title: "Interview Preparation", description: "Technical rounds, behavioral answers with STAR, and smart questions to ask the interviewer.", positions: [8, 9, 10] },
    { title: "Offer and Beyond", description: "Negotiate your offer, handle follow-ups and rejection, and start strong in your first 90 days.", positions: [11, 12] },
  ],
  "system-design-l6": [
    { title: "Start Here: Learn the STAR Method", description: "Define the situation and task, explain your actions, then validate the result.", positions: [1, 12, 39] },
    { title: "Core Concepts Through Worked Scenarios", description: "Connect capacity, caching, networking and data choices to concrete user requirements.", positions: [7, 33, 8, 10, 11, 23, 24, 25, 26, 40, 38] },
    { title: "Reliability: Failure and Recovery", description: "Walk through retries, overload, coordination and regional failures without losing correctness.", positions: [2, 3, 34, 6, 35, 9, 27, 28, 36, 37, 42] },
    { title: "Architecture and Operations", description: "Use measurable outcomes to choose boundaries, analytical pipelines and safe releases.", positions: [19, 29, 30] },
    { title: "STAR Case Studies", description: "Follow a user scenario from requirements through normal requests, failures, recovery and validation.", positions: [4, 5, 13, 14, 15, 16, 17, 18, 20, 21, 22, 31, 32, 41] },
  ],
  aws: [
    { title: "AWS Foundations", description: "Core services every developer uses to build, deploy and secure applications.", positions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
    { title: "Advanced AWS", description: "Policy evaluation, hybrid networking, data modeling, governance, resilience, containers at scale and cost.", positions: [17, 18, 19, 20, 21, 22, 23, 24] },
    { title: "Interview Prep", description: "Short, correct answers to common AWS interview questions.", positions: [16] },
    { title: "Practical Project", description: "Hands-on labs: S3 uploads with CloudFront delivery, and a containerized app end to end on EKS with ECR, Pod Identity, RDS, ingress and CI/CD.", positions: [25, 26] },
  ],
  databases: [
    { title: "Database Design & Performance", description: "Relations, normalization, transactions, indexes, query performance and scaling.", positions: [1, 2, 3, 4, 5, 6, 7] },
    { title: "Database Interview Prep", description: "Thirty DBMS interview questions with detailed answers and SQL practice.", positions: [8, 9, 10, 11, 12] },
  ],
  "linux-devops": [
    { title: "Start Here", description: "What DevOps means and the path from git push to a live server.", positions: [1] },
    { title: "Linux Server Essentials", description: "The command line, users and permissions, processes and systemd, SSH, firewalls, Bash and cron.", positions: [2, 3, 4, 5, 6] },
    { title: "Deploying to Production", description: "Nginx with HTTPS, a step-by-step VPS deploy, Docker in production, zero-downtime releases, monitoring and backups.", positions: [7, 8, 10, 11, 12] },
    { title: "CI/CD Pipelines", description: "Pipeline design that works in any tool, GitHub Actions, and Jenkins from first Jenkinsfile to production deploys.", positions: [14, 9, 15, 16] },
    { title: "Operating Platform Services", description: "Running Kafka in production: clusters, tuning, security, monitoring, topics as code and upgrades.", positions: [17] },
    { title: "Troubleshooting & Interview Prep", description: "A step-by-step playbook for production problems and common DevOps interview questions.", positions: [13] },
  ],
  "software-architecture": [
    { title: "Beginner Foundations", description: "Start with the core vocabulary, common application structure, and C4 diagrams for explaining a system.", positions: [1, 2, 14] },
    { title: "Intermediate Architecture Patterns", description: "Compare boundaries, domain modelling, communication styles and practical trade-offs.", positions: [3, 4, 5, 6, 7, 9, 10, 11, 12, 13] },
    { title: "Advanced Domain Design", description: "Apply tactical DDD patterns to model complex business rules safely.", positions: [8] },
  ],
};

export function groupLessons(categorySlug: string, lessons: LessonSummary[]): LessonGroup[] {
  const definitions = groupedCategories[categorySlug];
  if (!definitions) return [{ title: "Lessons", description: "", lessons }];
  const byPosition = new Map(lessons.map((lesson) => [lesson.position, lesson]));
  return definitions.map((group) => ({
    title: group.title,
    description: group.description,
    lessons: group.positions.flatMap((position) => {
      const lesson = byPosition.get(position);
      return lesson ? [lesson] : [];
    }),
  })).filter((group) => group.lessons.length > 0);
}
