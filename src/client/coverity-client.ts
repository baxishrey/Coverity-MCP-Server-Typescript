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

// Matches GET /api/v2/projects response shape (§19)
export interface CoverityProject {
  name: string;
  projectKey: number;
  description?: string;
  streams?: CoverityStream[];
  streamLinks?: Array<{ name: string }>;
}

// Matches GET /api/v2/streams response shape (§26)
export interface CoverityStream {
  name: string;
  language?: string;
  description?: string;
  primaryProjectName?: string;
  triageStoreName?: string;
  outdated?: boolean;
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

  private async post<T>(
    path: string,
    body: unknown,
    params?: Record<string, string>
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== "") {
          url.searchParams.set(key, value);
        }
      }
    }

    const options: RequestInit & { dispatcher?: unknown } = {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    };

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

  // GET /api/v2/projects?includeStreams=true  (§19.1.3)
  async listProjects(): Promise<CoverityProject[]> {
    const data = await this.request<{ projects?: CoverityProject[] }>(
      "/api/v2/projects",
      { includeStreams: "true" }
    );
    return data.projects ?? [];
  }

  // GET /api/v2/streams  (§26.1.3)
  // When projectName is given, fetches the project and returns its embedded streams (§19.1.2)
  async listStreams(projectName?: string): Promise<CoverityStream[]> {
    if (projectName) {
      const data = await this.request<{
        projects?: Array<{ streams?: CoverityStream[] }>;
      }>(`/api/v2/projects/${encodeURIComponent(projectName)}`, {
        includeStreams: "true",
      });
      return data.projects?.[0]?.streams ?? [];
    }

    const data = await this.request<{ streams?: CoverityStream[] }>(
      "/api/v2/streams"
    );
    return data.streams ?? [];
  }

  // POST /api/v2/issues/search  (§12.1.3 / §12.1.4)
  async searchIssues(
    projectName: string,
    filters?: {
      checker?: string;
      impact?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<CoverityIssue[]> {
    interface IssueSearchResponse {
      offset: number;
      totalRows: number;
      columns: string[];
      rows: Array<Array<{ key: string; value: string }>>;
    }

    const COLUMNS = [
      "cid",
      "checker",
      "displayType",
      "displayImpact",
      "status",
      "displayFile",
      "displayFunction",
      "firstDetected",
      "lastDetected",
      "occurrenceCount",
    ] as const;

    const requestFilters: Array<{
      columnKey: string;
      matchMode: string;
      matchers: Array<{ class?: string; name?: string; key?: string; type: string }>;
    }> = [
      {
        columnKey: "project",
        matchMode: "oneOrMoreMatch",
        matchers: [{ class: "Project", name: projectName, type: "nameMatcher" }],
      },
    ];

    if (filters?.checker) {
      requestFilters.push({
        columnKey: "checker",
        matchMode: "oneOrMoreMatch",
        matchers: [{ key: filters.checker, type: "keyMatcher" }],
      });
    }
    if (filters?.impact) {
      requestFilters.push({
        columnKey: "displayImpact",
        matchMode: "oneOrMoreMatch",
        matchers: [{ key: filters.impact, type: "keyMatcher" }],
      });
    }
    if (filters?.status) {
      requestFilters.push({
        columnKey: "status",
        matchMode: "oneOrMoreMatch",
        matchers: [{ key: filters.status, type: "keyMatcher" }],
      });
    }

    const data = await this.post<IssueSearchResponse>(
      "/api/v2/issues/search",
      { filters: requestFilters, columns: [...COLUMNS] },
      {
        rowCount: String(filters?.limit ?? 25),
        offset: String(filters?.offset ?? 0),
        queryType: "byProject",
        sortOrder: "asc",
      }
    );

    return (data.rows ?? []).map((row) => {
      const flat = Object.fromEntries(row.map(({ key, value }) => [key, value]));
      return {
        cid: parseInt(flat["cid"] ?? "0", 10),
        checkerName: flat["checker"] ?? "",
        displayType: flat["displayType"] ?? "",
        displayImpact: flat["displayImpact"] ?? "",
        displayStatus: flat["status"] ?? "",
        displayFile: flat["displayFile"] ?? "",
        displayFunction: flat["displayFunction"] ?? "",
        firstDetected: flat["firstDetected"] ?? "",
        lastDetected: flat["lastDetected"] ?? "",
        occurrenceCount: parseInt(flat["occurrenceCount"] ?? "0", 10),
      };
    });
  }

  // GET /api/v2/issues/sourceCodeInfo  (§12.1.6)  — events & checker
  // GET /api/v2/issues/triageHistory   (§12.1.8)  — triage state
  // POST /api/v2/issues/search with cid filter    — display columns
  async getIssueDetails(
    cid: number,
    streamName: string
  ): Promise<CoverityIssueDetail | null> {
    interface SourceCodeInfoResponse {
      checkerName?: string;
      domain?: string;
      issueOccurrences?: Array<{
        id: string;
        events: Array<{
          eventNumber: string;
          eventTag: string;
          eventDescription: string;
          lineNumber: string;
          main: boolean;
          file: { filePathname: string };
        }>;
      }>;
      issueOccurrencesCount?: number;
    }

    interface TriageHistoryResponse {
      triageHistories?: Array<{
        id: number;
        attributeValuesList: Array<{
          attributeName: string;
          attributeValue: string;
        }>;
      }>;
    }

    interface IssueSearchResponse {
      totalRows: number;
      rows: Array<Array<{ key: string; value: string }>>;
    }

    const DETAIL_COLUMNS = [
      "cid",
      "checker",
      "displayType",
      "displayImpact",
      "status",
      "displayFile",
      "displayFunction",
      "firstDetected",
      "lastDetected",
      "occurrenceCount",
    ] as const;

    // Fire all three requests in parallel
    const [sourceResult, triageResult, searchResult] = await Promise.allSettled([
      this.request<SourceCodeInfoResponse>("/api/v2/issues/sourceCodeInfo", {
        cid: String(cid),
        streamName,
        includeTotalIssueOccurrencesCount: "true",
      }),
      this.request<TriageHistoryResponse>("/api/v2/issues/triageHistory", {
        cid: String(cid),
        triageStoreNames: "Default Triage Store",
      }),
      this.post<IssueSearchResponse>(
        "/api/v2/issues/search",
        {
          filters: [
            {
              columnKey: "cid",
              matchMode: "oneOrMoreMatch",
              matchers: [{ key: String(cid), type: "keyMatcher" }],
            },
          ],
          columns: [...DETAIL_COLUMNS],
        },
        { rowCount: "1", queryType: "byProject" }
      ),
    ]);

    // sourceCodeInfo is the primary source — if it fails there's nothing to return
    if (sourceResult.status === "rejected" || !sourceResult.value.checkerName) {
      return null;
    }
    const sourceData = sourceResult.value;

    // Parse events from the first issue occurrence
    const firstOccurrence = sourceData.issueOccurrences?.[0];
    const events: CoverityEvent[] = (firstOccurrence?.events ?? []).map((e) => ({
      eventNumber: parseInt(e.eventNumber, 10),
      eventTag: e.eventTag,
      eventDescription: e.eventDescription,
      filePathname: e.file.filePathname,
      lineNumber: parseInt(e.lineNumber, 10),
    }));

    // Parse triage from most-recent history entry (index 0)
    let triage: CoverityTriage = {
      action: "Undecided",
      classification: "Unclassified",
      severity: "Unspecified",
      owner: "",
    };
    if (triageResult.status === "fulfilled") {
      const latest = triageResult.value.triageHistories?.[0];
      if (latest) {
        const attrs = Object.fromEntries(
          latest.attributeValuesList.map(({ attributeName, attributeValue }) => [
            attributeName,
            attributeValue,
          ])
        );
        triage = {
          action: attrs["action"] ?? "Undecided",
          classification: attrs["classification"] ?? "Unclassified",
          severity: attrs["severity"] ?? "Unspecified",
          owner: attrs["owner"] ?? "",
          comment: attrs["comment"],
        };
      }
    }

    // Parse display columns from the search result (best-effort)
    let displayFields: Partial<CoverityIssue> = {};
    if (searchResult.status === "fulfilled" && searchResult.value.totalRows > 0) {
      const row = searchResult.value.rows[0];
      if (row) {
        const flat = Object.fromEntries(row.map(({ key, value }) => [key, value]));
        displayFields = {
          checkerName: flat["checker"] ?? sourceData.checkerName,
          displayType: flat["displayType"] ?? "",
          displayImpact: flat["displayImpact"] ?? "",
          displayStatus: flat["status"] ?? "",
          displayFile: flat["displayFile"] ?? "",
          displayFunction: flat["displayFunction"] ?? "",
          firstDetected: flat["firstDetected"] ?? "",
          lastDetected: flat["lastDetected"] ?? "",
          occurrenceCount: parseInt(flat["occurrenceCount"] ?? "0", 10),
        };
      }
    }

    return {
      cid,
      checkerName: displayFields.checkerName ?? sourceData.checkerName ?? "",
      displayType: displayFields.displayType ?? "",
      displayImpact: displayFields.displayImpact ?? "",
      displayStatus: displayFields.displayStatus ?? "",
      displayFile:
        displayFields.displayFile ??
        firstOccurrence?.events?.find((e) => e.main)?.file.filePathname ??
        firstOccurrence?.events?.[0]?.file.filePathname ??
        "",
      displayFunction: displayFields.displayFunction ?? "",
      firstDetected: displayFields.firstDetected ?? "",
      lastDetected: displayFields.lastDetected ?? "",
      occurrenceCount:
        displayFields.occurrenceCount ?? sourceData.issueOccurrencesCount ?? 0,
      events,
      triage,
    };
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
