import https from "node:https";

export interface CoverityConfig {
  host: string;
  port: number;
  ssl: boolean;
  user: string;
  authKey: string;
}

export function loadConfigFromEnv(): CoverityConfig {
  const host = process.env["COVERITY_HOST"];
  const user = process.env["COVERITY_USER"];
  const authKey = process.env["COVERITY_AUTH_KEY"];

  if (!host || !user || !authKey) {
    throw new Error(
      "Missing required environment variables: COVERITY_HOST, COVERITY_USER, COVERITY_AUTH_KEY"
    );
  }

  return {
    host,
    port: parseInt(process.env["COVERITY_PORT"] ?? "8443", 10),
    ssl: (process.env["COVERITY_SSL"] ?? "true").toLowerCase() !== "false",
    user,
    authKey,
  };
}

export interface CoverityProject {
  projectKey: string;
  id: { name: string };
  streams: Array<{ name: string }>;
  description?: string;
}

export interface CoverityStream {
  id: { name: string };
  language?: string;
  description?: string;
  primaryProjectId?: { name: string };
}

export interface CoverityIssue {
  cid: number;
  checkerName: string;
  displayType: string;
  displayImpact: string;
  displayStatus: string;
  displayFile: string;
  displayFunction: string;
  firstDetected: string;
  lastDetected: string;
  occurrenceCount: number;
}

export interface CoverityIssueDetail extends CoverityIssue {
  events: CoverityEvent[];
  triage: CoverityTriage;
}

export interface CoverityEvent {
  eventNumber: number;
  eventTag: string;
  eventDescription: string;
  filePathname: string;
  lineNumber: number;
}

export interface CoverityTriage {
  action: string;
  classification: string;
  severity: string;
  owner: string;
  comment?: string;
}

export class CoverityClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly agent?: https.Agent;

  constructor(private readonly config: CoverityConfig) {
    const scheme = config.ssl ? "https" : "http";
    this.baseUrl = `${scheme}://${config.host}:${config.port}`;
    this.authHeader =
      "Basic " +
      Buffer.from(`${config.user}:${config.authKey}`).toString("base64");

    if (config.ssl) {
      this.agent = new https.Agent({ rejectUnauthorized: false });
    }
  }

  private async request<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== "") {
          url.searchParams.set(key, value);
        }
      }
    }

    const options: RequestInit & { dispatcher?: unknown } = {
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
      },
    };

    // Pass the agent for self-signed cert support
    if (this.agent) {
      (options as Record<string, unknown>)["agent"] = this.agent;
    }

    const response = await fetch(url.toString(), options);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Coverity API error ${response.status} ${response.statusText}: ${body}`
      );
    }

    return (await response.json()) as T;
  }

  async listProjects(): Promise<CoverityProject[]> {
    interface ProjectsResponse {
      projects?: CoverityProject[];
      viewContentsV1?: { rows?: CoverityProject[] };
    }

    // Try v2 API first, fall back to view contents API
    try {
      const data = await this.request<ProjectsResponse>("/api/v2/projects");
      return data.projects ?? [];
    } catch {
      const data = await this.request<ProjectsResponse>(
        "/api/viewContents/projects/v1"
      );
      return data.viewContentsV1?.rows ?? [];
    }
  }

  async listStreams(projectName?: string): Promise<CoverityStream[]> {
    interface StreamsResponse {
      streams?: CoverityStream[];
      viewContentsV1?: { rows?: CoverityStream[] };
    }

    const params: Record<string, string> = {};
    if (projectName) {
      params["namePattern"] = projectName;
    }

    try {
      const data = await this.request<StreamsResponse>("/api/v2/streams", params);
      return data.streams ?? [];
    } catch {
      const data = await this.request<StreamsResponse>(
        "/api/viewContents/streams/v1",
        params
      );
      return data.viewContentsV1?.rows ?? [];
    }
  }

  async searchIssues(
    streamId: string,
    filters?: {
      checker?: string;
      impact?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<CoverityIssue[]> {
    interface IssuesResponse {
      viewContentsV1?: {
        rows?: CoverityIssue[];
        totalRows?: number;
      };
    }

    const params: Record<string, string> = {
      projectId: streamId,
      rowCount: String(filters?.limit ?? 25),
    };
    if (filters?.offset) params["offset"] = String(filters.offset);
    if (filters?.checker) params["checker"] = filters.checker;
    if (filters?.impact) params["impact"] = filters.impact;
    if (filters?.status) params["status"] = filters.status;

    const data = await this.request<IssuesResponse>(
      "/api/viewContents/issues/v1",
      params
    );
    return data.viewContentsV1?.rows ?? [];
  }

  async getIssueDetails(
    cid: number,
    streamId: string
  ): Promise<CoverityIssueDetail | null> {
    interface IssueDetailResponse {
      viewContentsV1?: {
        rows?: CoverityIssueDetail[];
      };
    }

    const data = await this.request<IssueDetailResponse>(
      `/api/viewContents/issues/v1/${cid}`,
      { projectId: streamId }
    );
    const rows = data.viewContentsV1?.rows;
    return rows?.[0] ?? null;
  }
}

let clientInstance: CoverityClient | null = null;

export function getCoverityClient(): CoverityClient {
  if (!clientInstance) {
    const config = loadConfigFromEnv();
    clientInstance = new CoverityClient(config);
  }
  return clientInstance;
}
