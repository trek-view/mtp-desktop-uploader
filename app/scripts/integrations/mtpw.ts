import axios from 'axios';
import qs from 'qs';
import fs from 'fs';
import path from 'path';
import { Sequence, Result, Summary } from '../../types/Result';
import axiosErrorHandler from '../utils/axios';
import { createdData2List, getSequenceLogPath, getSequenceBasePath } from '../utils';
import { findSequences } from './mapillary';
import tokenStore from '../tokens';
import { findActivityAPI, getStravaToken, updateActivityAPI } from './strava';

axios.interceptors.response.use(
  (res) => res,
  (err) => {
    throw err;
  }
);

export const postSequenceAPI = async (sequence: Sequence, token: string) => {
  let seqName = sequence.uploader_sequence_name;
  if (sequence.uploader_sequence_name.includes('_part_')) {
    seqName = sequence.uploader_sequence_name.replace('_part_', ' Part ');
  }
  const data = {
    name: seqName,
    description: sequence.uploader_sequence_description,
    transport_type: sequence.uploader_transport_method,
    tag: sequence.uploader_tags.join(','),
    source: 'mtpdu',
  };
  const config = {
    method: 'post',
    url: `${process.env.MTP_WEB_URL}/api/v1/sequence/create/`,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: qs.stringify(data),
  };

  try {
    const res = await axios(config);
    if (res.data.error) {
      return {
        mtpwError: `MTPWCreateSequence: ${res.data.error}`,
      };
    }
    return {
      mtpwSequence: res.data,
    };
  } catch (error) {
    return {
      mtpwError: axiosErrorHandler(error, 'MTPWCreateSequence'),
    };
  }
};

export const updateIntegrationStatusDataAPI = async (
  sequence: Sequence,
  seqId: string,
  basepath: string,
  data: any
) => {
  const upload_status_file = path.join(
    getSequenceBasePath(sequence.uploader_sequence_name, basepath),
    'upload_mtp.json'
  );
  fs.writeFileSync(upload_status_file, JSON.stringify(data));
  /* let logMTP = {};
  if (fs.existsSync(upload_status_file)) {
    logMTP = JSON.parse(fs.readFileSync(upload_status_file).toString());
  } else {
    logMTP = { sequence: sequence.uploader_sequence_name, status: 'PENDING' };
    fs.writeFileSync(upload_status_file, JSON.stringify(logMTP));
  }
  if (logMTP.status === 'TRUE') {
    return { }
  } */
  const mtpwToken = tokenStore.getToken('mtp');
  const config = {
    method: 'put',
    url: `${process.env.MTP_WEB_URL}/api/v1/sequence/import/${seqId}/`,
    headers: {
      Authorization: `Bearer ${mtpwToken}`,
      'Content-Type': 'application/json',
    },
    data: JSON.stringify(data),
  };

  try {
    const res = await axios(config);

    if (res.data.error) {
      return {
        seqError: `MTPWImportSequence: ${res.data.error}`,
      };
    }
    /* logMTP.status = 'TRUE';
    fs.writeFileSync(upload_status_file, JSON.stringify(logMTP)); */
    return {};
  } catch (error) {
    return {
      seqError: axiosErrorHandler(error, 'MTPWImportSequence'),
    };
  }
};

export const checkIntegrationStatus = async (
  s: Result,
  basepath: string
): Promise<Summary> => {
  const mapillaryToken = tokenStore.getToken('mapillary');
  const stravaToken = tokenStore.getToken('strava');
  const summary = createdData2List(s);
  const { destination } = s.sequence;
  let updated = false;

  if (
    destination &&
    typeof destination.mapillary === 'string' &&
    destination.mapillary !== '' &&
    !destination.mapillary.startsWith('Error') &&
    mapillaryToken
  ) {
    console.log('destination.mapillary: ', destination.mapillary);
    const { error, data } = await findSequences(
      mapillaryToken,
      destination.mapillary,
      s.sequence
    );

    if (error) {
      console.log('Mapillary findSequences Error: ', error);
      updated = true;

      summary.destination.mapillary = `Error: ${error}`;
      s.sequence.destination.mapillary = `Error: ${error}`;
    } else if (data && destination.mtp && typeof destination.mtp === 'string') {
      const { seqError } = await updateIntegrationStatusDataAPI(
        s.sequence,
        destination.mtp,
        basepath,
        {
          mapillary_user_token: mapillaryToken,
          mapillary_sequence_key: data,
        }
      );
      console.log('Mapillary updateIntegrationStatusDataAPI Error: ', seqError);
      if (!seqError) {
        updated = true;
        summary.destination.mapillary = true;
        s.sequence.destination.mapillary = true;
      }
    }
  }

  console.log('stravaToken: ', destination.strava, stravaToken);

  if (destination && typeof destination.strava === 'number' && stravaToken) {
    const newStravaToken = await getStravaToken(
      tokenStore.getRefreshToken('strava')
    );

    console.log('newStravaToken:', newStravaToken);

    if (newStravaToken.data) {
      tokenStore.set('strava', { waiting: false, token: newStravaToken.data });

      const stravaActivity = await findActivityAPI(
        destination.strava,
        newStravaToken.data.access_token
      );

      console.log('stravaActivity: ', stravaActivity.data);

      if (
        stravaActivity.data &&
        stravaActivity.data.activity_id &&
        typeof destination.mtp === 'string' &&
        destination.mtp !== ''
      ) {
        updated = true;

        const { seqError } = await updateIntegrationStatusDataAPI(
          s.sequence,
          destination.mtp,
          basepath,
          {
            strava: stravaActivity.data.activity_id,
          }
        );

        if (!seqError) {
          summary.destination.strava = true;
          s.sequence.destination.strava = true;
        }
      }
    }
  }

  if (
    ((typeof summary.destination.strava === 'boolean' &&
      summary.destination.strava) ||
      !summary.destination.strava) &&
    typeof summary.destination.mapillary === 'boolean' &&
    summary.destination.mapillary
  ) {
    updated = true;
    summary.destination.mtp = true;
    s.sequence.destination.mtp = true;
  }

  if (updated) {
    fs.writeFileSync(
      getSequenceLogPath(s.sequence.uploader_sequence_name, basepath),
      JSON.stringify(s)
    );
  }

  console.log('----------- end checkIntegrationStatus: -----------------');

  return summary;
};

export default postSequenceAPI;
