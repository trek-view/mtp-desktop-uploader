import axios from 'axios';

import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import axiosErrorHandler from '../utils/axios';
import { getSequenceBasePath, getSequenceGpxPath } from '../utils';
import { Sequence } from '../../types/Result';

axios.interceptors.response.use(
  (res) => res,
  (err) => {
    throw err;
  }
);

export const uploadGpx = async (
  token: string,
  sequence: Sequence,
  sequenceId: string,
  basepath: string
) => {
  try {
    const filepath = getSequenceGpxPath(
      sequence.uploader_sequence_name,
      basepath
    );
    const upload_status_file = path.join(
      getSequenceBasePath(sequence.uploader_sequence_name, basepath), 
      'upload_strava.json'
    );
    let logStrava = {};
    if (fs.existsSync(upload_status_file)) {
      logStrava = JSON.parse(fs.readFileSync(upload_status_file).toString());
    } else {
      logStrava = { sequence: sequence.uploader_sequence_name, status: 'PENDING' };
      fs.writeFileSync(upload_status_file, JSON.stringify(logStrava));
    }
    if (logStrava.status === 'TRUE' && logStrava.data) {
      return {
        data: logStrava.data
      }
    }
    const data = new FormData();
    let seqName = sequence.uploader_sequence_name;
    if (sequence.uploader_sequence_name.includes('_part_')) {
      seqName = sequence.uploader_sequence_name.replace('_part_', ' Part ');
    }
    data.append('file', fs.createReadStream(filepath));
    data.append('name', seqName);
    data.append('description', sequence.uploader_sequence_description);
    data.append('data_type', 'gpx');
    data.append('external_id', sequenceId);
    data.append('type', sequence.uploader_transport_type);

    const res = await axios({
      url: 'https://www.strava.com/api/v3/uploads',
      method: 'post',
      headers: {
        ...data.getHeaders(),
        Authorization: `Bearer ${token}`,
      },
      data,
    });

    console.log('Uploading Gpx To Strava:', res.data);
    /////////////////
    logStrava.status = "TRUE";
    logStrava.data = res.data.id;
    fs.writeFileSync(upload_status_file, JSON.stringify(logStrava));
    /////////////////
    return {
      data: res.data.id,
    };
  } catch (e) {
    if (e.response && e.response.data && e.response.data.id) {
      return {
        error: 'Uploading GPX to Strava: duplicated',
      };
    }
    return {
      error: axiosErrorHandler(e, 'Uploading GPX to Strava'),
    };
  }
};

export const updateActivityAPI = async (
  type: string,
  id: number,
  token: string
) => {
  try {
    const data = new FormData();
    data.append('type', type);

    const res = await axios({
      method: 'put',
      url: `https://www.strava.com/api/v3/activities/${id}`,
      headers: {
        ...data.getHeaders(),
        Authorization: `Bearer ${token}`,
      },
      data,
    });
    return { data: res.data };
  } catch (e) {
    return {
      error: axiosErrorHandler(e, 'Updating Activity to Strava'),
    };
  }
};

export const getStravaToken = async (refreshToken: string) => {
  const data = new FormData();
  data.append('client_id', process.env.STRAVA_CLIENT_ID);
  data.append('client_secret', process.env.STRAVA_CLIENT_SECRET);
  data.append('grant_type', 'refresh_token');
  data.append('refresh_token', refreshToken);

  try {
    const tokenData = await axios({
      method: 'post',
      headers: {
        ...data.getHeaders(),
      },
      url: 'https://www.strava.com/api/v3/oauth/token',
      data,
    });
    return {
      data: tokenData.data,
    };
  } catch (error) {
    return {
      error: axiosErrorHandler(error, 'Strava Token'),
    };
  }
};

export const findActivityAPI = async (id: string, token: string) => {
  try {
    try {
      const res = await axios({
        method: 'get',
        url: `https://www.strava.com/api/v3/uploads/${id}`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return { data: res.data };
    } catch (e) {
      return {
        error: axiosErrorHandler(e, 'Finding Activity'),
      };
    }
  } catch (e) {
    return {
      error: axiosErrorHandler(e, 'Finding Activity'),
    };
  }
};
