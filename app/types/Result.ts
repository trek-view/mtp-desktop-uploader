import { IGeoPoint } from './IGeoPoint';

export enum TransportType {
  Powered = 'Powered',
  Land = 'Land',
  Water = 'Water',
  Air = 'Air',
  Snow = 'Snow',
}

export interface Destination {
  [key: string]: string | boolean;
}

export interface Sequence {
  [x: string]: string;
  id: string;
  distance_km: number;
  earliest_time?: string;
  latest_time?: string;
  durationsec: number;
  average_speed_kmh: number;
  sharelink: string;
  uploader_sequence_name: string;
  uploader_sequence_description: string;
  uploader_transport_type: TransportType;
  uploader_transport_method: string;
  uploader_camera: string;
  uploader_tags: string[];
  created: string;
  destination: Destination;
}

export interface GooglePhotoRes {
  photoId: string;
  filename: string;
  shareLink: string;
}

export interface Connection {
  distance_mtrs: number;
  heading_deg: number;
  pitch_deg: number;
  adj_heading_deg: number;
  time_sec: number;
  speed_kmh: number;
}

export interface Connections {
  [key: string]: Connection;
}

export interface Photo {
  GPSDateTime?: string;
  MAPAltitude?: number;
  MAPLatitude?: number;
  MAPLongitude?: number;

  MAPCaptureTime: string;
  MTPSequenceName: string;
  MTPSequenceDescription: string;
  MTPSequenceTransport: string;
  MTPSequenceTags: string[];
  MTPImageCopy: string;
  MTPImageProjection: string;
  MTPUploaderPhotoUUID: string;
  MTPUploaderSequenceUUID: string;

  connections?: Connections;
}

export interface Export {
  filename?: string;
  GPSDateTime?: string;
  originalDateTime: string;
  altitude?: number;
  latitude?: number;
  longitude?: number;
  gps_direction_ref?: string;
  gps_speed?: number;
  heading?: number;
  pitch?: number;
  roll?: string;
  camera_make?: string;
  camera_model?: string;
  projection: string;
}

export interface ExportPhoto {
  photoId: string;
  shareLink: string;
  original: Export;
  modified: Export;
  connections?: Connections;
}

export interface Photos {
  [key: string]: ExportPhoto;
}

export interface Result {
  sequence: Sequence;
  photo: Photos;
}

export interface Description {
  photo: Photo;
  sequence: Sequence;
}

export interface Descriptions {
  [key: string]: Description;
}

export interface Results {
  [key: string]: Result;
}

export interface Summary {
  id: string;
  tags: string[];
  name: string;
  description: string;
  type: TransportType;
  method: string;
  time: number;
  points: IGeoPoint[];
  created: string;
  captured: string;
  total_km: number;
  camera: string;
  destination: Destination;
}
