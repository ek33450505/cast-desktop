export interface PtyOutputPayload {
  session_id: string;
  data: string;
}

export interface SessionInfo {
  id: string;
  name: string;
  shell: string;
  created_at: number;
}

export interface GitStatus {
  branch: string;
  dirty: boolean;
}

export interface SessionExitPayload {
  session_id: string;
  reason: 'eof' | 'killed';
}

export interface ForegroundProcess {
  name: string;
  pid: number;
}
