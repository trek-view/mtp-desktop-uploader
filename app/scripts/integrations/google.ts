import axios from 'axios';

import path from 'path';
import fs from 'fs';
import os from 'os';
import { BrowserWindow } from 'electron';
import dayjs from 'dayjs';
import Async from 'async';
import tokenStore from '../tokens';
import { IGeoPoint } from '../../types/IGeoPoint';
import { GooglePhotoRes } from '../../types/Result';
import { sendToClient, getLogFilePath } from '../utils';

const electron = require('electron');

axios.interceptors.response.use(
  (res) => res,
  (err) => {
    throw err;
  }
);

export const uploadImage = async (
  mainWindow: BrowserWindow,
  token: string,
  item: IGeoPoint,
  baseDirectory: string,
  messageChannelName: string,
  adAzimuth: number,
  googlePlace?: string
) => {
  let p;
  if (process.platform === 'win32')
    p = baseDirectory.split('\\');
  else
    p = baseDirectory.split('/');
  const sn = p[p.length - 2];
  let beautifiedName = sn.split('_').join(' ');
  beautifiedName = beautifiedName.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  sendToClient(
    mainWindow,
    messageChannelName,
    `[${beautifiedName}] ${item.Image} is uploading to Google Street View`
  );

  const urlres = await axios({
    url: `https://streetviewpublish.googleapis.com/v1/photo:startUpload?key=${process.env.GOOGLE_API_KEY}`,
    method: 'post',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Length': 0,
    },
  });
  const uploadReference = urlres.data;
  const { uploadUrl } = uploadReference;
  let parts;
  if (process.platform === 'win32')
    parts = baseDirectory.split('\\');
  else
    parts = baseDirectory.split('/');
  const seqName = parts[parts.length - 2];
  const filepath = path.join(baseDirectory, seqName.split(' ').join('_') + "_" + item.Image);
  const data = fs.readFileSync(filepath);

  console.log(`Upload ${item.Image} to Google Street`);

  await axios({
    method: 'post',
    url: uploadUrl,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'image/jpeg',
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    data,
  });

  console.log(`Update ${seqName.split(' ').join('_') + "_" + item.Image} to Google Street`);

  const metaData = {
    uploadReference,
    pose: {
      heading: adAzimuth,
      altitude: item.MAPAltitude,
      pitch: item.Pitch,
      latLngPair: {
        latitude: item.MAPLatitude,
        longitude: item.MAPLongitude,
      },
    },
    captureTime: {
      seconds: Math.floor(dayjs(item.GPSDateTime).toDate().getTime() / 1000),
    },
  };

  if (googlePlace) {
    metaData.places = [
      {
        placeId: googlePlace,
      },
    ];
  }

  console.log('metaData: ', metaData);

  return axios({
    method: 'post',
    url: `https://streetviewpublish.googleapis.com/v1/photo?key=${process.env.GOOGLE_API_KEY}`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: metaData,
  })
};

export const uploadImagesToGoogle = async (
  mainWindow: BrowserWindow,
  points: IGeoPoint[],
  baseDirectory: string,
  messageChannelName: string,
  googlePlace?: string
): Promise<GooglePhotoRes[]> => {
  let token = tokenStore.getToken('google');

  let index = 30;
  /////////////////////
  const upload_status_file = path.join(baseDirectory, 'upload_google.json');
  let logPoints: { idx: number; filename: string | undefined; status: string; }[] = [];
  if (fs.existsSync(upload_status_file)) {
    logPoints = JSON.parse(fs.readFileSync(upload_status_file).toString());
  } else {
    points.map((point, idx) => {
      logPoints.push({ idx: idx + 1, filename: point.Image, status: 'PENDING' });
    });
    fs.writeFileSync(upload_status_file, JSON.stringify(logPoints));
  }
  fs.writeFileSync(path.join(baseDirectory, 'upload_images.json'),
    JSON.stringify(logPoints)
  );
  let gsvRes: { shareLink: string; filename: string | undefined; photoId: string }[] = [];
  //////////////////////

  return new Promise((resolve, reject) => {
    Async.eachOfLimit(
      points,
      1,
      async (point: IGeoPoint, key: any, cb: CallableFunction) => {
        if (logPoints[key].status === "TRUE") {
          cb(null);
        }
        let adAzimuth = 0;
        if (key !== 0) {
          const prevPoint = points[key - 1];
          adAzimuth = (point.Azimuth - prevPoint.Azimuth + 360) % 360;
        }

        index++;

        if (index == 30 + 1) {
          const refreshToken = tokenStore.getRefreshToken('google');
          const newToken = await getGoogleRefreshToken(refreshToken);
          token = newToken;
          index = 0;
        }

        uploadImage(
          mainWindow,
          token,
          point,
          baseDirectory,
          messageChannelName,
          adAzimuth,
          googlePlace
        )
          // eslint-disable-next-line promise/no-callback-in-promise
          .then((res) => {
            const photoRes = res.data;
            gsvRes.push({ photoId: photoRes.photoId, filename: point.Image, shareLink: photoRes.shareLink });
            logPoints[key].status = "TRUE";
            fs.writeFileSync(upload_status_file, JSON.stringify(logPoints));
            cb(null);
          })
          // eslint-disable-next-line promise/no-callback-in-promise
          .catch((err) => cb(err));
      },
      (err) => {
        if (!err) resolve(gsvRes);
        else reject(err);
      }
    );
  });
};

JSON.safeStringify = (obj, indent = 2) => {
  let cache: any[] | null = [];
  const retVal = JSON.stringify(
    obj,
    (key, value) =>
      typeof value === "object" && value !== null
        ? cache.includes(value)
          ? undefined // Duplicate reference found, discard key
          : cache.push(value) && value // Store value in our collection
        : value,
    indent
  );
  cache = null;
  return retVal;
};

const querystring = require('querystring');

export const getGoogleRefreshToken = async (refreshToken: string) => {
  let newAccessToken = '';
  // let newRefreshToken = '';

  try {
    const accessTokenObj = await axios.post(
      'https://www.googleapis.com/oauth2/v4/token',
      querystring.stringify({
        refresh_token: refreshToken,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token',
        access_type: 'offline',
        // prompt: 'consent',
      })
    );
    const tokenObj = accessTokenObj.data;
    newAccessToken = tokenObj.access_token;
    // newRefreshToken = tokenObj.refresh_token;

    // fs.writeFileSync(path.join(path.join((electron.app || electron.remote.app).getAppPath(), '../'), 'debug.log'),
    //   JSON.safeStringify(tokenObj)
    // );

  } catch (error) {
    console.log(error);
    // fs.writeFileSync(path.join(path.join((electron.app || electron.remote.app).getAppPath(), '../'), 'debug-error.log'),
    //   error
    // );
  }

  return newAccessToken;
};
