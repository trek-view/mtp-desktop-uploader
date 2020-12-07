import { BrowserWindow, App } from 'electron';
import path from 'path';
import fs from 'fs';
import rimraf from 'rimraf';
import dayjs from 'dayjs';

import { IGeoPoint, IGeoPointModel } from '../../types/IGeoPoint';
import { Result, Summary } from '../../types/Result';

export const resultdirectory = 'sequences';

export const resultdirectorypath = (app: App) => {
  // path.resolve(app.getAppPath(), `../${resultdirectory}`);
  let basepath = app.getPath('home');
  const mtpPath = path.join(basepath, 'MTP');
  basepath = path.resolve(basepath, 'MTP', resultdirectory);

  return basepath;
}


export const tempLogo = 'output.png';

export const removeTempFiles = async (app: App) => {

  let basepath = app.getPath('home');
  const mtpPath = path.join(basepath, 'MTP');
  if (!fs.existsSync(mtpPath)) {
    fs.mkdirSync(mtpPath, { recursive: true });
  }
  basepath = path.resolve(basepath, 'MTP');

  const tempDirectory = basepath;
  fs.readdirSync(tempDirectory)
    .filter((n) => n.endsWith('.png'))
    .forEach((n) => {
      fs.unlinkSync(path.join(tempDirectory, n));
    });
};

export function sendToClient(
  win: BrowserWindow | null,
  channelname: string,
  ...args: any[]
) {
  // eslint-disable-next-line global-require
  if (win) win.webContents.send(channelname, ...args);
}

export function sendPoints(win: BrowserWindow | null, points: IGeoPoint[]) {
  sendToClient(
    win,
    'loaded_points',
    points.map((item: IGeoPoint) => {
      return item;
    })
  );
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export function getDistance(point1: any, point2: any) {
  if (!point1 || !point2) {
    return 0;
  }
  const lat2 = point2.MAPLatitude;
  const lon2 = point2.MAPLongitude;
  const lat1 = point1.MAPLatitude;
  const lon1 = point1.MAPLongitude;
  const R = 6371 * 1000; // Radius of the earth in meter
  const dLat = deg2rad(lat2 - lat1); // deg2rad below
  const dLon = deg2rad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
    Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d;
}

export function createdData2List(data: Result): Summary {
  const { sequence, photo } = data;
  return {
    id: sequence.id,
    tags: sequence.uploader_tags,
    name: sequence.uploader_sequence_name,
    description: sequence.uploader_sequence_description,
    type: sequence.uploader_transport_type,
    method: sequence.uploader_transport_method,
    time: sequence.durationsec,
    points: Object.keys(photo).map((id) => {
      const p = photo[id];
      return new IGeoPoint({
        id,
        GPSDateTime: p.modified.GPSDateTime,
        DateTimeOriginal: p.modified.originalDateTime,
        Azimuth: p.modified.heading,
        Pitch: p.modified.pitch,
        MAPAltitude: p.modified.altitude,
        MAPLatitude: p.modified.latitude,
        MAPLongitude: p.modified.longitude,
        Image: p.modified.filename,
        equirectangular: p.modified.projection === 'equirectangular',
      });
    }),
    total_km: sequence.distance_km,
    created: sequence.created,
    captured: sequence.earliest_time,
    camera: sequence.uploader_camera,
    destination: sequence.destination
      ? {
        ...sequence.destination,
      }
      : {},
  };
}

export function getBearing(point1: IGeoPoint, point2: IGeoPoint) {
  const lng1 = (point1.MAPLongitude * Math.PI) / 180;
  const lat1 = (point1.MAPLatitude * Math.PI) / 180;
  const lng2 = (point2.MAPLongitude * Math.PI) / 180;
  const lat2 = (point2.MAPLatitude * Math.PI) / 180;

  const dLon = lng2 - lng1;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

export function getPitch(point1: IGeoPoint, point2: IGeoPoint, distance = -1) {
  const dis = distance !== -1 ? distance : point1.Distance;
  return dis !== 0 ? (point2.MAPAltitude - point1.MAPAltitude) / dis : 0;
}

export function getSequenceBasePath(
  seqname: string,
  basepath: string
): string | any {
  const directoryname = seqname.toLowerCase().replace(/\s/g, '_');
  return path.resolve(basepath, `../${resultdirectory}`, directoryname);
}

export function getOriginalBasePath(seqname: string, basepath: string): string {
  return path.resolve(getSequenceBasePath(seqname, basepath), 'originals');
}

export function getSequenceImagePath(
  seqname: string,
  filename: string,
  basepath: string
): string {
  return path.resolve(getOriginalBasePath(seqname, basepath), filename);
}

export enum OutputType {
  raw = 'final_raw',
  nadir = 'final_nadir',
  blur = 'final_blurred',
}

export function getSequenceOutputPath(
  seqname: string,
  type: OutputType,
  basepath: string
): string {
  return path.resolve(getSequenceBasePath(seqname, basepath), type);
}

export function getSequenceOutputFilePath(
  seqname: string,
  filename: string,
  type: OutputType,
  basepath: string
): string {
  return path.resolve(getSequenceBasePath(seqname, basepath), type, filename);
}

export function getSequenceLogPath(seqname: string, basepath: string): string {
  const logofile = seqname.toLowerCase().replace(/\s/g, '_');
  return path.join(getSequenceBasePath(seqname, basepath), `${logofile}.json`);
}

export function getLogFilePath(fname: string, seqname: string, basepath: string): string {
  return path.join(getSequenceBasePath(seqname, basepath), `${fname}.json`);
}

export function getSequenceIntegrationLogPath(
  seqname: string,
  basepath: string,
  integrationModuleName: string
): string {
  return path.join(
    getSequenceBasePath(seqname, basepath),
    `${integrationModuleName}_sequence.json`
  );
}

export function getSequenceGpxPath(seqname: string, basepath: string): string {
  const logofile = seqname.toLowerCase().replace(/\s/g, '_');
  return path.join(getSequenceBasePath(seqname, basepath), `${logofile}.gpx`);
}

export function discardPointsBySeconds(
  points: IGeoPoint[],
  seconds: number,
  forceUpdate = false
): IGeoPoint[] {
  const newpoints = [];
  let nextIdx = 1;
  let currentIdx = 0;
  while (true) {
    const point = points[currentIdx];

    if (nextIdx >= points.length) {
      point.setDistance(0);

      if (newpoints.length) {
        const prevPoint = newpoints[newpoints.length - 1];

        if (prevPoint.Azimuth) {
          point.setAzimuth(prevPoint.Azimuth);
        }

        if (prevPoint.Pitch) {
          point.setPitch(prevPoint.Pitch);
        }
        newpoints.push(point);
      } else {
        point.setAzimuth(0);
        point.setPitch(0);
      }

      break;
    }

    const nextPoint = points[nextIdx];

    let timediff = nextPoint.getDate().diff(point.getDate(), 'millisecond');
    if (timediff === 0) timediff = nextPoint.getDateOriginal().diff(point.getDateOriginal(), 'millisecond');

    if (
      timediff >=
      seconds * 1000
    ) {
      const azimuth = getBearing(point, nextPoint);
      point.setAzimuth(azimuth);

      const distance = getDistance(nextPoint, point);
      point.setDistance(distance);

      const pitch = getPitch(point, nextPoint, distance);
      point.setPitch(pitch);
      newpoints.push(point);

      currentIdx = nextIdx;
    }
    nextIdx += 1;
  }

  return newpoints;
}

export const errorHandler = (
  mainWindow: BrowserWindow | null,
  err: any,
  channelName = 'error'
) => {
  if (typeof err === 'string') {
    sendToClient(mainWindow, channelName, err);
  } else if (err.message) {
    sendToClient(mainWindow, channelName, err.message);
  } else {
    sendToClient(mainWindow, channelName, JSON.stringify(err));
  }
};

export const uploadErrorHandler = (
  mainWindow: BrowserWindow | null,
  err: any,
  result: any,
  points: IGeoPoint[],
  dir: string
) => {
  sendToClient(mainWindow, 'upload_error', JSON.stringify(err), result, points, dir);
};

export const removeDirectory = async (directoryPath: string) => {
  if (fs.existsSync(directoryPath)) {
    await rimraf.sync(directoryPath);
  }
  return true;
};

export const resetSequence = async (sequence: any, app: App) => {
  let basepath = app.getPath('home');
  const mtpPath = path.join(basepath, 'MTP');
  if (!fs.existsSync(mtpPath)) {
    fs.mkdirSync(mtpPath, { recursive: true });
  }
  basepath = path.resolve(basepath, 'MTP', 'app');
  await Promise.all([
    removeDirectory(getSequenceBasePath(sequence.steps.name, basepath)),
    removeTempFiles(app),
  ]);
};

export const importGpx = (
  proppoints: IGeoPointModel[],
  gpxPoints: any,
  modifyTime = 0
) => {
  const points = proppoints.map((p: IGeoPointModel) => new IGeoPoint({ ...p }));

  const newPoints: IGeoPoint[] = [];

  points.forEach((point: IGeoPoint) => {
    const pointTime = dayjs(point.DateTimeOriginal)
      .add(modifyTime, 'second')
      .format('YYYY-MM-DDTHH:mm:ss');

    if (pointTime in gpxPoints) {
      const gpxPoint = gpxPoints[pointTime];
      newPoints.push(
        new IGeoPoint({
          ...point,
          GPSDateTime: pointTime,
          DateTimeOriginal: pointTime,
          MAPLongitude: gpxPoint.longitude,
          MAPLatitude: gpxPoint.latitude,
          MAPAltitude: gpxPoint.elevation
            ? gpxPoint.elevation
            : point.MAPAltitude,
        })
      );
    }
  });
  return newPoints.length ? discardPointsBySeconds(newPoints, 1, true) : [];
};

export const parseExifDateTime = (exifdatetime: any): string => {
  return dayjs(
    new Date(
      exifdatetime.year,
      exifdatetime.month - 1,
      exifdatetime.day,
      exifdatetime.hour,
      exifdatetime.minute,
      exifdatetime.second,
      exifdatetime.millisecond
    )
  ).format('YYYY-MM-DDTHH:mm:ss');
};
