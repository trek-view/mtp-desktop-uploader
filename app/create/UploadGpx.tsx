import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import Typography from '@material-ui/core/Typography';
import Grid from '@material-ui/core/Grid';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import DeleteForeverIcon from '@material-ui/icons/DeleteForever';

import { Button } from '@material-ui/core';
import {
  setSequenceGpxPath,
  setCurrentStep,
  selGPXRequired,
  selGPXImport,
  setProcessStep,
  setSequencePoints,
  selPoints,
  setError,
} from './slice';

import fs from 'fs';
import path from 'path';
const electron = require('electron');

import { IGeoPoint } from '../types/IGeoPoint';

const { ipcRenderer, remote } = window.require('electron');

export default function SequenceUploadGpx() {
  const dispatch = useDispatch();
  const proppoints = useSelector(selPoints);

  const required = useSelector(selGPXRequired);
  const importgpx = useSelector(selGPXImport);

  useEffect(() => {
    if (!required && !importgpx && proppoints.length) {
      fs.writeFileSync(path.join(path.join((electron.app || electron.remote.app).getAppPath(), '../'), 'settings.json'),
        JSON.stringify({
          'modify_gps_spacing': false,
          'remove_outlier': false,
          'modify_heading': false,
          'add_copyright': false,
          'add_nadir': false,
        })
      );
      dispatch(setCurrentStep('requireModify'));
    }
  });

  const openFileDialog = async () => {
    const parentWindow = remote.getCurrentWindow();
    const result = await remote.dialog.showOpenDialogSync(parentWindow, {
      properties: ['openFile'],
      filters: [
        {
          name: 'GPX',
          extensions: ['gpx'],
        },
      ],
    });
    if (result) {
      dispatch(setSequenceGpxPath(result[0]));
      dispatch(setProcessStep('startTime'));
      ipcRenderer.send('load_gpx', result[0]);
    }
  };

  const geotagged = proppoints.filter(
    (p: IGeoPoint) =>
      typeof p.MAPAltitude !== 'undefined' &&
      typeof p.MAPLatitude !== 'undefined' &&
      typeof p.MAPLongitude !== 'undefined'
  );

  const discardPoints = () => {
    dispatch(setSequencePoints(geotagged));
    if (geotagged.length) {
      if (required) {
        dispatch(setCurrentStep('modifySpace'));
      } else {
        fs.writeFileSync(path.join(path.join((electron.app || electron.remote.app).getAppPath(), '../'), 'settings.json'),
          JSON.stringify({
            'modify_gps_spacing': false,
            'remove_outlier': false,
            'modify_heading': false,
            'add_copyright': false,
            'add_nadir': false,
          })
        );
        dispatch(setCurrentStep('requireModify'));
      }
    } else {
      dispatch(setError('There will be no images.'));
    }
  };

  return (
    <>
      <Grid item xs={12}>
        <Typography variant="h6" align="center" color="textSecondary">
          {`${
            // eslint-disable-next-line no-nested-ternary
            required
              ? geotagged.length
                ? 'There are some images that have no geodata.'
                : '0 photos have no geodata.'
              : ''
            } Please upload the GPS tracks Following formats supported: GPX.`}
        </Typography>
      </Grid>
      <Grid
        item
        xs={12}
        style={{
          alignItems: 'center',
          display: 'flex',
          justifyContent: 'space-around',
        }}
      >
        <div>
          <Button
            onClick={openFileDialog}
            color="primary"
            variant="contained"
            endIcon={<CloudUploadIcon />}
          >
            Upload
          </Button>
        </div>
        {!importgpx && geotagged.length > 0 && (
          <div>
            <Button
              onClick={discardPoints}
              color="secondary"
              endIcon={<DeleteForeverIcon />}
              variant="contained"
            >
              Discard
            </Button>
          </div>
        )}
      </Grid>
      <Grid item xs={12} />
    </>
  );
}
