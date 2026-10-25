import type { Activity } from './index';

export interface AdminActivity extends Activity {
  location: string;
  address?: string;
}

export interface ActivityEditorForm {
  title: string;
  description: string;
  fullDescription: string;
  coverImage: string;
  gallery: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string;
  address: string;
  price: string;
  maxParticipants: string;
  category: string;
  hostName: string;
  refundPolicy: string;
}

export interface ActivityImportResult {
  draft: Omit<ActivityEditorForm, 'gallery' | 'price' | 'maxParticipants'> & {
    gallery: string[];
    price: number | null;
    maxParticipants: number | null;
  };
  warnings: string[];
}
