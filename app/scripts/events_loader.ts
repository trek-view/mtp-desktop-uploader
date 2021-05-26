import fs from 'fs';
import rimraf from 'rimraf';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import jimp from 'jimp';
import Async from 'async';
import url from 'url';
import axios from 'axios';
import FormData from 'form-data';
import {spawn} from 'cross-spawn'

import { App, ipcMain, BrowserWindow, IpcMainEvent, dialog } from 'electron';

import { processVideo } from './video';

import { Result, Summary } from '../types/Result';
import { IGeoPoint } from '../types/IGeoPoint';

import { checkIntegrationStatus } from './integrations/mtpw';
import integrateSequence, { loadIntegrations } from './integrations';

import { updateImages, addLogo, modifyLogo, loadImageFiles } from './image';
import tokenStore from './tokens';

import {
  sendToClient,
  sendPoints,
  createdData2List,
  resultdirectorypath,
  getSequenceLogPath,
  getSequenceGpxPath,
  getSequenceBasePath,
  getOriginalBasePath,
  errorHandler,
  uploadErrorHandler,
  resetSequence,
  removeTempFiles,
  getSequenceOutputPath,
  OutputType,
  getSequenceImagePath,
} from './utils';

import axiosErrorHandler from './utils/axios';

import { readGPX } from './utils/gpx';

import loadCameras from './camera';

import loadDefaultNadir from './nadir';

export default (mainWindow: BrowserWindow, app: App) => {
  let basepath = app.getPath('home');
  const mtpPath = path.join(basepath, 'MTP');
  if (!fs.existsSync(mtpPath)) {
    fs.mkdirSync(mtpPath, { recursive: true });
  }
  basepath = path.resolve(basepath, 'MTP', 'app');
  // const basepath = app.getAppPath();

  ipcMain.on('set_token', (_event: IpcMainEvent, key: string, token: any) => {
    tokenStore.set(key, token);
  });

  ipcMain.once('load_config', async (_event: IpcMainEvent) => {
    const [cameras, nadirs, integrations] = await Promise.all([
      loadCameras(app),
      loadDefaultNadir(app),
      loadIntegrations(app),
    ]);

    const tokens = tokenStore.getAll();
    console.log('tokens: ', tokens);

    sendToClient(mainWindow, 'loaded_config', {
      cameras,
      nadirs,
      integrations,
      basepath,
      tokens,
    });
  });

  ipcMain.on(
    'load_video',
    async (
      _event: IpcMainEvent,
      videoPath: string,
      seqname: string,
      corrupted: boolean
    ) => {
      if (!fs.existsSync(resultdirectorypath(app))) {
        fs.mkdirSync(resultdirectorypath(app), { recursive: true });
      }
      const sequencebasepath = getSequenceBasePath(seqname, basepath);
      if (fs.existsSync(sequencebasepath)) {
        await rimraf.sync(sequencebasepath);
      }
      fs.mkdirSync(sequencebasepath, { recursive: true });

      let outputPath = getOriginalBasePath(seqname, basepath);
      //outputPath = outputPath.replace(/ /g, '%20');

      processVideo(
        mainWindow,
        videoPath,
        outputPath,
        corrupted
      );
    }
  );

  ipcMain.on(
    'load_images',
    async (
      _event: IpcMainEvent,
      dirPath: string,
      seqname: string,
      corrupedCheck: boolean
    ) => {
      if (!fs.existsSync(resultdirectorypath(app))) {
        try {
          fs.mkdirSync(resultdirectorypath(app), { recursive: true });
        } catch (e) {
          errorHandler(mainWindow, e);
          return;
        }
      }

      let fileNames = fs
        .readdirSync(dirPath, { withFileTypes: true })
        .filter(dirent => dirent.isFile())
        .map(dirent => dirent.name);

      fileNames = fileNames.filter((file: string) => {
        return file.toLowerCase().endsWith('.png') ||
          file.toLowerCase().endsWith('.jpeg') ||
          file.toLowerCase().endsWith('.jpg')
      });

      const imageLength = fileNames.length;

      if (imageLength == 0) {
        errorHandler(mainWindow, 'No images exist in the specified folder.');
        return;
      }

      if (
        imageLength == 1
      ) {
        errorHandler(
          mainWindow,
          'More than one image is required to create a sequence.'
        );
        return;
      }

      loadImageFiles(
        dirPath,
        fileNames,
        getSequenceBasePath(seqname, basepath),
        corrupedCheck,
        (error: any, result: any) => {
          if (error) {
            errorHandler(mainWindow, error);
          } else {
            const { points, removedfiles } = result;
            sendPoints(mainWindow, points);

            if (removedfiles.length) {
              sendToClient(mainWindow, 'removed_files', removedfiles);
            }
            if (points.length) sendToClient(mainWindow, 'finish');
          }
        }
      );
    }
  );

  ipcMain.on(
    'load_image_files',
    async (
      _event: IpcMainEvent,
      dirPath: string,
      files: string[],
      seqname: string,
      corrupedCheck: boolean
    ) => {
      if (!fs.existsSync(resultdirectorypath(app))) {
        try {
          fs.mkdirSync(resultdirectorypath(app), { recursive: true });
        } catch (e) {
          errorHandler(mainWindow, e);
          return;
        }
      }

      if (files.length == 0) {
        errorHandler(mainWindow, 'No image files selected.');
        return;
      }

      if (files.length === 1) {
        errorHandler(mainWindow, 'More than one image is required to create a sequence.');
        return;
      }

      loadImageFiles(
        dirPath,
        files,
        getSequenceBasePath(seqname, basepath),
        corrupedCheck,
        (error: any, result: any) => {
          if (error) {
            errorHandler(mainWindow, error);
          } else {
            const { points, removedfiles } = result;
            sendPoints(mainWindow, points);

            if (removedfiles.length) {
              sendToClient(mainWindow, 'removed_files', removedfiles);
            }
            if (points.length) sendToClient(mainWindow, 'finish');
          }
        }
      );
    }
  );

  ipcMain.on('load_gpx', (_event: IpcMainEvent, gpxpath: string) => {
    readGPX(gpxpath, (err: any, points: any) => {
      if (!err) {
        sendToClient(mainWindow, 'loaded_gpx', points);
      } else {
        errorHandler(mainWindow, err);
      }
    });
  });

  ipcMain.on(
    'upload_nadir',
    (_event: IpcMainEvent, { nadirpath, imagepath, width, height }) => {
      const results: {
        [key: string]: any;
      } = {};
      const templogofile = path.resolve(basepath, `../${uuidv4()}.png`);
      const tempOutPut4 = path.resolve(basepath, `../${uuidv4()}output4.png`)
      const tempOutPut5 = path.resolve(basepath, `../${uuidv4()}output5.png`)

      //ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv="s=x:p=0" s.jpg
      const getResoultion_Async = modifyLogo(nadirpath, tempOutPut4)
            .then(()=>{
              return spawn.sync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','csv=s=x:p=0',`${imagepath}`])
            })
            .catch((err)=> {
              console.log("probeError");
              errorHandler(mainWindow,err)
            });
      getResoultion_Async
      .then((result:any)=>{

        //console.log("da:",da)
        let resultoutput = result.output[1].toString('utf8');
        let res = resultoutput.split('x');

        let width = parseInt(res[0]);
        let height = parseInt(res[1]);


        return Async.eachOfLimit(
          //Array(16),
          Array(9),
          1,
          (_item: unknown, key: any, cb: CallableFunction) => {
            const outputfile = path.resolve(basepath, `../${uuidv4()}.png`);
            let percent = (12 + key) / 100;
            let overlay_scale = Math.ceil(height * percent - 0.5);
            let overlay_position = height - overlay_scale;
            //"ffmpeg -y -i {} -vf scale={} {}".format(temp_output4,overlay_scale,temp_output5)
            const over_scale_spawn = sPromise()
            .then(()=>{
              return spawn.sync('ffmpeg',['-y','-i',`${tempOutPut4}`,'-vf',`scale=${width}:${overlay_scale}`,`${tempOutPut5}`]);
            })
            let magickOut = over_scale_spawn
            .then((overlayerr:any)=>{
              return spawn.sync('magick',[`${imagepath}`,`${tempOutPut5}`,'-geometry',`+0+${overlay_position}`,'-composite',`${outputfile}`]);
            })
            magickOut
            .then((magicerr:any)=>{
              results[percent.toString()] = outputfile;
                return cb();
            })


          },
          (err) => {
            if (err) {
              errorHandler(mainWindow, err);
            } else {
              sendToClient(mainWindow, 'loaded_preview_nadir', {
                logofile: tempOutPut4,
                items: results,
              });
            }
          }
        );
      })
      .catch((err)=>errorHandler(mainWindow, err))

    }
  );

  ipcMain.on('update_images', async (_event: IpcMainEvent, sequence: any, originalSequenceName: string) => {

    // eslint-disable-next-line global-require
    const { buildGPX, GarminBuilder } = require('gpx-builder');
    const { Point } = GarminBuilder.MODELS;
    const settings = sequence.steps;

    const { logofile, percentage } = sequence.steps.previewnadir;
    let newlogofile = logofile;
    let logoOverlayPosition = -1;


    if(logofile !== '')
    {
     // console.log("point:",sequence.points[0])
      let extension = logofile.split(".");

      newlogofile = `${logofile}_new.${extension[extension.length-1]}`;
      console.log("logofile:",logofile)
      console.log("extension:",extension)
      console.log("newlogofile:",newlogofile)

      const originalOnefile = getSequenceImagePath(
        originalSequenceName,
        sequence.points[0].Image,
        basepath
      );
      console.log(sPromise)
      const getResoultion_Async = sPromise()
        .then(()=>{
          return spawn.sync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','csv=s=x:p=0',`${originalOnefile}`])
        })
        .catch((err)=>{
          console.log("probeError");
        });
      const getLogo_Async = getResoultion_Async
        .then((result:any)=>{
          console.log("ffprobeReslt:",result.output[1].toString("utf8"))
          console.log("ffprobeReslt:",result.output[2].toString("utf8"))

          let resultoutput = result.output[1].toString('utf8');
          let res = resultoutput.split('x');
          let width = parseInt(res[0]);
          let height = parseInt(res[1]);

          let overlay_scale = Math.ceil(height * percentage - 0.5);
          logoOverlayPosition = height - overlay_scale;
          return spawn.sync('ffmpeg',['-y','-i',`${logofile}`,'-vf',`scale=${width}:${overlay_scale}`,`${newlogofile}`]);
        })
      getLogo_Async
      .then((result)=>{
        console.log("getLogo_Async:",result.output[1].toString("utf8"))
        console.log("getLogo_Async:",result.output[2].toString("utf8"))
      })
    }

    const logo = logofile !== '' ? await jimp.read(logofile) : null;

    if (logofile !== '' && logo) {
      logo.resize(
        sequence.points[0].width,
        sequence.points[0].height * percentage
      );
    }

    const points = sequence.points
      .filter(
        (p) =>
          typeof p.MAPAltitude !== 'undefined' &&
          typeof p.MAPLatitude !== 'undefined' &&
          typeof p.MAPLongitude !== 'undefined'
      )
      .map((p) => {
        const newP = new IGeoPoint({
          ...p,
          tags: {
            ...p.tags,
            artist: settings.copyright.artist,
            copyright: settings.copyright.copyright,
            UserComment: settings.copyright.comment,
          },
        });
        return newP;
      });

    const resultjson: Result = await updateImages(
      mainWindow,
      points,
      settings,
      originalSequenceName,
      logo,
      basepath,
      newlogofile,
      logoOverlayPosition
    );
    let outputType = OutputType.raw;
    if (settings.nadirPath !== '') {
      outputType = OutputType.nadir;
    }

    const baseDirectory = getSequenceOutputPath(
      settings.name,
      outputType,
      basepath
    );

    const gpxData = new GarminBuilder();

    const gpxPoints = points.map((p: IGeoPoint) => {
      return new Point(p.MAPLatitude, p.MAPLongitude, {
        ele: p.MAPAltitude,
        time: dayjs(p.GPSDateTime).toDate(),
      });
    });

    gpxData.setSegmentPoints(gpxPoints);

    fs.writeFileSync(
      getSequenceGpxPath(settings.name, basepath),
      buildGPX(gpxData.toObject())
    );

    console.log('settings.googlePlace: ', settings.googlePlace);

    const { result, error } = await integrateSequence(
      mainWindow,
      settings.destination,
      resultjson,
      points,
      baseDirectory,
      basepath,
      'loaded_message',
      settings.googlePlace
    );
    fs.writeFileSync(
      getSequenceLogPath(settings.name, basepath),
      JSON.stringify(result)
    );

    if (result) {
       await removeTempFiles(app);
      uploadErrorHandler(mainWindow, null, null, [], '');
      return sendToClient(mainWindow, 'add-seq', createdData2List(result), originalSequenceName, basepath);
    }
    if (error) {
      return uploadErrorHandler(mainWindow, error, resultjson, points, baseDirectory);
    }
  });

  ipcMain.on('resume_images', async (_event: IpcMainEvent, sequence: any, resultjson: any, points: IGeoPoint[], baseDirectory: string, originalSequenceName: string) => {

    // eslint-disable-next-line global-require
    const settings = sequence.steps;

    const { result, error } = await integrateSequence(
      mainWindow,
      settings.destination,
      resultjson,
      points,
      baseDirectory,
      basepath,
      'loaded_message',
      settings.googlePlace
    );
    fs.writeFileSync(
      getSequenceLogPath(settings.name, basepath),
      JSON.stringify(result)
    );

    if (result) {
      await removeTempFiles(app);
      uploadErrorHandler(mainWindow, null, null, [], '');
      return sendToClient(mainWindow, 'add-seq', createdData2List(result), originalSequenceName, basepath);
    }
    if (error) {
      return uploadErrorHandler(mainWindow, error, resultjson, points, baseDirectory);
    }
  });

  ipcMain.on(
    'sequences',
    async (_event: IpcMainEvent) => {

      if (!fs.existsSync(resultdirectorypath(app))) {
        fs.mkdirSync(resultdirectorypath(app), { recursive: true });
      }
      const sequencesDirectories = fs
        .readdirSync(resultdirectorypath(app))
        .filter(
          (name) =>
            fs.lstatSync(getSequenceBasePath(name, basepath)).isDirectory() &&
            fs.existsSync(getSequenceLogPath(name, basepath))
        );

      fs.readdirSync(resultdirectorypath(app))
        .filter(
          (name) =>
            fs.lstatSync(getSequenceBasePath(name, basepath)).isDirectory() &&
            !fs.existsSync(getSequenceLogPath(name, basepath))
        )
        .forEach((d: string) => {
          rimraf.sync(getSequenceBasePath(d, basepath));
        });

      const sequences: Result[] = await Promise.all(
        sequencesDirectories.map(async (name: string) => {
          return JSON.parse(
            fs.readFileSync(getSequenceLogPath(name, basepath)).toString()
          );
        })
      );

      const summaries: Summary[] = await Promise.all(
        sequences.map(async (s: Result) => {
          const summary = await checkIntegrationStatus(s, basepath);
          return summary;
        })
      );

      summaries.sort((a: any, b: any) => {
        return dayjs(a.created).isBefore(dayjs(b.created)) ? 1 : -1;
      });
      sendToClient(mainWindow, 'loaded_sequences', summaries);
    });

  ipcMain.on(
    'check_sequences',
    async (_event: IpcMainEvent, names: string[]) => {
      const sequences: Result[] = await Promise.all(
        names.map(async (name: string) => {
          return JSON.parse(
            fs.readFileSync(getSequenceLogPath(name, basepath)).toString()
          );
        })
      );

      const summaries: Summary[] = await Promise.all(
        sequences.map(async (s: Result) => {
          const summary = await checkIntegrationStatus(s, basepath);
          return summary;
        })
      );

      const result: {
        [key: string]: Summary;
      } = summaries.reduce((obj: any, s: Summary) => {
        obj[s.id] = s;
        return obj;
      }, {});

      sendToClient(mainWindow, 'updated_sequences', result);
    }
  );

  ipcMain.on('remove_sequence', async (_event: IpcMainEvent, name: string) => {
    if (fs.existsSync(getSequenceBasePath(name, basepath))) {
      rimraf.sync(getSequenceBasePath(name, basepath));
      // fs.unlinkSync(getSequenceBasePath(name, basepath));
    }
  });

  ipcMain.on('reset_sequence', async (_event, sequence) => {
    await resetSequence(sequence, app);
    await removeTempFiles(app);
  });

  ipcMain.on('closed_app', async (_event, sequence) => {
    if (sequence) {
      await resetSequence(sequence, app);
    }
    await removeTempFiles(app);
    mainWindow?.destroy();
    // if (process.platform !== 'darwin') {
    app.quit();
    // }
  });

  ipcMain.on(
    'update_integration',
    async (
      _event,
      sequence: Summary,
      integrations: { [key: string]: boolean },
      googlePlace?: string
    ) => {
      const { name, points } = sequence;

      const resultjson: Result = JSON.parse(
        fs.readFileSync(getSequenceLogPath(name, basepath)).toString()
      );

      let directoryPath = getSequenceOutputPath(name, OutputType.raw, basepath);

      const nadirPath = getSequenceOutputPath(name, OutputType.nadir, basepath);

      if (fs.existsSync(nadirPath)) {
        directoryPath = nadirPath;
      }

      console.log('googlePlace: ', googlePlace);

      const { result, error } = await integrateSequence(
        mainWindow,
        integrations,
        resultjson,
        points,
        directoryPath,
        basepath,
        'update_loaded_message',
        googlePlace
      );

      if (result) {
        fs.writeFileSync(
          getSequenceLogPath(name, basepath),
          JSON.stringify(result)
        );
        return sendToClient(
          mainWindow,
          'update_sequence_finish',
          createdData2List(result)
        );
      }
      if (!error) {
        return errorHandler(mainWindow, 'ERROR', 'update_error');
      }
      return errorHandler(mainWindow, error, 'update_error');
    }
  );
};

export const sendToken = async (
  mainWindow: BrowserWindow,
  key: string,
  tokenObj: any,
  basepath = null
) => {
  let token = tokenStore.get(key);
  if (!token || (token && !token.token)) {
    token = {
      waiting: true,
      token: null,
    };
  }
  if (token.waiting) {
    tokenStore.set(key, {
      ...token,
      waiting: false,
      token: {
        ...tokenObj,
      },
    });
    if (basepath) {
      fs.writeFileSync(
        path.join(basepath, 'tokens.json'),
        JSON.stringify(tokenStore.getAll())
      );
    }

    sendToClient(mainWindow, 'loaded_token', key, tokenObj);
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
};

export const sendTokenFromUrl = async (
  mainWindow: BrowserWindow,
  protocolLink: string,
  basepath = null
) => {
  const urlObj = url.parse(protocolLink.replace('#', '?'), true);
  let key = urlObj.hostname || 'mtp';

  let token;

  if (['google', 'strava', 'mapillary'].indexOf(key) < 0) {
    key = 'mtp';
  }

  if (key === 'google') {
    const { code } = urlObj.query;
    if (code) {
      const data = new FormData();
      data.append('client_id', process.env.GOOGLE_CLIENT_ID);
      data.append('client_secret', process.env.GOOGLE_CLIENT_SECRET);
      data.append('code', code);
      data.append('grant_type', 'authorization_code');
      data.append(
        'redirect_uri',
        `${process.env.MTP_WEB_URL}/accounts/check-mtpu-google-oauth`
      );
      data.append('access_type', 'offline')
      data.append('prompt', 'consent');

      try {
        const tokenData = await axios({
          method: 'post',
          headers: {
            ...data.getHeaders(),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          url: 'https://oauth2.googleapis.com/token',
          data,
        });
        token = tokenData.data;
      } catch (error) {
        errorHandler(mainWindow, axiosErrorHandler(error, 'Google'));
      }
    }
  } else if (key === 'strava') {
    const { code } = urlObj.query;
    if (code) {
      const data = new FormData();
      data.append('client_id', process.env.STRAVA_CLIENT_ID);
      data.append('client_secret', process.env.STRAVA_CLIENT_SECRET);
      data.append('code', code);
      data.append('grant_type', 'authorization_code');

      try {
        const tokenData = await axios({
          method: 'post',
          headers: {
            ...data.getHeaders(),
          },
          url: 'https://www.strava.com/api/v3/oauth/token',
          data,
        });
        token = tokenData.data;
      } catch (error) {
        errorHandler(mainWindow, axiosErrorHandler(error, 'Strava'));
      }
    }
  } else {
    token = urlObj.query;
  }

  if (key && token && token.error) {
    dialog.showMessageBoxSync(mainWindow, {
      title: `MTP ${key}`,
      message: token.error,
    });
    errorHandler(mainWindow, token.error);
  }

  if (key && token && token.access_token) {
    sendToken(mainWindow, key, token, basepath);
  }
};
function sPromise(){
  return new Promise((resolve,reject)=>{
    setTimeout(()=>{
      return resolve();
    },1)
  })
}
