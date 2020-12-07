import React, { useEffect, useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import Typography from '@material-ui/core/Typography';
import Grid from '@material-ui/core/Grid';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import Button from '@material-ui/core/Button';

import LinearProgress from '@material-ui/core/LinearProgress';
import { IpcRendererEvent } from 'electron';
import {
  selSequence,
  selSequenceName,
  selProcessPageNext,
  setCurrentStep,
  setNadirPreview,
  selBaseDirectory,
  selUpdateResult,
  selUpdatePoints,
  setError,
  selUploadError
} from './slice';

import { selBasePath } from '../base/slice';
import { setUploadError } from './slice';

import { getSequenceBasePath } from '../scripts/utils';

const { ipcRenderer } = window.require('electron');

interface State {
  message: string | null;
}

export default function SequenceProcessPage() {
  const nextStep = useSelector(selProcessPageNext);
  let name = useSelector(selSequenceName);
  const basepath = useSelector(selBasePath);
  const dispatch = useDispatch();
  const res_json = useSelector(selUpdateResult);
  const updatePoints = useSelector(selUpdatePoints);
  const base_dir = useSelector(selBaseDirectory);
  const uploadError = useSelector(selUploadError);

  const [state, setState] = useState<State>({
    message: null,
  });
  name = getSequenceBasePath(
    name,
    basepath
  );
  const sequence = useSelector(selSequence);
  if (sequence.multiPartProcessing == true) {
    name = name + "_part_$ ($: index of each part)";
  }

  useEffect(() => {
    ipcRenderer.on('finish', (_event: IpcRendererEvent) => {
      setState({
        ...state,
        message: null,
      });
      if (nextStep !== '') {
        dispatch(setCurrentStep(nextStep));
      }
    });

    ipcRenderer.on(
      'loaded_preview_nadir',
      (_event: IpcRendererEvent, preview: any) => {
        dispatch(setNadirPreview(preview));
        dispatch(setCurrentStep('previewNadir'));
      }
    );

    ipcRenderer.on(
      'loaded_message',
      (_event: IpcRendererEvent, msg: string) => {
        setState({
          message: msg,
        });
      }
    );

    return () => {
      ipcRenderer.removeAllListeners('finish');
      ipcRenderer.removeAllListeners('loaded_message');
      ipcRenderer.removeAllListeners('loaded_preview_nadir');
    };
  });

  const resumeMode = () => {
    dispatch(setError(null));
    dispatch(setUploadError(false));
    ipcRenderer.send('resume_images', sequence, res_json, updatePoints, base_dir);
  };

  return (
    <>
      { !uploadError &&
        <>
          <Grid item xs={12}>
            <Typography variant="h6" align="center" color="textSecondary">
              Processing
            </Typography>
          </Grid>
          <Grid item xs={12}>
            {state.message && (
              <Typography variant="caption" align="center" color="textPrimary">
                {state.message}
              </Typography>
            )}
          </Grid>
          <Grid item xs={12}>
            <LinearProgress />
          </Grid>
          <Grid item xs={12}>
            <Typography align="center" color="textSecondary">
              Keep the app open during processing.
            </Typography>
          </Grid>
          <Grid item xs={12}>
            {nextStep === 'final' && (
              <Typography align="center" color="textSecondary">
                {`Output can be viewed in [${name}] once complete`}
              </Typography>
            )}
          </Grid>
        </>
      }
      { uploadError &&
        <Grid item xs={12}>
          <Button
            endIcon={<PlayArrowIcon />}
            color="primary"
            onClick={resumeMode}
            variant="contained"
          >
            Resume Upload
        </Button>
        </Grid>
      }
    </>
  );
}
