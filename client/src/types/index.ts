export interface UserInfo {
  userId: string;
  email: string;
  name: string;
}

export interface ClientContext {
  user?: UserInfo;
  deviceType: string;
  bookId?: string;
  currentUrl: string;
  timestamp: string;
}

export interface IngestEvent {
  type: 'file_saved' | 'chunks_start' | 'batch_stored' | 'file_done' | 'done' | 'error';
  file?: string;
  total?: number;
  stored?: number;
  message?: string;
}

export interface ToolAnnotation {
  type: 'tool_executing' | 'tool_result' | 'tool_error' | 'session' | 'error';
  tools?: string[];
  tool?: string;
  result?: string;
  error?: string;
  sessionId?: string;
  message?: string;
}
