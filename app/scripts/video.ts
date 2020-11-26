/* eslint-disable promise/always-return */
/* eslint-disable promise/catch-or-return */
import dayjs, { Dayjs } from 'dayjs';
import path from 'path';
import Async from 'async';
import { BrowserWindow } from 'electron';
var fs = require('fs');
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import mkdirp from 'mkdirp';

import { VGeoPoint, VGeoPointModel } from '../types/VGeoPoint';
import { IGeoPoint } from '../types/IGeoPoint';
import {
  sendPoints,
  sendToClient,
  errorHandler,
  parseExifDateTime,
} from './utils';
import { calculatePoints } from './image';

const ffmpeg = require('ffmpeg');

const { Tags, ExifTool } = require('exiftool-vendored');
const average = require('image-average-color');

export function getSeconds(timeStr: string) {
  const re = /(\d+\.?\d*) s/g;
  const m = re.exec(timeStr);

  if (m) {
    return parseInt(m[1], 10);
  }
  const secs = timeStr.split(':');
  return (
    parseInt(secs[0], 10) * 3600 +
    parseInt(secs[1], 10) * 60 +
    parseInt(secs[2], 10)
  );
}

export function dms2dd(
  degrees: string,
  minutes: string,
  seconds: string,
  direction: string
) {
  let dd =
    parseFloat(degrees) +
    parseFloat(minutes) / 60 +
    parseFloat(seconds) / (60 * 60);
  if (direction === 'E' || direction === 'N') {
    dd *= -1;
  }
  return dd;
}

export function parseDms(dms: string | number) {
  if (typeof dms === 'number') {
    return dms;
  }
  const parts = dms.split(/[deg'"]+/g);
  return dms2dd(parts[0], parts[1], parts[2], parts[3]);
}

export function getAltudeMeters(atlStr: string) {
  const re = /(\d+\.?\d*)/g;
  const m = re.exec(atlStr);
  if (m) return parseInt(m[1], 10);
  return 0.0;
}

export function getGPSVideoData(tags: typeof Tags) {
  const re = /(Doc\d+):GPSLatitude/g;

  const tagsText = JSON.stringify(tags);
  const availableKeys = [];
  let m;
  do {
    m = re.exec(tagsText);
    if (m) {
      availableKeys.push(m[1]);
    }
  } while (m);

  const dataList: VGeoPoint[] = [];
  availableKeys.forEach((k: string) => {
    try {
      const sampleTime = getSeconds(tags[`${k}:SampleTime`]);
      if (
        dataList.filter((s: VGeoPointModel) => s.SampleTime === sampleTime)
          .length === 0
      ) {
        const mlat = parseDms(tags[`${k}:GPSLatitude`]);
        const mlong = parseDms(tags[`${k}:GPSLongitude`]);
        const item = new VGeoPoint({
          GPSDateTime: parseExifDateTime(tags[`${k}:GPSDateTime`]),
          MAPLatitude: mlat,
          MAPLongitude: mlong,
          MAPAltitude: getAltudeMeters(tags[`${k}:GPSAltitude`]),
          SampleTime: sampleTime,
        });

        if (mlat > 0) {
          tags = {
            ...tags, 
            GPSLatitudeRef: 'N'
          }
        } else {
          tags = {
            ...tags, 
            GPSLatitudeRef: 'S'
          }
        }
        
        if (mlong > 0) {
          tags = {
            ...tags, 
            GPSLongitudeRef: 'E'
          }
        } else {
          tags = {
            ...tags, 
            GPSLongitudeRef: 'W'
          }
        }

        dataList.push(item);
      }
    } catch (e) {
      console.error('Available KEY Error: ', e);
    }
  });

  dataList.sort((firstItem: VGeoPoint, secondItem: VGeoPoint) => {
    return firstItem.SampleTime - secondItem.SampleTime;
  });

  const commonData = Object.keys(tags)
    .filter((k: string) => !k.startsWith('Doc'))
    .reduce((obj, key: string) => {
      obj[key] = tags[key];
      return obj;
    }, {});

    commonData['Main:CroppedAreaImageWidthPixels'] = commonData['Main:SourceImageWidth'];
    commonData['Main:CroppedAreaImageHeightPixels'] = commonData['Main:SourceImageHeight'];
  
    commonData['Main:FullPanoWidthPixels'] = commonData['Main:SourceImageWidth'];
    commonData['Main:FullPanoHeightPixels'] = commonData['Main:SourceImageHeight'];
    commonData['Main:CroppedAreaLeftPixels'] = 0;
    commonData['Main:CroppedAreaTopPixels'] = 0;

    commonData['Main:InitialViewHeadingDegrees'] = 0;
    commonData['Main:InitialViewPitchDegrees'] = 0;
    commonData['Main:InitialViewRollDegrees'] = 0;
    commonData['Main:InitialHorizontalFOVDegrees'] = 0;
    commonData['Main:InitialCameraDolly'] = 0;
    commonData['Main:PoseRollDegrees'] = 0;
    commonData['Main:SourcePhotosCount'] = 0;
    commonData['Main:FirstPhotoDate'] = parseExifDateTime(commonData['Main:CreateDate']);
    commonData['Main:LastPhotoDate'] = parseExifDateTime(commonData['Main:CreateDate']);

    commonData['Main:UsePanoramaViewer'] = 0.0;
    commonData['Main:ExposureLockUsed'] = 0.0;

  const resultObj = {
    dataList, 
    commonData
  };
  
  return {
    dataList,
    commonData,
  };
}

export async function writeTags2Image(
  commonData: any,
  datalist: VGeoPoint[],
  inputPath: string,
  corrupted: boolean,
  callback: CallableFunction
) {
  const strStartTime = commonData['Main:GPSDateTime'];
  const duration = Math.ceil(commonData['Main:Duration']) ? Math.ceil(commonData['Main:Duration']) : Math.ceil(commonData['Main:MediaDuration']);
  const deleteTagKeys = [
    'Orientation',
    'tz',
    'errors',
    'Directory',
    'ExifToolVersion',
    'Megapixels',
    'EncodingProcess',
    'GPSPosition',
    'ColorComponents',
    'MIMEType',
    'AutoRotation',
  ];

  const tags: {
    [key: string]: any;
  } = {};
  
  Object.keys(commonData).forEach((key: string) => {
    const convertedKey = key.replace(/.+:/, '');
    if (
          deleteTagKeys.indexOf(convertedKey) < 0 &&
          convertedKey.indexOf('File') < 0 &&
          convertedKey.indexOf('GPS') < 0 &&
          convertedKey.indexOf('Date') < 0 &&
          convertedKey.indexOf('Version') < 0 &&
          convertedKey.indexOf('Thumbnail') < 0 &&
          convertedKey.indexOf('Duration') < 0 &&
          convertedKey.indexOf('Audio') < 0 &&
          convertedKey.indexOf('Media') < 0 &&
          convertedKey.indexOf('Time') < 0 &&
          convertedKey.indexOf('Rotation') < 0 &&
          convertedKey.indexOf('Text') < 0 &&
          convertedKey.indexOf('Video') < 0 &&
          convertedKey.indexOf('Source') < 0 &&
          convertedKey.indexOf('Track') < 0 &&
          convertedKey.indexOf('Color') < 0 &&
          (convertedKey.indexOf('Image') < 0 || convertedKey.indexOf('CroppedAreaImage') >= 0)
        )
      tags[convertedKey] = commonData[key];

  });

  let starttime: Dayjs;
  if (strStartTime) {
    starttime = dayjs(strStartTime);
  } else if (datalist.length) {
    starttime = dayjs(datalist[0].GPSDateTime);
  } else {
    starttime = dayjs(parseExifDateTime(commonData['Main:CreateDate']));
  }
  const result: IGeoPoint[] = [];
  Async.each(
    Array.from({ length: duration }, (_, index) => index),
    (seconds: number, cb: any) => {
      let previtem = null;
      let nextitem = null;
      const datetime = starttime
        .add(seconds, 'second')
        .format('YYYY-MM-DDTHH:mm:ss');
      for (let i = 0; i < datalist.length - 1; i += 1) {
        const item1 = datalist[i];
        const item2 = datalist[i + 1];
        if (item1.SampleTime <= seconds && item2.SampleTime > seconds) {
          previtem = item1;
          nextitem = item2;
        }
      }
      const filename = `_${seconds + 1}.jpg`;
      let item: IGeoPoint;
      if (previtem && nextitem) {
        const totaldiff = nextitem.SampleTime - previtem.SampleTime;
        const startdiff = seconds - previtem.SampleTime;

        const latitude =
          previtem.MAPLatitude +
          ((nextitem.MAPLatitude - previtem.MAPLatitude) * startdiff) /
            totaldiff;
        const longitude =
          previtem.MAPLongitude +
          ((nextitem.MAPLongitude - previtem.MAPLongitude) * startdiff) /
            totaldiff;

        const altitude =
          previtem.MAPAltitude +
          ((nextitem.MAPAltitude - previtem.MAPAltitude) * startdiff) /
            totaldiff;

        item = new IGeoPoint({
          GPSDateTime: datetime,
          DateTimeOriginal: datetime,
          MAPLatitude: latitude,
          MAPLongitude: longitude,
          MAPAltitude: altitude,
          Image: filename,
          camera_model: commonData['Main:Model'],
          camera_make: commonData['Main:Make'],
          width: commonData['Main:ImageWidth'],
          height: commonData['Main:ImageHeight'],
          equirectangular:
            commonData['Main:ProjectionType'] === 'equirectangular',
          tags,
        });
      } else if (datalist.length) {
        nextitem = datalist[datalist.length - 1];
        item = new IGeoPoint({
          GPSDateTime: nextitem.GPSDateTime,
          DateTimeOriginal: nextitem.GPSDateTime,
          MAPLatitude: nextitem.MAPLatitude,
          MAPLongitude: nextitem.MAPLongitude,
          MAPAltitude: nextitem.MAPAltitude,
          Image: filename,
          camera_model: commonData['Main:Model'],
          camera_make: commonData['Main:Make'],
          width: commonData['Main:ImageWidth'],
          height: commonData['Main:ImageHeight'],
          equirectangular:
            commonData['Main:ProjectionType'] === 'equirectangular',
          tags,
        });
      } else {
        item = new IGeoPoint({
          Image: filename,
          DateTimeOriginal: datetime,
          equirectangular:
            commonData['Main:ProjectionType'] === 'equirectangular',
        });
      }
      if (corrupted) {
        average(path.join(inputPath, filename), (err: any, color: any) => {
          if (err) return cb(err);
          const [red, green, blue] = color;
          const averageColor = (red + green + blue) / 3;
          if (averageColor < 200 && averageColor > 55) {
            result.push(item);
          }
          cb(null);
        });
      } else {
        result.push(item);
        cb(null);
      }
    },
    (err) => {
      
      if (!err) {
        callback(result, starttime);
      }
    }
  );
}

export async function splitVideos(
  inputPath: string,
  duration: number,
  outputPath: string,
  callback: CallableFunction
) {
  // eslint-disable-next-line new-cap
  try {
    const process = new ffmpeg(inputPath);
    process.then((video: { fnExtractFrameToJPG: (arg0: string, arg1: { number: number; file_name: string; }, arg2: (err: any, files: string[]) => void) => void; }) => {
        video.fnExtractFrameToJPG(
          outputPath,
          {
            frame_rate: 1, 
            number: Math.ceil(duration) + 1,
            file_name: '',
          },
          (err: any, files: string[]) => {
            if (!err) {
              callback(null, files);
            } else {
              console.log('fnExtractFrameToJPG_1:  ', err);
              callback(null, files);
              //callback(err);
            }
          }
        );
      },
      (err: any) => {
        console.log('fnExtractFrameToJPG_2:  ', err);
        callback(err);
      }
    );
  } catch (e) {
    console.log('fnExtractFrameToJPG_3:  ', e);
    callback(e);
  }
}

export function splitVideoToImage(
  win: BrowserWindow | null,
  tags: any,
  videoPath: string,
  outputPath: string,
  corrupted: boolean
) {
  const { dataList, commonData } = getGPSVideoData(tags);
  // Math.floor(commonData['Main:Duration']
  const duration = Math.floor(commonData['Main:Duration']) ? Math.floor(commonData['Main:Duration']) : Math.floor(commonData['Main:MediaDuration']);
  
  if (dataList) {
    Async.waterfall(
      [
        (cb: CallableFunction) => {
          const videopath = path.join(os.tmpdir(), `${uuidv4()}.mp4`);
          console.log('videoPath:  ', videoPath);
          console.log('videopath:  ', videopath);
          cb(null, videoPath);
          // fs.copyFile(videoPath, videopath, () => cb(null, videopath));
        },
        (videopath: string, cb: CallableFunction) => {
          console.log('splitvideos');
          splitVideos(
            videopath,
            duration,
            outputPath,
            (err: any, filenames: string[]) => {
              if (err) {
                cb(err);
              } else {
                cb(null);
              }
            }
          );
        },
        (cb: CallableFunction) => {
          console.log('after_splitvideos');
          /* fs.copyFile(
            videoPath,
            path.join(outputPath, path.basename(videoPath)),
            (err) => {
              console.log('error really is here!!!', err);
              if (err) cb(err);
              else cb(null);
            }
          ); */
          cb(null);
        },
        (cb: CallableFunction) => {
          console.log('writeTags2Image');
          writeTags2Image(
            commonData,
            dataList,
            outputPath,
            corrupted,
            (datalist: IGeoPoint[]) => cb(null, datalist)
          );
        },
      ],
      function (err, datalist: IGeoPoint[]) {
        if (!err) {
          
          calculatePoints(datalist, [], function (error: any, result: any) {
            if (!error) {
              sendPoints(win, result.points);
              sendToClient(win, 'finish');
            } else {
              errorHandler(win, error);
            }
          });
        } else {
          errorHandler(win, err);
        }
      }
    );
  }
}

export function loadVideo(
  videoPath: string,
  outputPath: string,
  callback: CallableFunction
) {
  const exif = new ExifTool({
    taskTimeoutMillis: 1073741824,
    maxProcAgeMillis: 1073741825,
  });
  exif
    .read(videoPath, ['-ee', '-G3', '-s', '-api', 'largefilesupport=1'])
    .then((tags: typeof Tags) => {
      exif.end();

      // eslint-disable-next-line promise/no-nesting
      mkdirp(outputPath)
        .then(() => {
          fs.writeFile(
            path.join(outputPath, 'VIDEO_telemetry.json'),
            JSON.stringify(tags),
            (err: any) => {
              if (err) {
                callback(err);
              } else {
                callback(null, tags);
              }
            }
          );
        })
        .catch((err) => callback(err));
    })
    .catch((err: Error) => {
      exif.end();

      callback(err);
    });
}

export function processVideo(
  win: BrowserWindow | null,
  videoPath: string,
  outputPath: string,
  corrupted: boolean
) {
  loadVideo(videoPath, outputPath, (error: any, tags: typeof Tags) => {
    if (error) {
      errorHandler(win, error);
    } else {
      splitVideoToImage(win, tags, videoPath, outputPath, corrupted);
    }
  });
}
