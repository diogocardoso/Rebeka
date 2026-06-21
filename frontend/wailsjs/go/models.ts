export namespace client {
	
	export class AuthData {
	    token: string;
	    username: string;
	    password: string;
	
	    static createFrom(source: any = {}) {
	        return new AuthData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.token = source["token"];
	        this.username = source["username"];
	        this.password = source["password"];
	    }
	}
	export class KeyValue {
	    key: string;
	    value: string;
	    enabled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new KeyValue(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.value = source["value"];
	        this.enabled = source["enabled"];
	    }
	}
	export class HTTPRequest {
	    method: string;
	    url: string;
	    queryParams: KeyValue[];
	    headers: KeyValue[];
	    bodyType: string;
	    body: string;
	    authType: string;
	    authData: AuthData;
	    variables: Record<string, string>;
	    timeoutSec: number;
	
	    static createFrom(source: any = {}) {
	        return new HTTPRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.method = source["method"];
	        this.url = source["url"];
	        this.queryParams = this.convertValues(source["queryParams"], KeyValue);
	        this.headers = this.convertValues(source["headers"], KeyValue);
	        this.bodyType = source["bodyType"];
	        this.body = source["body"];
	        this.authType = source["authType"];
	        this.authData = this.convertValues(source["authData"], AuthData);
	        this.variables = source["variables"];
	        this.timeoutSec = source["timeoutSec"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class HTTPResponse {
	    statusCode: number;
	    statusText: string;
	    headers: Record<string, string>;
	    body: string;
	    durationMs: number;
	    sizeBytes: number;
	    error?: string;
	    requestMethod: string;
	    requestURL: string;
	    requestHeaders: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new HTTPResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.statusCode = source["statusCode"];
	        this.statusText = source["statusText"];
	        this.headers = source["headers"];
	        this.body = source["body"];
	        this.durationMs = source["durationMs"];
	        this.sizeBytes = source["sizeBytes"];
	        this.error = source["error"];
	        this.requestMethod = source["requestMethod"];
	        this.requestURL = source["requestURL"];
	        this.requestHeaders = source["requestHeaders"];
	    }
	}

}

export namespace storage {
	
	export class Host {
	    id: string;
	    workspaceId: string;
	    name: string;
	    baseUrl: string;
	    isActive: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Host(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.workspaceId = source["workspaceId"];
	        this.name = source["name"];
	        this.baseUrl = source["baseUrl"];
	        this.isActive = source["isActive"];
	    }
	}
	export class ActiveHostVarsResult {
	    host: Host;
	    variables: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new ActiveHostVarsResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = this.convertValues(source["host"], Host);
	        this.variables = source["variables"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class EnvVariable {
	    id: string;
	    environmentId: string;
	    key: string;
	    value: string;
	
	    static createFrom(source: any = {}) {
	        return new EnvVariable(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.environmentId = source["environmentId"];
	        this.key = source["key"];
	        this.value = source["value"];
	    }
	}
	export class Environment {
	    id: string;
	    workspaceId: string;
	    hostId: string;
	    name: string;
	    isActive: boolean;
	    variables?: EnvVariable[];
	
	    static createFrom(source: any = {}) {
	        return new Environment(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.workspaceId = source["workspaceId"];
	        this.hostId = source["hostId"];
	        this.name = source["name"];
	        this.isActive = source["isActive"];
	        this.variables = this.convertValues(source["variables"], EnvVariable);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class HistoryEntry {
	    id: string;
	    requestId: string;
	    statusCode: number;
	    durationMs: number;
	    sizeBytes: number;
	    responseBody: string;
	    responseHeaders: string;
	    testResults: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new HistoryEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.requestId = source["requestId"];
	        this.statusCode = source["statusCode"];
	        this.durationMs = source["durationMs"];
	        this.sizeBytes = source["sizeBytes"];
	        this.responseBody = source["responseBody"];
	        this.responseHeaders = source["responseHeaders"];
	        this.testResults = source["testResults"];
	        this.createdAt = source["createdAt"];
	    }
	}
	
	export class Workflow {
	    id: string;
	    workspaceId: string;
	    hostId: string;
	    name: string;
	    graph: string;
	
	    static createFrom(source: any = {}) {
	        return new Workflow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.workspaceId = source["workspaceId"];
	        this.hostId = source["hostId"];
	        this.name = source["name"];
	        this.graph = source["graph"];
	    }
	}
	export class RequestData {
	    id: string;
	    method: string;
	    url: string;
	    urlMode: string;
	    queryParams: string;
	    headers: string;
	    bodyType: string;
	    body: string;
	    authType: string;
	    authData: string;
	    preScript: string;
	    postScript: string;
	
	    static createFrom(source: any = {}) {
	        return new RequestData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.method = source["method"];
	        this.url = source["url"];
	        this.urlMode = source["urlMode"];
	        this.queryParams = source["queryParams"];
	        this.headers = source["headers"];
	        this.bodyType = source["bodyType"];
	        this.body = source["body"];
	        this.authType = source["authType"];
	        this.authData = source["authData"];
	        this.preScript = source["preScript"];
	        this.postScript = source["postScript"];
	    }
	}
	export class TreeNode {
	    id: string;
	    workspaceId: string;
	    hostId: string;
	    parentId?: string;
	    name: string;
	    type: string;
	    sortOrder: number;
	
	    static createFrom(source: any = {}) {
	        return new TreeNode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.workspaceId = source["workspaceId"];
	        this.hostId = source["hostId"];
	        this.parentId = source["parentId"];
	        this.name = source["name"];
	        this.type = source["type"];
	        this.sortOrder = source["sortOrder"];
	    }
	}
	export class HostLoadData {
	    tree: TreeNode[];
	    requests: RequestData[];
	    environments: Environment[];
	    workflows: Workflow[];
	
	    static createFrom(source: any = {}) {
	        return new HostLoadData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.tree = this.convertValues(source["tree"], TreeNode);
	        this.requests = this.convertValues(source["requests"], RequestData);
	        this.environments = this.convertValues(source["environments"], Environment);
	        this.workflows = this.convertValues(source["workflows"], Workflow);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class JobRun {
	    id: string;
	    workflowId: string;
	    status: string;
	    details: string;
	    startedAt: string;
	    finishedAt?: string;
	
	    static createFrom(source: any = {}) {
	        return new JobRun(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.workflowId = source["workflowId"];
	        this.status = source["status"];
	        this.details = source["details"];
	        this.startedAt = source["startedAt"];
	        this.finishedAt = source["finishedAt"];
	    }
	}
	export class Workspace {
	    id: string;
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new Workspace(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	    }
	}
	export class UIState {
	    activeWorkspaceId: string;
	    activeHostId: string;
	    activeRequestId: string;
	    activeView: string;
	    sidebarWidth: number;
	
	    static createFrom(source: any = {}) {
	        return new UIState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.activeWorkspaceId = source["activeWorkspaceId"];
	        this.activeHostId = source["activeHostId"];
	        this.activeRequestId = source["activeRequestId"];
	        this.activeView = source["activeView"];
	        this.sidebarWidth = source["sidebarWidth"];
	    }
	}
	export class LoadResult {
	    uiState: UIState;
	    workspaces: Workspace[];
	    hosts: Host[];
	    tree: TreeNode[];
	    requests: RequestData[];
	    environments: Environment[];
	    workflows: Workflow[];
	    jobRuns: JobRun[];
	
	    static createFrom(source: any = {}) {
	        return new LoadResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uiState = this.convertValues(source["uiState"], UIState);
	        this.workspaces = this.convertValues(source["workspaces"], Workspace);
	        this.hosts = this.convertValues(source["hosts"], Host);
	        this.tree = this.convertValues(source["tree"], TreeNode);
	        this.requests = this.convertValues(source["requests"], RequestData);
	        this.environments = this.convertValues(source["environments"], Environment);
	        this.workflows = this.convertValues(source["workflows"], Workflow);
	        this.jobRuns = this.convertValues(source["jobRuns"], JobRun);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ManageEnvsInput {
	    action: string;
	    workspaceId: string;
	    hostId: string;
	    environment: Environment;
	    variables: EnvVariable[];
	    envId: string;
	
	    static createFrom(source: any = {}) {
	        return new ManageEnvsInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.action = source["action"];
	        this.workspaceId = source["workspaceId"];
	        this.hostId = source["hostId"];
	        this.environment = this.convertValues(source["environment"], Environment);
	        this.variables = this.convertValues(source["variables"], EnvVariable);
	        this.envId = source["envId"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ManageHostsInput {
	    action: string;
	    workspaceId: string;
	    host: Host;
	    hostId: string;
	
	    static createFrom(source: any = {}) {
	        return new ManageHostsInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.action = source["action"];
	        this.workspaceId = source["workspaceId"];
	        this.host = this.convertValues(source["host"], Host);
	        this.hostId = source["hostId"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class SavePayload {
	    uiState: UIState;
	    workspace?: Workspace;
	    workspaceId?: string;
	    tree?: TreeNode[];
	    requests?: RequestData[];
	    environment?: Environment;
	    workflow?: Workflow;
	
	    static createFrom(source: any = {}) {
	        return new SavePayload(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uiState = this.convertValues(source["uiState"], UIState);
	        this.workspace = this.convertValues(source["workspace"], Workspace);
	        this.workspaceId = source["workspaceId"];
	        this.tree = this.convertValues(source["tree"], TreeNode);
	        this.requests = this.convertValues(source["requests"], RequestData);
	        this.environment = this.convertValues(source["environment"], Environment);
	        this.workflow = this.convertValues(source["workflow"], Workflow);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	

}

export namespace workflow {
	
	export class NodeResult {
	    nodeId: string;
	    label: string;
	    response: client.HTTPResponse;
	    error?: string;
	    durationMs: number;
	
	    static createFrom(source: any = {}) {
	        return new NodeResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.nodeId = source["nodeId"];
	        this.label = source["label"];
	        this.response = this.convertValues(source["response"], client.HTTPResponse);
	        this.error = source["error"];
	        this.durationMs = source["durationMs"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RunResult {
	    workflowId: string;
	    results: NodeResult[];
	    status: string;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new RunResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.workflowId = source["workflowId"];
	        this.results = this.convertValues(source["results"], NodeResult);
	        this.status = source["status"];
	        this.error = source["error"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

