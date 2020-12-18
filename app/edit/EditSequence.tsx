import React, { useEffect, useState } from 'react';

import { Alert, AlertTitle } from '@material-ui/lab';
import { grey } from '@material-ui/core/colors';
import Autocomplete from 'react-google-autocomplete';

import {
  Typography,
  FormControlLabel,
  Checkbox,
  Button,
  LinearProgress,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import { shell } from 'electron';

import { useSelector, useDispatch } from 'react-redux';
import transportType from '../../transports/transport-methods.json';
import { IGeoPoint } from '../types/IGeoPoint';
import { selIntegrations, selTokens } from '../base/slice';
import { selStep, setStep } from './slice';

import { Summary } from '../types/Result';

const { ipcRenderer } = window.require('electron');

const useStyles = makeStyles((theme) => ({
  paper: {
    width: 'calc(100% - 60px)',
    height: 'calc(100% - 60px)',
    backgroundColor: theme.palette.background.paper,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    position: 'absolute',

    '& > *': {
      width: '100%',
      textAlign: 'center',
    },
  },

  loginButtonWrapper: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    '& > *': {
      margin: theme.spacing(2),
    },
  },
  placeWrapper: {
    width: '90%',
    borderRadius: 4,
    borderColor: grey[500],
    borderWidth: 1,
    fontSize: '1rem',
    padding: theme.spacing(2),
  },
}));

interface Props {
  data: Summary;
}

interface State {
  message: string | null;
  dest: {
    [key: string]: boolean | string;
  };
  error: string | null;
  googlePlace: string | null;
}

export default function EditSequence({ data }: Props) {
  const { destination, name, points, type, method } = data;

  const isrequiregoogle =
    points.filter((point: IGeoPoint) => !point.equirectangular).length === 0;
  let methodConfig;
  transportType[type].children.forEach((it: MethodModel) => {
    if (it.type === method) {
      methodConfig = it;
    }
  });

  const classes = useStyles();
  const step = useSelector(selStep);
  const dispatch = useDispatch();

  const [state, setState] = useState<State>({
    dest: destination,
    error: null,
    message: null,
    googlePlace: null,
  });

  const integrations = useSelector(selIntegrations);
  const tokens = useSelector(selTokens);

  const { dest, error } = state;

  const enabled =
    data &&
    Object.keys(dest).length &&
    Object.keys(dest)
      .filter((key) => dest[key])
      .filter((key: string) => !(tokens[key] && tokens[key].token)).length ===
      0;

  useEffect(() => {
    ipcRenderer.on('update_loaded_message', (_event, msg) => {
      setState({
        ...state,
        message: msg,
      });
    });
    ipcRenderer.on('update_error', (_event, err) => {
      setState({
        ...state,
        error: err,
      });
      dispatch(setStep(0));
    });
    return () => {
      ipcRenderer.removeAllListeners('update_loaded_message');
      ipcRenderer.removeAllListeners('update_error');
    };
  });

  const handleChange = (key: string) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newState = {
      ...state.dest,
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

    setState({
      ...state,
      dest: newState,
    });
  };

  const setPlace = (place) => {
    setState({
      ...state,
      googlePlace: place.place_id,
    });
  };

  const confirmStep1 = () => {
    if (enabled) {
      if (!dest.google) {
        dispatch(setStep(2));
        ipcRenderer.send('update_integration', data, dest);
      } else {
        dispatch(setStep(3));
      }
    }
  };

  const confirmStep3 = () => {
    dispatch(setStep(2));
    ipcRenderer.send('update_integration', data, dest, state.googlePlace);
  };

  const items = Object.keys(integrations)
    .filter(
      (key: string) => (key === 'google' && isrequiregoogle) || key !== 'google'
    )
    .filter(
      (key: string) =>
        key !== 'strava' ||
        (key === 'strava' && methodConfig && methodConfig.strava_activity)
    )
    .sort((a: string, b: string) =>
      integrations[a].order > integrations[b].order ? 1 : -1
    )
    .map((key) => {
      const checkNode = (
        <Checkbox
          checked={!!dest[key]}
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

  const gotoExternal = (url: string) => {
    shell.openExternal(url);
  };

  const login = (integration: string) => {
    ipcRenderer.send('set_token', integration, { token: null, waiting: true });
    gotoExternal(integrations[integration].loginUrl);
  };

  const loginItems = Object.keys(dest)
    .filter((k: string) => dest[k])
    .filter((integration: string) => dest[integration] && integration !== 'mtp')
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

  const nextStep = () => {
    dispatch(setStep(step + 1));
  };

  return (
    <div className={classes.paper}>
      <Typography variant="h5">{name}</Typography>

      {error && (
        <div>
          <Alert severity="error">
            <AlertTitle>Error!</AlertTitle>
            <span>{error}</span>
          </Alert>
        </div>
      )}
      {step === 0 && (
        <>
          <div>{items}</div>
          <div>
            <Button
              endIcon={<ChevronRightIcon />}
              color="primary"
              onClick={nextStep}
              variant="contained"
              disabled={
                Object.keys(dest).filter((key: string) => dest[key]).length ===
                0
              }
            >
              Confirm Changes
            </Button>
          </div>
        </>
      )}
      {step === 1 && (
        <>
          <div className={classes.loginButtonWrapper}>{loginItems}</div>
          <div>
            <Button
              onClick={confirmStep1}
              endIcon={<ChevronRightIcon />}
              color="primary"
              variant="contained"
              disabled={!enabled}
            >
              Confirm
            </Button>
          </div>
        </>
      )}
      {step === 2 && (
        <>
          {state.message && (
            <Typography variant="caption" color="textPrimary">
              {state.message}
            </Typography>
          )}
          <LinearProgress />
        </>
      )}
      {step === 3 && (
        <>
          <div>
            <Autocomplete
              className={classes.placeWrapper}
              onPlaceSelected={setPlace}
              types={['(regions)']}
            />
          </div>
          <div>
            <Button
              onClick={confirmStep3}
              endIcon={<ChevronRightIcon />}
              color="primary"
              variant="contained"
              disabled={!enabled}
            >
              Confirm
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
