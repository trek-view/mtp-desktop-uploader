import fs from 'fs';
import Async from 'async';
import path from 'path';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import jimp from 'jimp';
import rimraf from 'rimraf';
import mkdirp from 'mkdirp';
import {spawn} from 'cross-spawn'

import { BrowserWindow } from 'electron';
import { IGeoPoint } from '../types/IGeoPoint';

import {
  Result,
  Photo,
  Descriptions,
  Description,
  Connections,
} from '../types/Result';

import {
  getSequenceImagePath,
  OutputType,
  getSequenceOutputFilePath,
  getSequenceBasePath,
  discardPointsBySeconds,
  parseExifDateTime,
  sendToClient,
} from './utils';

const average = require('image-average-color');

const { Tags, exiftool } = require('exiftool-vendored');

export const copyFiles = (
  files: string[],
  dirPath: string,
  outputpath: string,
  corrupedCheck: boolean,
  next: CallableFunction
) => {
  Async.each(
    files,
    (filename: string, cb: CallableFunction) => {
      fs.copyFile(
        path.join(dirPath, filename),
        path.join(outputpath, filename),
        (err) => {
          if (err) cb(err);
          else cb(null);
        }
      );
    },
    (error: Error | any) => {
      if (!error) next(null, files, outputpath, corrupedCheck);
      else next(error);
    }
  );
};

export function getPoint(
  dirpath: string,
  filename: string,
  corrupedCheck: boolean
) {
  return new Promise((resolve, reject) => {
    const filepath = path.join(dirpath, filename);

    Async.waterfall(
      [
        (cb: CallableFunction) => {
          if (corrupedCheck) {
            average(filepath, (err: any, color: any) => {
              if (err) return cb(err);
              const [red, green, blue] = color;
              const averageColor = (red + green + blue) / 3;
              cb(null, averageColor < 200 && averageColor > 55);
            });
          } else {
            cb(null, true);
          }
        },
        (valid: boolean, cb: CallableFunction) => {
          if (valid) {
            exiftool
              .read(filepath)
              .then((tags: typeof Tags) => {
                let azimuth = tags.PoseHeadingDegrees;
                if (!azimuth) azimuth = tags.GPSImgDirection;

                let pitch = tags.PosePitchDegrees;
                if (!pitch) pitch = tags.CameraElevationAngle;

                const datetime = tags.GPSDateTime
                  ? parseExifDateTime(tags.GPSDateTime)
                  : undefined;

                const itemTags = { ...tags };

                const deleteTagKeys = [
                  'Orientation',
                  'SourceFile',
                  'tz',
                  'tzSource',
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

                Object.keys(tags).forEach((k) => {
                  if (
                    deleteTagKeys.indexOf(k) >= 0 ||
                    k.indexOf('File') >= 0 ||
                    k.indexOf('Date') >= 0 ||
                    k.indexOf('Version') >= 0 ||
                    k.indexOf('Thumbnail') >= 0 ||
                    k.indexOf('Image') >= 0
                  ) {
                    delete itemTags[k];
                  }
                });

                const item = new IGeoPoint({
                  GPSDateTime: datetime,
                  DateTimeOriginal: parseExifDateTime(tags.DateTimeOriginal),
                  MAPLatitude: tags.GPSLatitude,
                  MAPLongitude: tags.GPSLongitude,
                  MAPAltitude: tags.GPSAltitude,
                  Image: filename,
                  Azimuth: azimuth,
                  Pitch: pitch,
                  camera_make: tags.Make,
                  camera_model: tags.Model,
                  equirectangular:
                    (tags.ProjectionType || '') === 'equirectangular',
                  width: tags.ImageWidth,
                  height: tags.ImageHeight,
                  tags: itemTags,
                });

                if (item != undefined) {
                  if (item.MAPLatitude != undefined) {
                    if (item.MAPLatitude > 0) {
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
                  }

                  if (item.MAPLongitude != undefined) {
                    if (item.MAPLongitude > 0) {
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
                  }
                }

                return cb(null, item);
              })
              .catch((err: Error) => {
                return cb(err);
              });
          } else {

            return cb(null, {
              Image: filename,
            });
          }
        },
      ],
      (err, result: any) => {
        if (err) return reject(err);
        return resolve(result);
      }
    );
  });
}

export const getPoints = (
  files: string[],
  outputpath: string,
  corrupedCheck: boolean,
  next: CallableFunction
) => {
  const result: IGeoPoint[] = [];
  const removedfiles: string[] = [];

  Async.each(
    files,
    (filename: string, cb: CallableFunction) => {
      getPoint(outputpath, filename, corrupedCheck)
        // eslint-disable-next-line promise/always-return
        .then((item: any) => {
          if (item.DateTimeOriginal) {
            result.push(item);
          } else {
            removedfiles.push(item.Image);
          }
          return cb(null);
        })
        .catch((err: Error) => {
          console.error('Something terrible happened: ', err);
          cb(err);
        });
    },
    (error: Error | any) => {
      if (!error) {
        next(null, result, removedfiles);
      } else {
        next(error);
      }
    }
  );
};

export const calculatePoints = (
  points: IGeoPoint[],
  removedfiles: string[],
  next: CallableFunction
) => {
  try {

    if (points.filter((p: IGeoPoint) => p.GPSDateTime).length) {
      points.sort((firstItem: IGeoPoint, secondItem: IGeoPoint) => {
        if (secondItem.getDate().isBefore(firstItem.getDate())) return 1;
        if (secondItem.getDate().isAfter(firstItem.getDate())) return -1;
        return 0;
      });
      const existedFarPoint =
        points.filter((item: IGeoPoint, idx) => {
          return (
            idx < points.length - 1 &&
            item.getDate().diff(points[idx + 1].getDate(), 'second') > 120
          );
        }).length > 0;

      if (existedFarPoint) {
        throw new Error('some photos are too far apart by time');
      }
    } else {
      points.sort((firstItem: IGeoPoint, secondItem: IGeoPoint) => {
        if (secondItem.getDateOriginal().isBefore(firstItem.getDateOriginal()))
          return 1;
        if (secondItem.getDateOriginal().isAfter(firstItem.getDateOriginal()))
          return -1;
        return 0;
      });
    }

    if (
      points.length &&
      points.filter(
        (item: IGeoPoint) => !item.MAPLatitude || !item.MAPLongitude
      ).length === 0
    ) {
      const newpoints = discardPointsBySeconds(points, 1);
      next(null, { points: newpoints, removedfiles });
    } else {
      next(null, { points, removedfiles });
    }
  } catch (e) {
    next(e);
  }
};


export function loadImageFiles(
  dirPath: string,
  files: string[],
  outputpath: string,
  corrupedCheck: boolean,
  callback: CallableFunction
) {
  Async.waterfall(
    [
      (cb1: CallableFunction) => {
        fs.exists(outputpath, (existed: boolean) => {
          if (!existed) {
            fs.mkdir(outputpath, {recursive: true}, (err) => {
              if (err) {
                cb1(err);
              } else cb1(null);
            });
          } else {
            cb1(null);
          }
        });
      },
      (cb1: CallableFunction) => {
        const originalpath = path.join(outputpath, 'originals');
        fs.exists(originalpath, (existed: boolean) => {
          if (existed) {
            rimraf(originalpath, (error: any) => {
              if (error) cb1(error);
              else cb1(null);
            });
          } else {
            cb1(null);
          }
        });
      },
      (cb1: CallableFunction) => {
        const originalpath = path.join(outputpath, 'originals');
        fs.mkdir(originalpath, {recursive: true}, (err) => {
          if (err) {
            cb1(err);
          } else cb1(null, files, dirPath, originalpath, corrupedCheck);
        });
      },
      copyFiles,
      getPoints,
      calculatePoints,
    ],
    (err: any, result) => {
      callback(err, result);
    }
  );
}

export function modifyLogo(logourl: string, outputfile: string) {
  return new Promise((resolve,reject)=>{
    const valid_RotateAsync = jimp
      .read(logourl)
      .then((logo:any)=>{
        if (
          logo.bitmap.width < 500 ||
          logo.bitmap.height !== logo.bitmap.width
        ) {
          throw new Error(
            'Allowed filetypes for nadir cap are: jpg, png, tif file only. Must be at least 500px x 500px and square.'
          );
        }
        //magick "n.png" -rotate 180 -strip nadir_patcher_temp_s\temp_result1.png
        return spawn.sync('magick', [`${logourl}`, '-rotate', '180', '-strip',`${outputfile}_temp_1.png`]);
      })
      .catch((err)=>{
        console.log("validateErr:",err)
        reject(err);
      })
    const distort_Async = valid_RotateAsync
    .then((result:any)=>{

      /**
       *
       * magick "nadir_patcher_temp_s\temp_result1.png" -distort DePolar 0  nadir_patcher_temp_s\temp_result2.png

        magick "nadir_patcher_temp_s\temp_result2.png" -flip  nadir_patcher_temp_s\temp_result3.png

        magick "nadir_patcher_temp_s\temp_result3.png" -flop  nadir_patcher_temp_s\temp_result4.png

        ffmpeg -y -i nadir_patcher_temp_s\temp_result4.png -vf scale=4096:245 nadir_patcher_temp_s\temp_result5.png
       */
      return spawn.sync('magick',[`${outputfile}_temp_1.png`, '-distort', 'DePolar','0',`${outputfile}_temp_2.png`])
    })
    .catch((err)=>{
      console.log("spwanError:",err)
      reject(err);
    })
    const flip_Async = distort_Async
    .then((result:any)=>{

      return spawn.sync('magick',[`${outputfile}_temp_2.png`, '-flip',`${outputfile}_temp_3.png`])

    })
    .catch((err)=>{
      console.log("DistortError:",err);
      reject(err);
    })

    const flop_Async = flip_Async
    .then((result:any)=>{
      return spawn.sync('magick',[`${outputfile}_temp_3.png`, '-flop',`${outputfile}`])
    })
    .catch((err)=>{
      reject(err)
    })

    flop_Async
    .then((result:any)=>{
      return resolve();
    })
    .catch((err)=>{
      reject(err)
    })
  })


}

export async function addLogo(
  imageurl: string,
  logo: any,
  x: number,
  y: number
) {
  console.log('logoStart:',Date.now())
  const image = await jimp.read(imageurl);
  console.log('logoRead:',Date.now())

  const blendmode: any = {
    mode: jimp.BLEND_SOURCE_OVER,
    opacitySource: 1,
    opacityDest: 1,
  };

  return image.composite(logo, x, y, blendmode);
}

export function writeExifTags(
  input_file: string,
  item: IGeoPoint,
  description: Photo,
  outputfile: any = false
) {
  return new Promise((resolve, reject) => {
    const datetime = dayjs(item.GPSDateTime);

    Async.waterfall(
      [
        (cb: CallableFunction) => {
          if (outputfile) {
            try {
              mkdirp(path.dirname(outputfile))
                // eslint-disable-next-line consistent-return
                // eslint-disable-next-line promise/always-return
                .then(() => {
                  // eslint-disable-next-line promise/always-return
                  fs.copyFile(input_file, outputfile, (err2: any) => {
                    if (err2) return cb(err2);
                    return cb(null, outputfile);
                  });
                })
                .catch((err: any) => {
                  cb(err);
                });
            } catch (e) {
              cb(e);
            }
          } else {
            cb(null, input_file);
          }
        },
        (inputFile: string, cb: CallableFunction) => {
          const options: string[] = ['-overwrite_original'];

          const azimuth =
            (item.Azimuth || 0) > 0 ? item.Azimuth : 360 + item.Azimuth;

          let tags = item.tags || {};

          tags = {
            ...tags,
            AllDates: datetime.format('YYYY-MM-DDTHH:mm:ss'),
            GPSTimeStamp: datetime.format('HH:mm:ss'),
            GPSDateStamp: datetime.format('YYYY-MM-DD'),
            GPSLatitude: item.MAPLatitude,
            GPSLongitude: item.MAPLongitude,
            GPSAltitude: item.MAPAltitude,
            PoseHeadingDegrees: azimuth,
            GPSImgDirection: azimuth,
            CameraElevationAngle: item.Pitch,
            PosePitchDegrees: item.Pitch,
            ImageDescription: JSON.stringify({
              ...description,
              GPSDateTime: undefined,
            }),
          };

          if (item != undefined) {
            if (item.MAPLatitude != undefined) {
              if (item.MAPLatitude > 0) {
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
            }

            if (item.MAPLongitude != undefined) {
              if (item.MAPLongitude > 0) {
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
            }
          }

          exiftool
            .write(inputFile, tags, options)
            .then(() => cb())
            .catch((error: any) => {
              cb();
            });
        },
      ],
      (err) => {
        if (err) return reject(err);
        return resolve(err);
      }
    );
  });
}

export function writeNadirImages(
  item: IGeoPoint,
  settings: any,
  originalSequenceName: string,
  description: Description,
  basepath: string,
  logo: any,
  newlogofile: string,
  logoOverlayPosition:number
) {
  return new Promise((resolve, reject) => {
    if (settings.nadirPath !== '' && logo) {
      const filename = item.Image || '';
      const existingfile = getSequenceImagePath(
        originalSequenceName,
        filename,
        basepath
      );
      const outputfile = getSequenceOutputFilePath(
        settings.name,
        settings.name.split(' ').join('_') + "_" + filename,
        OutputType.nadir,
        basepath
      );


      const addLogoAsync = sPromise()
        .then(()=>{
          console.log("ImageSaving:",outputfile);
          console.log("ImageSaving_ExistingFile:",existingfile);

          return spawn.sync('magick',[`${existingfile}`,`${newlogofile}`,'-geometry',`+0+${logoOverlayPosition}`,'-composite',`${outputfile}`]);
        })
        .catch((err) => {
          console.log('saveError:',err)
          return reject();
        });

      const writeExifAsync = addLogoAsync
        .then((result) =>{
          console.log("ImageSaved",result.output[1].toString("utf8"));
          console.log("ImageSaved",result.output[2].toString("utf8"));


          writeExifTags(outputfile, item, {
            ...description.photo,
            MTPImageCopy: 'final_nadir',
          })
        })
        .catch((err) => {
          return reject();
        });
      writeExifAsync
        .then(() => resolve())
        .catch((err) => {
          reject(err);
        });
    } else {
      return resolve();
    }
  });
}

export function updateImages(
  win: BrowserWindow,
  updatedPoints: IGeoPoint[],
  settings: any,
  originalSequenceName: string,
  logo: any,
  basepath: string,
  newlogofile: string,
  logoOverlayPosition: number
): Promise<Result> {
  return new Promise((resolve, reject) => {
    const sequenceId = uuidv4();

    const totaldistance = updatedPoints.reduce(
      (res: number, item: IGeoPoint) => {
        // eslint-disable-next-line no-param-reassign
        res += item.Distance || 0;
        return res;
      },
      0
    );

    if (updatedPoints.length === 0) {
      // eslint-disable-next-line prefer-promise-reject-errors
      return reject(new Error('There are not images after calculating'));
    }

    const durationsec = updatedPoints[updatedPoints.length - 1]
      .getDate()
      .diff(updatedPoints[0].getDate(), 'second');

    const resultjson: Result = {
      sequence: {
        id: sequenceId,
        distance_km: totaldistance / 1000,
        earliest_time: updatedPoints[0].GPSDateTime,
        latest_time: updatedPoints[updatedPoints.length - 1].GPSDateTime,
        durationsec,
        average_speed_kmh: durationsec
          ? (totaldistance * 3600) / durationsec
          : 0,
        uploader_sequence_name: settings.name,
        uploader_sequence_description: settings.description,
        uploader_transport_type: settings.type,
        uploader_transport_method: settings.method,
        uploader_tags: settings.tags,
        created: dayjs().format('YYYY-MM-DDTHH:mm:ss'),
        uploader_camera: settings.camera,
        destination: {},
      },
      photo: {},
    };

    const descriptions: Descriptions = {};

    updatedPoints.forEach((p: IGeoPoint, idx: number) => {
      const connections: Connections = {};
      if (idx !== 0) {
        const prevItem = updatedPoints[idx - 1];
        const deltatime = p.getDate().diff(prevItem.getDate(), 'second');
        const distance = p.Distance || 0;
        connections[prevItem.id] = {
          distance_mtrs: distance,
          heading_deg: prevItem.Azimuth || 0,
          pitch_deg: prevItem.Pitch || 0,
          adj_heading_deg: (p.Azimuth - prevItem.Azimuth + 360) % 360,
          time_sec: deltatime,
          speed_kmh:
            deltatime !== 0 ? (distance * 3600) / (deltatime * 1000) : 0,
        };
      }
      if (idx < updatedPoints.length - 1) {
        const nextItem = updatedPoints[idx + 1];
        const deltatime = p.getDate().diff(nextItem.getDate(), 'second');
        const distance = p.Distance || 0;
        connections[nextItem.id] = {
          distance_mtrs: distance,
          heading_deg: p.Azimuth || 0,
          adj_heading_deg: (nextItem.Azimuth - p.Azimuth + 360) % 360,
          pitch_deg: p.Pitch || 0,
          time_sec: deltatime,
          speed_kmh:
            deltatime !== 0 ? (distance * 3600) / (deltatime * 1000) : 0,
        };
      }
      const photodict: Photo = {
        MTPUploaderSequenceUUID: sequenceId,
        MTPUploaderPhotoUUID: p.id,
        MAPAltitude: p.MAPAltitude,
        MAPLatitude: p.MAPLatitude,
        MAPLongitude: p.MAPLongitude,

        GPSDateTime: p.GPSDateTime,

        MAPCaptureTime: p.getDate().format('YYYY_MM_DD_HH_mm_ss_SSS'),
        MTPSequenceName: settings.name,
        MTPSequenceDescription: settings.description,
        MTPSequenceTransport: `${settings.type}-${settings.method}`,
        MTPSequenceTags: settings.tags,
        MTPImageCopy: 'final_raw',
        MTPImageProjection: p.equirectangular ? 'equirectangular' : 'flat',
        connections,
      };

      resultjson.photo[p.id] = {
        original: {
          filename: p.Image,
          GPSDateTime: p.tags.GPSDateTime,
          originalDateTime: p.tags.DateTimeOriginal,
          altitude: p.tags.GPSAltitude,
          latitude: p.tags.GPSLatitude,
          longitude: p.tags.GPSLongitude,
          gps_direction_ref: p.tags.GPSImgDirectionRef || '',
          heading: p.tags.PoseHeadingDegrees || p.tags.GPSImgDirection,
          pitch: p.tags.PosePitchDegrees || p.tags.GPSPitch,
          roll: p.tags.PosePoseRollDegrees || p.tags.GPSRoll || '',
          camera_make: p.camera_make,
          camera_model: p.camera_model,
          projection: p.equirectangular ? 'equirectangular' : 'flat',
        },
        modified: {
          filename: p.Image,
          GPSDateTime: p.GPSDateTime,
          originalDateTime: p.DateTimeOriginal,
          altitude: p.MAPAltitude,
          latitude: p.MAPLatitude,
          longitude: p.MAPLongitude,
          gps_direction_ref: p.tags.GPSImgDirectionRef || '',
          heading: p.Azimuth,
          pitch: p.Pitch,
          roll: p.tags.PosePoseRollDegrees || p.tags.GPSRoll || '',
          camera_make: p.camera_make,
          camera_model: p.camera_model,
          projection: p.equirectangular ? 'equirectangular' : 'flat',
        },
        connections,
      };

      descriptions[p.id] = {
        photo: {
          ...photodict,
          connections: undefined,
        },
        sequence: resultjson.sequence,
      };
    });

    let beautifiedName = settings.name.split('_').join(' ');
    beautifiedName = beautifiedName.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

    if (settings.nadirPath !== '' && newlogofile !== '') {
      const outputNadirSeqPath = path.join(getSequenceBasePath(settings.name, basepath), 'final_nadir');

      fs.access(outputNadirSeqPath, (error)=>{
        if(error){
          fs.mkdir(outputNadirSeqPath, {recursive: true}, (err) => {
            if (err) {
              console.log(err);
            }
            console.log("NadirFileMade");
          });
        }
      })
    }


    Async.eachOfLimit(
      updatedPoints,
      1,
      (item: IGeoPoint, key: any, next: CallableFunction) => {
        sendToClient(
          win,
          'loaded_message',
          `[${beautifiedName}] Updating file: ${item.Image}`
        );

        const desc: Description = descriptions[item.id];
        Async.parallel(
          [
            (cb: CallableFunction) => {

              const filename = item.Image || '';

              const inputfile = getSequenceImagePath(
                originalSequenceName,
                filename,
                basepath
              );


              if (settings.name != originalSequenceName) {
                const outputOriginalFile = getSequenceImagePath(
                  settings.name,
                  settings.name.split(' ').join('_') + "_" + filename,
                  basepath
                );
                const outputOriginalSeqPath = path.join(getSequenceBasePath(settings.name, basepath), 'originals');

                fs.exists(outputOriginalSeqPath, (existed: boolean) => {
                  if (!existed) {
                    fs.mkdir(outputOriginalSeqPath, {recursive: true}, (err) => {
                      if (err) {
                        console.log(err);
                      }
                    });
                  }
                });

                fs.copyFile(inputfile, outputOriginalFile, (err: any) => {
                  if (err) console.log(err);
                });
              }

              const outputfile = getSequenceOutputFilePath(
                settings.name,
                settings.name.split(' ').join('_') + "_" + filename,
                OutputType.raw,
                basepath
              );

              if (settings.nadirPath !== '' && newlogofile !== '') {
                console.log('currentSequence:',originalSequenceName)
                writeNadirImages(item, settings, originalSequenceName, desc, basepath, logo,newlogofile,logoOverlayPosition)
                .then(() => cb())
                .catch((err) => cb(err));
              }
              else{
                writeExifTags(inputfile, item, desc.photo, outputfile)
                .then(() => cb())
                .catch((err) => cb(err));
              }
            },
          ],
          (err) => {
            if (err) {
              next(err);
            } else {
              sendToClient(
                win,
                'loaded_message',
                `[${beautifiedName}] Updating file: ${item.Image}`
              );
              next();
            }
          }
        );
      },
      (err: any) => {
        if (err) {
          return typeof err === 'string'
            ? reject(new Error(err))
            : reject(new Error(err.message));
        }
        return resolve(resultjson);
      }
    );
  });
}
function sPromise(){
  return new Promise((resolve,reject)=>{
    setTimeout(()=>{
      return resolve();
    },1)
  })
}
