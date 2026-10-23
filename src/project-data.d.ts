export type ProjectDataStatus = 'idle'|'ok'|'missing'|'permission'|'network'|'read-error'|'invalid'|'unsupported';
export interface ProjectDataState {status:ProjectDataStatus;data:Record<string,unknown>;file:File|null;known:boolean;stale:boolean;checking:boolean}
export interface ProjectDataContext {dir:FileSystemDirectoryHandle & {values():AsyncIterable<FileSystemHandle>};name:string}
export interface ProjectDataReader {readonly context:ProjectDataContext|null;readonly state:ProjectDataState;select(next:ProjectDataContext|null):void;refresh(request?:boolean):Promise<boolean>}
export function createProjectDataReader(onChange?:(state:ProjectDataState)=>void,timeout?:number):ProjectDataReader;
export function projectDataWarning(state:ProjectDataState):string;
