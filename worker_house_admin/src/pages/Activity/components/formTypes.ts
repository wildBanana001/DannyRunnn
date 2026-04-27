import type { Dayjs } from 'dayjs';
import type { Activity } from '@/types';

export interface ActivityFormValues {
  address: string;
  cardEligible: boolean;
  category: string;
  covers: string[];
  description: string;
  endDate: Dayjs;
  endTime: Dayjs;
  fullDescription: string;
  gallery: string[];
  hostAvatar: string;
  hostDescription: string;
  hostName: string;
  includes: Array<{ value: string }>;
  location: string;
  maxParticipants: number;
  originalPrice?: number | null;
  price: number;
  refundPolicy: string;
  requirements: Array<{ value: string }>;
  startDate: Dayjs;
  startTime: Dayjs;
  status: Activity['status'];
  tags: string[];
  title: string;
  venueDescription: string;
  venueImages: string[];
  venueName: string;
}
