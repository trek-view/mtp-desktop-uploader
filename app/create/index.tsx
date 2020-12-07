import React, { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { useDispatch, useSelector } from 'react-redux';

import { push } from 'connected-react-router';

import { Create as CreateIcon, List as ListIcon } from '@material-ui/icons';

import {
  Modal,
  Button,
  IconButton,
  Box,
  Grid,
  ListItemText,
  ListItemIcon,
  ListItem,
  List,
  Drawer,
} from '@material-ui/core';

import { Alert, AlertTitle } from '@material-ui/lab';

import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';

import { IpcRendererEvent } from 'electron';

import Name from './Name';
import Description from './Description';
import Type from './Type';
import Camera from './Camera';
import Method from './Method';
import AttachType from './AttachType';
import UploadImage from './UploadImage';
import UploadGpx from './UploadGpx';
import StartTime from './StartTime';
import ModifyTime from './ModifyTime';
import ModifySpace from './ModifySpace';
import ModifyOutlier from './ModifyOutlier';
import ModifyAzimuth from './ModifyAzimuth';
import Tags from './Tags';
import Nadir from './Nadir';
import UploadNadir from './UploadNadir';
import PreviewNadir from './PreviewNadir';
import ProcessPage from './ProcessPage';
import DestinationPage from './Destination';
import DestinationLoginPage from './DestinationLogin';
import Copyright from './Copyright';
import Final from './Final';

import routes from '../constants/routes.json';
import {
  selNumberOfDivisions,
  selCompletedDivisions,
  selSequenceName,
  selPrevStep,
  selCurrentStep,
  goToPrevStep,
  setSequencePoints,
  setSequenceGpxPoints,
  setCurrentStep,
  setSequenceError,
  setSequenceUploadError,
  selError,
  setError,
  setInit,
  selSequence,
  setCompletedDivisions,
} from './slice';

import { setAddSeq } from '../list/slice';
import Logo from '../components/Logo';
import Wrapper from '../components/Wrapper';
import RequireModify from './RequireModify';
import GooglePlace from './GooglePlace';
import { getSequenceBasePath, removeDirectory } from '../scripts/utils';

const { ipcRenderer } = window.require('electron');

const drawerWidth = 300;

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
  },

  drawerPaper: {
    width: drawerWidth,
    padding: 8,
  },

  gridContainer: {
    '& > *': {
      marginBottom: theme.spacing(2),
    },
  },

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
}

export default function CreatePageWrapper() {
  const classes = useStyles();
  const prevStep = useSelector(selPrevStep);
  const currentStep = useSelector(selCurrentStep);
  const name = useSelector(selSequenceName);
  const sequence = useSelector(selSequence);
  const numberOfDivisions = useSelector(selNumberOfDivisions);
  const completedDivisions = useSelector(selCompletedDivisions);
  const error = useSelector(selError);
  const dispatch = useDispatch();
  const [state, setState] = useState<State>({
    showModal: false,
  });

  const goPrevStep = () => {
    dispatch(goToPrevStep());
    dispatch(setError(null));
  };

  useEffect(() => {
    ipcRenderer.on('loaded_points', (_event: IpcRendererEvent, points) => {
      if (points.length) {
        dispatch(setSequencePoints(points));
      } else {
        dispatch(setSequenceError('Cannot read points data from the files.'));
      }
    });

    ipcRenderer.on('add-seq', (_event: IpcRendererEvent, seq, originalSequenceName, basepath) => {
      // dispatch(set)
      dispatch(setAddSeq(seq));
      let completed = completedDivisions + 1;
      console.log("Completed " + completed + " out of " + numberOfDivisions);
      if (completed >= numberOfDivisions) {
        if (numberOfDivisions > 1) {
          removeDirectory(getSequenceBasePath(originalSequenceName, basepath));
        }
        dispatch(setCurrentStep('final'));
      }
      dispatch(setCompletedDivisions(completed));
    });

    ipcRenderer.on('loaded_gpx', (_event: IpcRendererEvent, points) => {
      dispatch(setSequenceGpxPoints(points));
    });

    ipcRenderer.on('error', (_event: IpcRendererEvent, err) => {
      dispatch(setSequenceError(err));
    });

    ipcRenderer.on('upload_error', (_event: IpcRendererEvent, err, result, points, directory) => {
      dispatch(setSequenceUploadError(err, result, points, directory));
    });

    return () => {
      ipcRenderer.removeAllListeners('loaded_points');
      ipcRenderer.removeAllListeners('loaded_gpx');
      ipcRenderer.removeAllListeners('add-seq');
      ipcRenderer.removeAllListeners('error');
    };
  });

  const gotoListPage = () => {
    if (name === '') {
      dispatch(push(routes.LIST));
    } else {
      setState({
        showModal: true,
      });
    }
  };

  const handleClose = () => {
    setState({
      showModal: false,
    });
  };

  const handleRemove = () => {
    dispatch(setInit());
    dispatch(push(routes.LIST));
    ipcRenderer.send('reset_sequence', sequence);
  };

  const modalBody = (
    <div className={classes.paper}>
      <div>
        <Alert severity="warning">
          <AlertTitle>WARNING!</AlertTitle>
          <span>
            All sequence data will be lost if you exit before completing the
            creation process. Are you sure you want to exit?
          </span>
        </Alert>
      </div>
      <div style={{ textAlign: 'right' }}>
        <Button onClick={handleRemove} color="secondary">
          OK
        </Button>
        <Button onClick={handleClose} color="primary">
          Cancel
        </Button>
      </div>
    </div>
  );

  return (
    <div>
      <Drawer
        open
        variant="persistent"
        anchor="left"
        classes={{
          paper: classes.drawerPaper,
        }}
      >
        <Logo />
        <List>
          <ListItem button>
            <ListItemIcon>
              <CreateIcon />
            </ListItemIcon>
            <ListItemText>Create Sequence</ListItemText>
          </ListItem>
          <ListItem button component="a" onClick={gotoListPage}>
            <ListItemIcon>
              <ListIcon />
            </ListItemIcon>
            <ListItemText>My Sequences</ListItemText>
          </ListItem>
        </List>
      </Drawer>
      <Wrapper title="Create Sequence">
        <Grid
          container
          alignItems="center"
          style={{
            paddingTop: '30px',
            paddingBottom: '30px',
          }}
          className={classes.gridContainer}
        >
          {prevStep !== '' && currentStep !== 'processPage' && (
            <Box position="absolute" top={20} left={20} zIndex="modal">
              <IconButton onClick={goPrevStep}>
                <ChevronLeftIcon />
              </IconButton>
            </Box>
          )}

          {error && (
            <Grid xs={12} item>
              <Alert severity="error">
                <AlertTitle>Error</AlertTitle>
                <span>{error}</span>
              </Alert>
            </Grid>
          )}

          {currentStep === 'name' && <Name />}
          {currentStep === 'description' && <Description />}
          {currentStep === 'type' && <Type />}
          {currentStep === 'method' && <Method />}
          {currentStep === 'camera' && <Camera />}
          {currentStep === 'attachType' && <AttachType />}
          {currentStep === 'imagePath' && <UploadImage />}
          {currentStep === 'gpx' && <UploadGpx />}
          {currentStep === 'startTime' && <StartTime />}
          {currentStep === 'modifyTime' && <ModifyTime />}
          {currentStep === 'requireModify' && <RequireModify />}
          {currentStep === 'modifySpace' && <ModifySpace />}
          {currentStep === 'outlier' && <ModifyOutlier />}
          {currentStep === 'azimuth' && <ModifyAzimuth />}
          {currentStep === 'copyright' && <Copyright />}
          {currentStep === 'tags' && <Tags />}
          {currentStep === 'nadir' && <Nadir />}
          {currentStep === 'nadirPath' && <UploadNadir />}
          {currentStep === 'previewNadir' && <PreviewNadir />}
          {currentStep === 'processPage' && <ProcessPage />}
          {currentStep === 'destination' && <DestinationPage />}
          {currentStep === 'destination_login' && <DestinationLoginPage />}
          {currentStep === 'google_place' && <GooglePlace />}
          {currentStep === 'final' && <Final />}
        </Grid>
        <Modal open={state.showModal} onClose={handleClose}>
          {modalBody}
        </Modal>
      </Wrapper>
    </div>
  );
}
