import { BrowserWindow, App } from 'electron';

import path from 'path';
import fs from 'fs';

import { IGeoPoint } from '../../types/IGeoPoint';
import { Result } from '../../types/Result';
import { Session } from '../../types/Session';
import tokenStore from '../tokens';
import axiosErrorHandler from '../utils/axios';
import { getLogFilePath, sendToClient } from '../utils';
import { updateIntegrationStatusDataAPI, postSequenceAPI } from './mtpw';

import {
  loadMapillarySessionData,
  publishSession,
  uploadImagesMapillary,
} from './mapillary';
import { uploadImagesToGoogle } from './google';
import { uploadGpx, getStravaToken } from './strava';

export const getError = (error: any) => {
  return {
    error,
  };
};

export default async (
  mainWindow: BrowserWindow,
  settings: any,
  resultjson: Result,
  points: IGeoPoint[],
  baseDirectory: string,
  basepath: string,
  messageChannelName: string,
  googlePlace?: string
) => {
  const mapillaryToken = tokenStore.getToken('mapillary');
  const mtpwToken = tokenStore.getToken('mtp');
  const googleToken = tokenStore.getToken('google');
  const stravaToken = tokenStore.getToken('strava');

  const { mapillary, mtp, google, strava } = settings;

  // if (!mtp || !mtpwToken) return { result: resultjson };

  let mapillarySessionData = null;

  if (mapillary && mapillaryToken) {
    const sessionData: Session = await loadMapillarySessionData(mapillaryToken);
    if (sessionData.error) {
      return getError(sessionData.error);
    }
    if (sessionData.data) {
      mapillarySessionData = sessionData.data;
    }
  }

  if (mapillarySessionData) {
    try {
      await uploadImagesMapillary(
        mainWindow,
        points,
        baseDirectory,
        mapillarySessionData,
        messageChannelName
      );
    } catch (e) {
      return getError(axiosErrorHandler(e, 'MapillaryUploadingImage'));
    }
    const mapillarySessionKey = mapillarySessionData.key;

    const publishSessionData = await publishSession(
      mapillaryToken,
      mapillarySessionData.key
    );
    if (publishSessionData.error) {
      return getError(publishSessionData.error);
    }
    resultjson.sequence.destination.mapillary = mapillarySessionKey;
    resultjson.sequence.destination.mapillary_user_token = mapillaryToken;
  }

  if (google && googleToken) {
    try {
      let gsvRes = await uploadImagesToGoogle(
        mainWindow,
        points,
        baseDirectory,
        messageChannelName,
        googlePlace
      );

      resultjson.sequence.destination.google = true;
      if (googlePlace)
        resultjson.sequence.placeid = googlePlace;
      if (gsvRes.length > 0)
        resultjson.sequence.sharelink = gsvRes[0].shareLink;
      gsvRes.map((gsvRow) => {
        Object.keys(resultjson.photo).map((pid) => {
          if (resultjson.photo[pid].original.filename === gsvRow.filename) {
            resultjson.photo[pid].photoId = gsvRow.photoId
            resultjson.photo[pid].shareLink = gsvRow.shareLink
          }
        })
      });

    } catch (error) {
      return getError(axiosErrorHandler(error, 'GoogleUploadImages'));
    }
  }

  if (
    Object.keys(resultjson.sequence.destination).length > 0 ||
    (strava && stravaToken)
  ) {
    const { mtpwSequence, mtpwError } = await postSequenceAPI(
      resultjson.sequence,
      mtpwToken
    );

    if (mtpwError) {
      return getError(mtpwError);
    }

    const mtpwId = mtpwSequence.unique_id;

    const updateIntegrationStatusData: { [key: string]: string } = {};

    if (google && googleToken) {
      updateIntegrationStatusData.google_street_view = resultjson.sequence.sharelink;
    }

    if (strava && stravaToken) {
      const newStravaToken = await getStravaToken(
        tokenStore.getRefreshToken('strava')
      );

      if (newStravaToken.error) {
        return getError(newStravaToken.error);
      }

      if (!newStravaToken.data) {
        return getError('Error: can not get the token');
      }

      tokenStore.set('strava', { waiting: false, token: newStravaToken.data });
      sendToClient(
        mainWindow,
        messageChannelName,
        `GPX is uploading to Strava`
      );
      const stravaUpload = await uploadGpx(
        newStravaToken.data.access_token,
        resultjson.sequence,
        mtpwId,
        basepath
      );

      if (stravaUpload.error) {
        return getError(stravaUpload.error);
      }
      if (!stravaUpload.data) {
        return getError('No response from Strava');
      }

      const activityId = stravaUpload.data;

      resultjson.sequence.destination.strava = activityId;
    }

    if (mtp) {
      if (Object.keys(updateIntegrationStatusData).length) {
        const { seqError } = await updateIntegrationStatusDataAPI(
          resultjson.sequence,
          mtpwId,
          basepath,
          updateIntegrationStatusData
        );

        if (seqError) {
          return getError(seqError);
        }
      }

      resultjson.sequence.destination.mtp = mtpwId;
      resultjson.sequence.destination.mtpw_user_token = mtpwToken;
    }
  }

  return { result: resultjson };
};

export const loginUrls = {
  mapillary: `https://www.mapillary.com/connect?client_id=${process.env.MAPILLARY_APP_ID}&response_type=token&scope=user:email%20private:upload&redirect_uri=${process.env.MTP_WEB_URL}/accounts/check-mtpu-mapillary-oauth`,
  mtp: `${process.env.MTP_WEB_AUTH_URL}?client_id=${process.env.MTP_WEB_APP_ID}&response_type=token`,
  strava: `https://www.strava.com/oauth/authorize?client_id=${process.env.STRAVA_CLIENT_ID}&redirect_uri=${process.env.MTP_WEB_URL}/exchange_token&response_type=code&approval_prompt=auto&scope=activity:write,read`,
  google: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${process.env.MTP_WEB_URL}/accounts/check-mtpu-google-oauth&response_type=code&scope=https://www.googleapis.com/auth/streetviewpublish&access_type=offline&prompt=consent`,
};

export async function loadIntegrations(app: App | null) {
  if (
    !(
      process.env.MTP_WEB_APP_ID &&
      process.env.MTP_WEB_APP_SECRET &&
      process.env.MTP_WEB_URL &&
      process.env.MTP_WEB_AUTH_URL
    )
  )
    return {};

  const integrationsRootPath = path.resolve(
    app?.getAppPath(),
    '../integrations'
  );

  const moduleIconPath = 'module-icon.png';
  const moduleConfigPath = 'module.json';

  const modules = await Promise.all(
    fs
      .readdirSync(integrationsRootPath)
      .filter(
        (name) =>
          fs.lstatSync(path.join(integrationsRootPath, name)).isDirectory() &&
          fs.existsSync(
            path.join(integrationsRootPath, name, 'static', moduleIconPath)
          ) &&
          path.join(integrationsRootPath, name, moduleConfigPath)
      )
      .map(async (m: string) => {
        const config = JSON.parse(
          fs
            .readFileSync(path.join(integrationsRootPath, m, moduleConfigPath))
            .toString()
        );

        const settings = {
          name: config.name,
          loginUrl: loginUrls[m],
          order: config.order,
          // envs: config.envs,
        };

        return {
          [m]: {
            logo: fs
              .readFileSync(
                path.resolve(integrationsRootPath, m, 'static', moduleIconPath)
              )
              .toString('base64'),
            ...settings,
          },
        };
      })
  );

  return modules.reduce((obj, module: any) => {
    const key = Object.keys(module)[0];
    // if (module[key].envs.filter((v: string) => !process.env[v]).length === 0) {
    //   obj[key] = module[key];
    // }
    obj[key] = module[key];
    return obj;
  }, {});
}
