import React, { useEffect, useState, ReactNode } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { push } from 'connected-react-router';
import { IpcRendererEvent } from 'electron';
import { useLocation } from 'react-router-dom';
import ScriptTag from 'react-script-tag';

import { Modal, Button } from '@material-ui/core';
import { Alert, AlertTitle } from '@material-ui/lab';
import { makeStyles } from '@material-ui/core/styles';
import { selSequenceName, setInit, selSequence } from '../create/slice';

import {
  selConfigLoaded,
  setConfigLoadEnd,
  selToken,
  selIntegrations,
  setToken,
} from '../base/slice';

import { selSeqs, updateSeqs } from '../list/slice';

import routes from '../constants/routes.json';
import { Summary } from '../types/Result';

const { ipcRenderer } = window.require('electron');
const useStyles = makeStyles((theme) => ({
  paper: {
    position: 'absolute',
    width: 400,
    backgroundColor: theme.palette.background.paper,
    border: '2px solid #000',
    boxShadow: theme.shadows[5],
    padding: theme.spacing(2, 4, 3),
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  },
}));

interface State {
  showModal: boolean;
  aboutPage: boolean;
}

type Props = {
  children: ReactNode;
};

const mtpTokenKey = 'mtp';

export default function App(props: Props) {
  const { children } = props;
  const sequence = useSelector(selSequence);
  const name = useSelector(selSequenceName);
  const configLoaded = useSelector(selConfigLoaded);
  const loadedSequences = useSelector(selSeqs);

  const integrations = useSelector(selIntegrations);

  const dispatch = useDispatch();

  const location = useLocation();

  const classes = useStyles();

  const mtpToken = useSelector(selToken)(mtpTokenKey);

  const [state, setState] = useState<State>({
    showModal: false,
    aboutPage: false,
  });
  const checkNeeded = loadedSequences
    .filter(
      (s: Summary) =>
        Object.keys(integrations).filter((key: string) => {
          return (
            integrations[key] &&
            s.destination[key] &&
            typeof s.destination[key] === 'string' &&
            s.destination[key] !== '' &&
            !s.destination[key].startsWith('Error')
          );
        }).length > 0
    )
    .map((s: Summary) => s.name);

  useEffect(() => {
    const interval = setInterval(() => {
      if (checkNeeded.length) {
        ipcRenderer.send('check_sequences', checkNeeded);
      }
    }, 300000);
    return () => clearInterval(interval);
  }, [integrations, checkNeeded]);

  useEffect(() => {
    if (
      !mtpToken &&
      location.pathname !== routes.LOGIN &&
      process.env.MTP_WEB_AUTH_URL &&
      process.env.MTP_WEB_APP_ID &&
      process.env.MTP_WEB_APP_SECRET &&
      integrations[mtpTokenKey] &&
      // process.env.NODE_ENV !== 'development' &&
      process.env.MTP_WEB_URL
    ) {
      dispatch(push(routes.LOGIN));
    }

    if (!configLoaded) {
      ipcRenderer.send('load_config');
    }

    ipcRenderer.on('loaded_config', (_event: IpcRendererEvent, config) => {
      dispatch(setConfigLoadEnd(config));
    });

    ipcRenderer.on('home_page', (_event: IpcRendererEvent) => {
      dispatch(push(routes.LIST));
    });

    ipcRenderer.on('about_page', (_event: IpcRendererEvent) => {
      if (name !== '') {
        setState({
          ...state,
          showModal: true,
          aboutPage: true,
        });
      } else {
        dispatch(push(routes.ABOUT));
      }
    });

    ipcRenderer.on('close_app', (_event: IpcRendererEvent) => {
      if (name !== '') {
        setState({
          ...state,
          showModal: true,
        });
      } else {
        ipcRenderer.send('closed_app', null);
      }
    });

    ipcRenderer.on(
      'loaded_token',
      (_event: IpcRendererEvent, key: string, token: any) => {
        dispatch(setToken({ key, token }));
      }
    );

    ipcRenderer.on(
      'updated_sequences',
      (_event: IpcRendererEvent, seqs: { [key: string]: Summary }) => {
        dispatch(updateSeqs(seqs));
      }
    );

    return () => {
      ipcRenderer.removeAllListeners('close_app');
      ipcRenderer.removeAllListeners('about_page');
      ipcRenderer.removeAllListeners('loaded_config');
      ipcRenderer.removeAllListeners('loaded_token');
      ipcRenderer.removeAllListeners('updated_sequences');
    };
  });

  const handleClose = () => {
    setState({
      ...state,
      showModal: false,
      aboutPage: false,
    });
  };

  const closeApp = () => {
    if (state.aboutPage) {
      dispatch(push(routes.ABOUT));
      ipcRenderer.send('reset_sequence', sequence);
    } else {
      ipcRenderer.send('closed_app', sequence);
    }
    handleClose();
    dispatch(setInit());
  };

  const modalBody = (
    <div className={classes.paper}>
      <div>
        <Alert severity="warning">
          <AlertTitle>WARNING!</AlertTitle>
          <span>
            All sequence data will be lost if you exit before completing the
            creation process. Are you sure you want to exit? creation
          </span>
        </Alert>
      </div>
      <div style={{ textAlign: 'right' }}>
        <Button
          onClick={() => {
            console.log("DELETED APP")
            dispatch(setInit());
            closeApp();
          }}
          color="secondary"
        >
          OK
        </Button>
        <Button onClick={handleClose} color="primary">
          Cancel
        </Button>
      </div>
    </div>
  );
  return (
    <>
      <div>{children}</div>
      <Modal open={state.showModal} onClose={handleClose}>
        {modalBody}
      </Modal>
      <ScriptTag
        isHydrating
        type="text/javascript"
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.GOOGLE_API_KEY}&libraries=places`}
      />
    </>
  );
}
