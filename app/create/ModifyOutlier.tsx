import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
  Grid,
  Button,
  Box,
  TextField,
  Tooltip,
  Typography,
} from '@material-ui/core';

import { makeStyles } from '@material-ui/core/styles';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';

import Map from '../components/Map';

import { IGeoPoint } from '../types/IGeoPoint';
import { getDistance, getBearing, getPitch } from '../scripts/utils';

import {
  selSequenceOutlierMeter,
  setCurrentStep,
  setOutlierMode,
  setSequenceOutlierMeters,
  selSequenceOutlierMode,
  selPoints,
  setSequencePoints,
  selGPXRequired,
  isRequiredNadir,
} from './slice';

import fs from 'fs';
import path from 'path';
const electron = require('electron');

const useStyles = makeStyles((theme) => ({
  wrapper: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    '& > *': {
      margin: theme.spacing(2),
    },
  },
  buttonWrapper: {
    display: 'flex',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'center',
    '& > *': {
      margin: theme.spacing(1),
    },
  },
}));


interface State {
  points: IGeoPoint[];
  metersStr: string;
  mode: string;
}

export default function SequenceModifyOutlier() {
  const dispatch = useDispatch();
  const propmeters = useSelector(selSequenceOutlierMeter);
  const propmode = useSelector(selSequenceOutlierMode);

  const proppoints = useSelector(selPoints);
  const [state, setState] = React.useState<State>({
    points: proppoints,
    metersStr: propmeters.toString(),
    mode: propmode,
  });

  const allGeoTagged = useSelector(selGPXRequired);
  const nadir = useSelector(isRequiredNadir);

  const { points, metersStr, mode } = state;

  const classes = useStyles();

  const updatePoints = (meterstr: string, m: string) => {
    try {
      const meters = parseFloat(meterstr);
      if (meters > 0 && m !== '') {
        const newpoints: IGeoPoint[] = [];

        const temppoints = proppoints.map(
          (point: IGeoPoint) => new IGeoPoint({ ...point })
        );

        let previousIdx = 0;
        for (let idx = 0; idx < temppoints.length; idx += 1) {
          const point: IGeoPoint = temppoints[idx];
          if (idx > 0 && idx < temppoints.length - 1) {
            const prevpoint = newpoints[previousIdx];
            const nextpoint = temppoints[idx + 1];
            const distance = getDistance(prevpoint, point);
            if (distance > meters && (point.Distance || 0) > meters) {
              if (m === 'S') {
                const newpoint = new IGeoPoint({
                  ...point,
                  MAPLongitude:
                    (prevpoint.MAPLongitude + nextpoint.MAPLongitude) / 2,
                  MAPLatitude:
                    (prevpoint.MAPLatitude + nextpoint.MAPLatitude) / 2,
                  MAPAltitude:
                    (prevpoint.MAPAltitude + nextpoint.MAPAltitude) / 2,
                });

                newpoints[previousIdx].setDistance(
                  getDistance(prevpoint, newpoint)
                );
                newpoints[previousIdx].setAzimuth(
                  getBearing(prevpoint, newpoint)
                );
                newpoints[previousIdx].setPitch(getPitch(prevpoint, newpoint));

                newpoint.setDistance(getDistance(nextpoint, newpoint));
                newpoint.setAzimuth(getBearing(newpoint, nextpoint));
                newpoint.setPitch(getPitch(newpoint, nextpoint));
                previousIdx = newpoints.length;
                newpoints.push(newpoint);
              } else {
                newpoints[previousIdx].setDistance(
                  getDistance(prevpoint, nextpoint)
                );
                newpoints[previousIdx].setAzimuth(
                  getBearing(prevpoint, nextpoint)
                );
                newpoints[previousIdx].setPitch(getPitch(prevpoint, nextpoint));
              }
            } else {
              previousIdx = newpoints.length;
              newpoints.push(point);
            }
          } else {
            newpoints.push(point);
          }
        }
        setState({
          ...state,
          metersStr: meterstr,
          points: [...newpoints],
          mode: m,
        });
      } else {
        setState({
          ...state,
          metersStr: meterstr,
          mode: m,
        });
      }
    } catch (e) {
      console.log('Wrong Value');
    }
  };

  const smoothMode = () => {
    if (mode !== 'S') updatePoints(metersStr, 'S');
  };

  const removeMode = () => {
    if (mode !== 'D') updatePoints(metersStr, 'D');
  };

  const resetMode = () => {
    setState({
      ...state,
      metersStr: '0',
      mode: '',
      points: proppoints,
    });
  };

  const confirmMode = () => {
    const meters = parseFloat(metersStr);
    dispatch(setSequenceOutlierMeters(meters));
    dispatch(setSequencePoints(points));
    dispatch(setOutlierMode(mode));
    fs.readFile(path.join(path.join((electron.app || electron.remote.app).getAppPath(), '../'), 'settings.json'), 'utf8', (error, data) => {
      if (error) {
        console.log(error);
        dispatch(setCurrentStep('azimuth'));
        return;
      }
      var settings = JSON.parse(data);
      if (settings.modify_heading === true) {
        dispatch(setCurrentStep('azimuth'));
      } else if (settings.add_copyright === true) {
        dispatch(setCurrentStep('copyright'));
      } else if (settings.add_nadir === true) {
        dispatch(setCurrentStep('nadir'));
      } else {
        dispatch(setCurrentStep('destination'));
      }
    });
  };

  const looksGood = () => {
    const meters = parseFloat(metersStr);
    dispatch(setSequencePoints(points));
    dispatch(setSequenceOutlierMeters(meters));
    dispatch(setOutlierMode(mode));
    dispatch(setCurrentStep('destination'));
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updatePoints(event.target.value, mode);
  };

  const removePhoto = (id: string) => {
    const newpoints: IGeoPoint[] = [];
    const temppoints = points.map(
      (point: IGeoPoint) => new IGeoPoint({ ...point })
    );
    for (let idx = 0; idx < temppoints.length; idx += 1) {
      const point: IGeoPoint = temppoints[idx];
      if (idx === 0) {
        if (point.id !== id) {
          newpoints.push(point);
        }
      } else if (idx > 0 && idx < temppoints.length - 1) {
        const previousIdx = idx - 1;
        if (point.id === id) {
          const nextpoint = temppoints[idx + 1];
          const prevpoint = temppoints[idx - 1];
          newpoints[previousIdx].setDistance(getDistance(prevpoint, nextpoint));
          newpoints[previousIdx].setAzimuth(getBearing(prevpoint, nextpoint));
          newpoints[previousIdx].setPitch(getPitch(prevpoint, nextpoint));
        } else {
          newpoints.push(point);
        }
      } else if (point.id !== id) {
        newpoints.push(point);
      } else {
        newpoints[newpoints.length - 1].setDistance(0);
        newpoints[newpoints.length - 1].setAzimuth(0);
        newpoints[newpoints.length - 1].setPitch(0);
      }
    }

    setState({
      ...state,
      points: newpoints,
    });
  };

  return (
    <>
      <Grid item xs={12}>
        <Typography variant="h6" align="center" color="textSecondary">
          Fix Photo Outliers
        </Typography>
        <Typography paragraph>
          You can remove OR normalise images that have incorrect geo-tags (not
          both). This is useful if you have corrupted GPS, but no backup GPS
          track. Discard simply removes any photos futher than the value entered
          from the expected path. You can also delete an individual image by
          clicking it on the map and selecting the delete icon. Normalise
          estimates the correct position and assigns that position to the image.
        </Typography>
        <Box mb={1} className={classes.wrapper}>
          <TextField
            label="Meters"
            placeholder="0"
            variant="outlined"
            onChange={handleChange}
            value={metersStr}
          />

          <Tooltip
            title={`Smooth outliers greater than ${metersStr} metersStr`}
          >
            <Button
              onClick={smoothMode}
              color={mode === 'S' ? 'secondary' : 'primary'}
              variant="contained"
            >
              Smooth
            </Button>
          </Tooltip>
          <Tooltip
            title={`Remove outliers greater than ${metersStr} metersStr`}
          >
            <Button
              onClick={removeMode}
              color={mode === 'D' ? 'secondary' : 'primary'}
              variant="contained"
            >
              Remove
            </Button>
          </Tooltip>
        </Box>
      </Grid>
      <Grid item xs={12}>
        <Map points={points} onDelete={removePhoto} />
      </Grid>
      <Grid item xs={12}>
        <Box className={classes.buttonWrapper}>
          <Button
            endIcon={<ChevronRightIcon />}
            color="secondary"
            onClick={resetMode}
            variant="contained"
          >
            Reset Changes
          </Button>
          <Button
            endIcon={<ChevronRightIcon />}
            color="primary"
            onClick={confirmMode}
            variant="contained"
          >
            {`${
              metersStr === '0' &&
              mode === '' &&
              proppoints.length === points.length
                ? 'Skip This Step'
                : 'Confirm Changes'
            }`}
          </Button>
        </Box>
      </Grid>
    </>
  );
}
