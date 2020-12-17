import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { shell } from 'electron';

import { Typography, Grid, Button } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import { Alert } from '@material-ui/lab';

import {
  selSequence,
  setProcessStep,
  selDestination,
  setCurrentStep,
  setNumberOfDivisions,
} from './slice';
import { setTokenWaiting, selIntegrations, selTokens } from '../base/slice';

const { ipcRenderer } = window.require('electron');

const useStyles = makeStyles((theme) => ({
  loginButtonWrapper: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    '& > *': {
      margin: theme.spacing(2),
    },
  },
}));

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

export default function DestinationLogin() {
  const dispatch = useDispatch();
  const destination = useSelector(selDestination);
  const integrations = useSelector(selIntegrations);
  const sequence = useSelector(selSequence);
  const tokens = useSelector(selTokens);
  const classes = useStyles();

  const gotoExternal = (url: string) => {
    shell.openExternal(url);
  };

  const login = (integration: string) => {
    dispatch(setTokenWaiting({ waiting: true, key: integration }));
    ipcRenderer.send('set_token', integration, { token: null, waiting: true });
    gotoExternal(integrations[integration].loginUrl);
  };

  const enabled =
    Object.keys(destination)
      .filter((key: string) => destination[key])
      .filter(
        (integration: string) =>
          !(
            tokens[integration] &&
            tokens[integration].token &&
            tokens[integration].token.access_token
          )
      ).length === 0;

  const confirm = () => {
    if (enabled) {
      if (destination.google) {
        dispatch(setCurrentStep('google_place'));
      } else {
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
      }
    }
  };

  const items = Object.keys(destination)
    .filter((integration: string) => destination[integration])
    .filter(
      (integration: string) => destination[integration] && integration !== 'mtp'
    )
    .map((integration: string) => {
      const integrationLogo = (
        <img
          src={`data:image/png;base64, ${integrations[integration].logo}`}
          alt={integrations[integration].name}
          width="35"
          height="35"
        />
      );

      let color = 'primary';
      let buttonTitle =
        tokens[integration] && tokens[integration].waiting
          ? 'Confirm in browser'
          : 'Login to';

      if (tokens[integration] && tokens[integration].token) {
        buttonTitle = 'Logged In';
        color = 'default';
      }

      return (
        <Button
          onClick={() => login(integration)}
          endIcon={integrationLogo}
          size="large"
          color={color}
          variant="contained"
          key={integration}
        >
          {buttonTitle}
        </Button>
      );
    });

  const errorItems = Object.keys(destination)
    .filter((integration: string) => destination[integration])
    .filter(
      (integration: string) => {
        console.log(tokens[integration])
        return tokens[integration] &&
        tokens[integration].token &&
        !tokens[integration].token.access_token
      }
        
    )
    .map((integration: string) => {
      return (
        <Alert severity="error" key={integration}>
          {JSON.stringify(tokens[integration].token)}
        </Alert>
      );
    });

  return (
    <>
      <Grid item xs={12}>
        <Typography variant="h6">Authentications</Typography>
      </Grid>

      <Grid item xs={12}>
        {errorItems}
      </Grid>

      <Grid item xs={12}>
        <div className={classes.loginButtonWrapper}>{items}</div>
      </Grid>
      <Grid item xs={12}>
        <Button
          onClick={confirm}
          endIcon={<ChevronRightIcon />}
          color="primary"
          variant="contained"
          disabled={!enabled}
        >
          Confirm
        </Button>
      </Grid>
    </>
  );
}
