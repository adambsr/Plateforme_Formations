export type ContentAccess = 'MANAGE' | 'STAFF_READ' | 'LEARNER_READ';
export type ResourceType = 'FILE' | 'EXTERNAL_URL';

export interface ContentResource {
  id: string;
  title: string;
  description: string;
  order: number;
  type: ResourceType;
  isVisibleToLearners: boolean;
  externalUrl?: string;
  file?: {
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    checksumSha256: string;
    uploadedById: string;
    uploadedAt: string;
    downloadUrl: string;
  };
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContentLesson {
  id: string;
  title: string;
  description: string;
  textContent: string;
  instructions: string;
  order: number;
  isArchived: boolean;
  resources: ContentResource[];
  createdAt: string;
  updatedAt: string;
}

export interface ContentModule {
  id: string;
  title: string;
  description: string;
  order: number;
  isArchived: boolean;
  lessons: ContentLesson[];
  createdAt: string;
  updatedAt: string;
}

export interface TrainingContent {
  trainingId: string;
  access: ContentAccess;
  modules: ContentModule[];
}
