import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import Typography from '@material-ui/core/Typography';
import { Grid, Button, Box, TextField } from '@material-ui/core';

import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import Map from '../components/Map';
import {
  setCurrentStep,
  selSequenceAzimuth,
  selPoints,
  setSequencePoints,
  resetPoints,
} from './slice';
import { IGeoPoint } from '../types/IGeoPoint';

import fs from 'fs';
import path from 'path';
const electron = require('electron');

interface State {
  points: IGeoPoint[];
  azimuth: number | string;
}

export default function SequenceModifyAzimuth() {
  const dispatch = useDispatch();
  const propazimuth = useSelector(selSequenceAzimuth);
  const proppoints = useSelector(selPoints);

  const [state, setState] = React.useState<State>({
    points: proppoints,
    azimuth: propazimuth,
  });

  const { points, azimuth } = state;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.value) {
      const newazimuth = parseFloat(event.target.value);
      const newpoints = proppoints.map((p: IGeoPoint) => {
        const updatedazimuth = ((p.Azimuth || 0) + newazimuth) % 360;
        return new IGeoPoint({
          ...p,
          Azimuth: updatedazimuth,
        });
      });
      setState({
        azimuth: newazimuth,
        points: newpoints,
      });
    } else {
      setState({
        azimuth: '',
        points: proppoints,
      });
    }
  };

  const resetMode = () => {
    setState({
      ...state,
      points: proppoints,
      azimuth: 0,
    });
    dispatch(resetPoints());
  };

  const confirmMode = () => {
    dispatch(setSequencePoints(points));
    fs.readFile(path.join(path.join((electron.app || electron.remote.app).getAppPath(), '../'), 'settings.json'), 'utf8', (error, data) => {
      if (error) {
        dispatch(setCurrentStep('copyright'));
        return;
      }
      var settings = JSON.parse(data);
      if (settings.add_copyright === true) {
        dispatch(setCurrentStep('copyright'));
      } else if (settings.add_nadir === true) {
        dispatch(setCurrentStep('nadir'));
      } else {
        dispatch(setCurrentStep('destination'));
      }
    });
  };

  return (
    <>
      <Grid item xs={12}>
        <Typography variant="h6" align="center" color="textSecondary">
          Modify Heading
        </Typography>
        <Typography paragraph>
          You can adjust the heading of all images. This is useful if you know
          the heading of images is incorrect by a certain degree. Heading value
          is inherited from camera, or if no value reported by the camera,
          calculated to face the next photo in the sequence.
        </Typography>
        <TextField
          id="outlined-basic"
          label="Heading (degrees)"
          variant="outlined"
          value={azimuth}
          onChange={handleChange}
        />
      </Grid>
      <Grid item xs={12}>
        <Map points={points} />
      </Grid>
      <Grid item xs={12}>
        <Box mr={1} display="inline-block">
          <Button
            endIcon={<ChevronRightIcon />}
            color="secondary"
            onClick={resetMode}
            variant="contained"
          >
            Reset Changes
          </Button>
        </Box>
        <Button
          endIcon={<ChevronRightIcon />}
          color="primary"
          onClick={confirmMode}
          variant="contained"
        >
          {`${azimuth === propazimuth ? 'Skip This Step' : 'Confirm Changes'}`}
        </Button>
      </Grid>
    </>
  );
}
