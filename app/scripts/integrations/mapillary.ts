import axios from 'axios';
import axiosRetry from 'axios-retry';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import Async from 'async';
import { BrowserWindow, Debugger } from 'electron';

import { Session } from '../../types/Session';
import { Sequence } from '../../types/Result';
import { IGeoPoint } from '../../types/IGeoPoint';
import axiosErrorHandler from '../utils/axios';
import { sendToClient } from '../utils';

axios.defaults.timeout = 600000;

axios.interceptors.response.use(
  (res) => res,
  (err) => {
    throw err;
  }
);

export const loadMapillarySessionData = async (
  token: string
): Promise<Session> => {
  try {
    console.log('mapillary id: ', process.env.MAPILLARY_APP_ID);
    let sessoinDataData = await axios.post(
      `https://a.mapillary.com/v3/me/uploads?client_id=${process.env.MAPILLARY_APP_ID}`,
      {
        type: 'images/sequence',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );
    sessoinDataData = sessoinDataData.data;
    if (sessoinDataData.error) {
      return {
        error: `MapillarySession: ${sessoinDataData.error}`,
      };
    }
    return {
      data: sessoinDataData,
    };
  } catch (e) {
    return {
      error: axiosErrorHandler(e, 'MapillarySession'),
    };
  }
};

export const publishSession = async (
  token: string,
  sessionKey: string
): Promise<any> => {
  try {
    const publishConfig = {
      method: 'put',
      url: `https://a.mapillary.com/v3/me/uploads/${sessionKey}/closed?client_id=${process.env.MAPILLARY_APP_ID}`,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
    const res = await axios(publishConfig);
    return {};
  } catch (error) {
    return {
      error: axiosErrorHandler(error, 'MapillaryPublishSession'),
    };
  }
};

export const uploadImage = (
  filepath: string,
  filename: string,
  sessoinData: any
) => {
  return new Promise((resolve, reject) => {
    const formData = new FormData();

    Object.keys(sessoinData.fields).forEach((k: string) => {
      formData.append(k, sessoinData.fields[k]);
    });

    formData.append('key', `${sessoinData.key_prefix}${filename}`);

    formData.append('file', fs.createReadStream(filepath), {
      filename,
    });

    formData.getLength((err, length: number) => {
      if (err) return reject(err);

      const config = {
        method: 'post',
        url: sessoinData.url,
        headers: {
          ...formData.getHeaders(),
          'Content-Length': length,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        data: formData,
      };

      axiosRetry(axios, { retries: 3 });
      // eslint-disable-next-line promise/no-promise-in-callback
      axios(config)
        .then(() => resolve())
        .catch((err: any) => {
          console.log(
            'MapillaryUploadImage: ',
            axiosErrorHandler(err, 'MapillaryUploadImage')
          );
          reject(axiosErrorHandler(err, 'MapillaryUploadImage'));
        });
    });
  });
};

export const getUser = async (token: string) => {
  const userRes = await axios.get(
    `https://a.mapillary.com/v3/me?client_id=${process.env.MAPILLARY_APP_ID}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return userRes.data;
};

export const getUploadedSessions = async (
  token: string,
  sessionKey: string
) => {
  const sessionsRes = await axios.get(
    `https://a.mapillary.com/v3/me/uploads?client_id=${process.env.MAPILLARY_APP_ID}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  let error;

  sessionsRes.data.forEach((s: any) => {
    if (s.key === sessionKey) {
      if (s.error) {
        error = s.error.reason;
      }
    }
  });

  if (error) return error;

  return null;
};

export const findSequences = async (
  token: string,
  sessionKey: string,
  sequence: Sequence
) => {
  try {
    const user = await getUser(token);
    const uploadeSessions = await getUploadedSessions(token, sessionKey);

    if (uploadeSessions) {
      return {
        error: uploadeSessions,
      };
    }

    const url = `https://a.mapillary.com/v3/sequences?userkeys=${user.key}&client_id=${process.env.MAPILLARY_APP_ID}&start_time=${sequence.earliest_time}&end_time=${sequence.latest_time}`;

    console.log('mapillary url: ', url);

    const mapillarySequenceRes = await axios.get(url, {
      timeout: 600000,
    });

    if (mapillarySequenceRes.data.features.length) {
      return {
        data: mapillarySequenceRes.data.features[0].properties.key,
      };
    }
  } catch (e) {
    console.log(axiosErrorHandler(e, 'MapillaryFindSequences'));
  }
  return {};
};

export const uploadImagesMapillary = (
  mainWindow: BrowserWindow,
  points: IGeoPoint[],
  directoryPath: string,
  sessionData: any,
  messageChannelName = 'update_loaded_message'
) => {
  let p;
  if (process.platform === 'win32')
    p = directoryPath.split('\\');
  else
    p = directoryPath.split('/');
  const sn = p[p.length - 2];
  let beautifiedName = sn.split('_').join(' ');
  beautifiedName = beautifiedName.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  /////////////////////
  const upload_status_file = path.join(directoryPath, 'upload_mapillary.json');
  let logPoints = [];
  if (fs.existsSync(upload_status_file)) {
    logPoints = JSON.parse(fs.readFileSync(upload_status_file).toString());  
  } else {
    points.map((point, idx) => {
      logPoints.push({ idx: idx + 1, filename: point.Image, status: 'PENDING' });
    });
    fs.writeFileSync(upload_status_file, JSON.stringify(logPoints));
  }
  //////////////////////
  return new Promise((resolve, reject) => {
    Async.eachOfLimit(
      points,
      1,
      (item: IGeoPoint, key: any, next: CallableFunction) => {
        if (logPoints[key].status === "PENDING")
          sendToClient(
            mainWindow,
            messageChannelName,
            `[${beautifiedName}] ${item.Image} is uploading to Mapillary`
          );
        else if (logPoints[key].status === "TRUE") {
          sendToClient(
            mainWindow,
            messageChannelName,
            `[${beautifiedName}] ${item.Image} was already uploaded to Mapillary`
          );
          next();
        }
                   
        console.log("upload to mapiliary - item.Image: " + item.Image);
        console.log("directoryPath: " + directoryPath);
        let parts;
        if (process.platform === 'win32')
          parts = directoryPath.split('\\');
        else
          parts = directoryPath.split('/');
        const seqName = parts[parts.length - 2];
        const filepath = path.join(directoryPath, seqName.split(' ').join('_') + "_" + item.Image);
        // let uploaded_points = JSON.parse(fs.readFileSync(upload_status_file).toString());  
        uploadImage(filepath, seqName.split(' ').join('_') + "_" + item.Image, sessionData)
          .then(() => {
            logPoints[key].status = "TRUE";
            fs.writeFileSync(upload_status_file, JSON.stringify(logPoints));
            next()
          })
          .catch((e) => {
            console.log('UploadImage issue to Mapillary: ', e);
            // eslint-disable-next-line promise/no-callback-in-promise
            next(e);
          });
      },
      (err) => {
        if (err) {
          return reject(err);
        }
        return resolve();
      }
    );
  });
};
