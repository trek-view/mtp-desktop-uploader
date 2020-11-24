import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import tokenStore from '../scripts/tokens';
import {
  Typography,
  Grid,
  Button,
  FormControlLabel,
  Checkbox,
} from '@material-ui/core';

import ChevronRightIcon from '@material-ui/icons/ChevronRight';

import {
  setDestination,
  selSequence,
  selSequenceMethodConfig,
  setError,
  setProcessStep,
  setCurrentStep,
  isRequiredNadir,
  setNumberOfDivisions,
} from './slice';

import { selIntegrations } from '../base/slice';

const { ipcRenderer } = window.require('electron');

interface State {
  [key: string]: boolean;
}

Array.prototype.division = function (n: number) {
  var arr = this;
  var len = arr.length;
  var cnt = Math.floor(len / n);
  var tmp = [];

  for (var i = 0; i <= cnt; i++) {
    tmp.push(arr.splice(0, n));
  }

  return tmp;
}

export default function Destination() {
  const dispatch = useDispatch();
  const integrations = useSelector(selIntegrations);
  let sequence = useSelector(selSequence);
  const [state, setState] = useState<State>({});
  const isrequirednadir = useSelector(isRequiredNadir);
  const methodConfig = useSelector(selSequenceMethodConfig);

  const confirmMode = () => {
    const checked = Object.keys(state).filter(
      (key) => key !== 'mtp' && state[key]
    );
    if (checked.length > 0) {
      dispatch(setDestination(state));
      dispatch(setCurrentStep('destination_login'));
    } else if (sequence.points.length) {
      dispatch(setDestination(state));
      dispatch(setProcessStep('final'));
      if (sequence.multiPartProcessing == true) {
        const multiPartPoints = sequence.points.map((x) => x);
        let dividedPoints = multiPartPoints.division(500);
        const multiPartDestination = sequence.passedPoints.destination.map((x) => x);
        let dividedDestination = multiPartDestination.division(500);
        const multiPartGpx = sequence.passedPoints.gpx.map((x) => x);
        let dividedGpx = multiPartGpx.division(500);
        const multiPartRequireModify = sequence.passedPoints.requireModify.map((x) => x);
        let dividedRequireModify = multiPartRequireModify.division(500);
        dispatch(setNumberOfDivisions(dividedPoints.length));
        for (var i = 1; i <= dividedPoints.length; i++) {
          const sequenceJson = JSON.stringify(sequence);
          let partSequence = JSON.parse(sequenceJson);
          partSequence.points = dividedPoints[i - 1];
          partSequence.passedPoints.destination = dividedDestination[i - 1];
          partSequence.passedPoints.gpx = dividedGpx[i - 1];
          partSequence.passedPoints.requireModify = dividedRequireModify[i - 1];
          partSequence.steps.name = sequence.steps.name + "_part_" + i.toString();
          ipcRenderer.send('update_images', partSequence, sequence.steps.name);
        }
      } else {
        dispatch(setNumberOfDivisions(1));
        ipcRenderer.send('update_images', sequence, sequence.steps.name);
      }
    } else {
      dispatch(setError('There is no photos.'));
    }
  };

  const handleChange = (key: string) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newState = {
      ...state,
      [key]: event.target.checked,
    };

    if (key === 'mapillary' && event.target.checked) {
      newState.mtp = event.target.checked;
    }

    if (key === 'mapillary' && !event.target.checked) {
      newState.mtp = event.target.checked;
    }

    if (key === 'mtp' && event.target.checked) {
      newState.mapillary = event.target.checked;
    }

    if (key === 'mtp' && !event.target.checked) {
      newState.mapillary = event.target.checked;
    }

    setState(newState);
  };

  const items = Object.keys(integrations)
    .filter(
      (key: string) => key !== 'google' || (key === 'google' && isrequirednadir)
    )
    .filter(
      (key: string) =>
        key !== 'strava' || (key === 'strava' && methodConfig.strava_activity)
    )
    .sort((a: string, b: string) =>
      integrations[a].order > integrations[b].order ? 1 : -1
    )
    .map((key) => {
      const checkNode = (
        <Checkbox
          checked={!!state[key]}
          onChange={handleChange(key)}
          name={key}
          color="primary"
        />
      );
      const integrationLogo = (
        <>
          <img
            src={`data:image/png;base64, ${integrations[key].logo}`}
            alt={integrations[key].name}
            width="70"
            height="70"
          />
        </>
      );

      return (
        <FormControlLabel
          color="primary"
          control={checkNode}
          label={integrationLogo}
          key={key}
        />
      );
    });
    
  return (
    <>
      <Grid item xs={12}>
        <Typography variant="h5" align="center" color="textSecondary">
          Destinations
        </Typography>
      </Grid>
      <Grid item xs={12}>
        {items}
      </Grid>
      <Grid item xs={12}>
        <Button
          endIcon={<ChevronRightIcon />}
          color="primary"
          onClick={confirmMode}
          variant="contained"
        >
          {`${
            Object.keys(state).filter(
              (integration: string) => state[integration]
            ).length > 0
              ? 'Confirm Changes'
              : 'Skip This Step'
          }`}
        </Button>
      </Grid>
    </>
  );
}
