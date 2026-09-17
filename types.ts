export interface Position {
  x: number;
  y: number;
}

export interface CompanyInfo {
  companyName: string;
  cnpj: string;
  detectedPositions?: Position[];
  customTextLines?: string[]; // New field for user-editable lines
}

export enum StampPosition {
  TOP_LEFT = 'TOP_LEFT',
  TOP_RIGHT = 'TOP_RIGHT',
  BOTTOM_LEFT = 'BOTTOM_LEFT',
  BOTTOM_RIGHT = 'BOTTOM_RIGHT',
  CUSTOM = 'CUSTOM',
}

export type StampTargetPage = 'all' | 'first' | 'last' | number;

export interface StampInstance {
  id: string;
  info: CompanyInfo;
  position: StampPosition;
  dateText: string | null;
  customX: number;
  customY: number;
  scale: number;
  targetPage: StampTargetPage;
  pagePositions: Record<number, Position>;
}

export type ProcessingStatus = 'idle' | 'analyzing' | 'stamping' | 'done' | 'error';
