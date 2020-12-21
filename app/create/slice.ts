import { createSlice } from '@reduxjs/toolkit';
import dayjs from 'dayjs';
// eslint-disable-next-line import/no-cycle
import { AppThunk, RootState } from '../store';
import { IGeoPoint } from '../types/IGeoPoint';

import fs from 'fs';
import path from 'path';
const electron = require('electron');

const initialState = {
  step: {
    current: 'name',
    passed: [],
  },
  steps: {
    name: '',
    description: '',
    type: '',
    method: '',
    methodConfig: {},
    camera: '',
    attachType: '',
    imagePath: '',
    gpx: {
      required: true,
      path: '',
      points: {},
      import: false,
    },
    startTime: '',
    modifyTime: 0,
    modifySpace: {
      frame: 1,
      position: 1,
    },
    outlier: {
      meters: 0,
      mode: '',
    },
    processPage: '',
    azimuth: 0,
    copyright: {
      artist: '',
      copyright: '',
      comment: '',
    },
    tags: [],
    nadirPath: '',
    previewnadir: {
      items: {},
      percentage: 0.15,
      logofile: '',
    },
    blur: false,
    destination: {},
    googlePlace: null,
  },
  points: [],
  passedPoints: {},
  multiPartProcessing: false,
  numberOfDivisions: 1,
  completedDivisions: 0,
  error: null,
  uploadError: false,
  updateResult: {},
  updatePoints: [],
  baseDirectory: ''
};

const createSequenceSlice = createSlice({
  name: 'create',
  initialState: {
    ...initialState,
  },
  reducers: {
    setCurrentStep: (state, { payload }) => {
      const passed =
        state.step.current === 'processPage' || state.step.current === 'gpx'
          ? state.step.passed
          : [
            ...state.step.passed.filter(
              (step) => step !== state.step.current
            ),
            state.step.current,
          ];
      state.step = {
        current: payload,
        passed,
      };

      state.error = null;

      state.passedPoints = {
        ...state.passedPoints,
        [payload]: [...state.points],
      };
    },

    goToPrevStep: (state) => {
      const passedlength = state.step.passed.length;
      if (passedlength) {
        const { current } = state.step;
        state.steps = {
          ...state.steps,
          [current]: initialState.steps[current],
        };
        if (state.step.passed[passedlength - 1] == 'requireModify') {
          fs.writeFileSync(path.join(path.join((electron.app || electron.remote.app).getAppPath(), '../'), 'settings.json'),
            JSON.stringify({
              'modify_gps_spacing': false,
              'remove_outlier': false,
              'modify_heading': false,
              'add_copyright': false,
              'add_nadir': false,
            }));
        }
        state.step = {
          ...state.step,
          current: state.step.passed[passedlength - 1],
          passed: state.step.passed.slice(0, -1),
        };
      }
    },
    setPrevStep: (state) => {
      state.step = {
        ...state.step,
      };
    },
    setName: (state, { payload }) => {
      state.steps.name = payload;
    },
    setDescription: (state, { payload }) => {
      state.steps.description = payload;
    },
    setType: (state, { payload }) => {
      state.steps.type = payload;
    },
    setMethod: (state, { payload }) => {
      state.steps.method = payload.type;
      state.steps.methodConfig = payload;
    },
    setCamera: (state, { payload }) => {
      state.steps.camera = payload;
    },
    setAttachType: (state, { payload }) => {
      state.steps.attachType = payload;
    },
    setImagePath: (state, { payload }) => {
      state.steps.imagePath = payload;
    },
    setGpxPath: (state, { payload }) => {
      state.steps.gpx = {
        ...state.steps.gpx,
        path: payload,
      };
    },
    setGpxRequired: (state, { payload }) => {
      state.steps.gpx = {
        ...state.steps.gpx,
        required: payload,
      };
    },
    setGpxPoints: (state, { payload }) => {
      state.steps.gpx = {
        ...state.steps.gpx,
        points: { ...payload },
      };
    },
    setGpxImport: (state) => {
      state.steps.gpx = {
        ...state.steps.gpx,
        import: true,
      };
    },
    setImportGpxPoints: (state) => {
      state.steps.gpx = {
        ...state.steps.gpx,
        import: true,
      };
    },
    setStartTime: (state, { payload }) => {
      state.steps.startTime = payload;
    },
    setModifyTime: (state, { payload }) => {
      state.steps.modifyTime = payload;
    },
    setAzimuth: (state, { payload }) => {
      state.steps.azimuth = payload;
    },
    setTags: (state, { payload }) => {
      state.steps.tags = payload;
    },
    setNadirPath: (state, { payload }) => {
      state.steps.nadirPath = payload;
    },
    setNadirPercentage: (state, { payload }) => {
      state.steps.previewnadir.percentage = payload;
    },
    setNadirPreview: (state, { payload }) => {
      state.steps.previewnadir = {
        ...state.steps.previewnadir,
        items: payload.items,
        logofile: payload.logofile,
      };
    },
    setProcessStep: (state, { payload }) => {
      state.steps.processPage = payload;
      state.step = {
        ...state.step,
        current: 'processPage',
        passed: [
          ...state.step.passed.filter((step) => step !== state.step.current),
          state.step.current,
        ],
      };
      state.error = null;
    },
    setPoints: (state, { payload }) => {
      state.points = [...payload];
    },

    setModifyPoints: (state, { payload }) => {
      const points = state.points.map((item) => {
        const updatedDate = dayjs(item.GPSDateTime)
          .add(payload, 'second')
          .format('YYYY-MM-DDTHH:mm:ss');
        item.GPSDateTime = updatedDate;
        return item;
      });
      state.points = [...points];
    },

    setOutlierMode: (state, { payload }) => {
      state.steps.outlier = {
        ...state.steps.outlier,
        mode: payload,
      };
    },

    setSmooth: (state) => {
      state.steps.outlier = {
        ...state.steps.outlier,
        mode: 'S',
      };
    },

    setDiscard: (state) => {
      state.steps.outlier = {
        ...state.steps.outlier,
        mode: 'D',
      };
    },
    setOutlierMeters: (state, { payload }) => {
      state.steps.outlier = {
        ...state.steps.outlier,
        meters: payload,
      };
    },
    setFrame: (state, { payload }) => {
      state.steps.modifySpace = {
        ...state.steps.modifySpace,
        frame: payload,
      };
    },
    setPosition: (state, { payload }) => {
      state.steps.modifySpace = {
        ...state.steps.modifySpace,
        position: payload,
      };
    },
    setBlur: (state, { payload }) => {
      state.steps.blur = payload;
    },
    setCopyright: (state, { payload }) => {
      state.steps.copyright = {
        ...payload,
      };
    },
    updateDestination: (state, { payload }) => {
      state.steps.destination = {
        ...state.steps.destination,
        [payload.key]: payload.checked,
      };
    },

    setDestination: (state, { payload }) => {
      state.steps.destination = {
        ...state.steps.destination,
        ...payload,
      };
    },
    setInit: (state) => {
      // state = {
      //   ...initialState,
      // };
      state.step = {
        ...initialState.step,
      };
      state.steps = {
        ...initialState.steps,
      };
      state.points = [];
      state.error = null;
    },
    resetPoints: (state) => {
      state.points = state.passedPoints[state.step.current]
        ? [...state.passedPoints[state.step.current]]
        : [];
    },
    setError: (state, { payload }) => {
      if (!state.error && payload) state.error = payload;
      else if (!payload) state.error = null;
    },
    setUploadError: (state, { payload }) => {
      state.uploadError = payload;
    },
    setUpdateResult: (state, { payload }) => {
      state.updateResult = payload;
    },
    setUpdatePoints: (state, { payload }) => {
      state.updatePoints = payload;
    },
    setBaseDirectory: (state, { payload }) => {
      state.baseDirectory = payload;
    },
    setGooglePlace: (state, { payload }) => {
      state.steps.googlePlace = payload;
    },
    setMultiPartProcessingMode: (state, { payload }) => {
      state.multiPartProcessing = payload;
    },
    setNumberOfDivisions: (state, { payload }) => {
      state.numberOfDivisions = payload;
    },
    setCompletedDivisions: (state, { payload }) => {
      state.completedDivisions = payload;
    },
  },
});

export const {
  setName,
  setPrevStep,
  setDescription,
  setType,
  setMethod,
  setCamera,
  setAttachType,
  setCurrentStep,
  goToPrevStep,
  setImagePath,
  setGpxPath,
  setGpxRequired,
  setGpxImport,
  setStartTime,
  setModifyTime,
  setAzimuth,
  setTags,
  setNadirPath,
  setNadirPreview,
  setNadirPercentage,
  setProcessStep,
  setPoints,
  setGpxPoints,
  setModifyPoints,
  setOutlierMode,
  setDiscard,
  setSmooth,
  setOutlierMeters,
  setFrame,
  setPosition,
  setInit,
  setError,
  setBlur,
  updateDestination,
  setDestination,
  setCopyright,
  setUploadError,
  setUpdateResult,
  setUpdatePoints,
  setBaseDirectory,
  setGooglePlace,
  setMultiPartProcessingMode,
  setNumberOfDivisions,
  setCompletedDivisions,
  resetPoints,
} = createSequenceSlice.actions;

export const setSequenceName = (name: string): AppThunk => {
  return (dispatch) => {
    dispatch(setName(name));
    dispatch(setCurrentStep('description'));
  };
};

export const setSequenceDescription = (description: string): AppThunk => {
  return (dispatch) => {
    dispatch(setDescription(description));
    dispatch(setCurrentStep('tags'));
  };
};

export const setSequenceType = (type: string): AppThunk => {
  return (dispatch) => {
    dispatch(setType(type));
    dispatch(setCurrentStep('method'));
  };
};

export const setSequenceMethod = (method: any): AppThunk => {
  return (dispatch) => {
    dispatch(setMethod(method));
    dispatch(setCurrentStep('camera'));
  };
};

export const setSequenceCamera = (camera: string): AppThunk => {
  return (dispatch) => {
    dispatch(setCamera(camera));
    dispatch(setCurrentStep('attachType'));
  };
};

export const setSequenceAttachType = (attachType: string): AppThunk => {
  return (dispatch) => {
    dispatch(setAttachType(attachType));
    dispatch(setCurrentStep('imagePath'));
  };
};

export const setSequenceImagePath = (uploadPath: string): AppThunk => {
  return (dispatch) => {
    dispatch(setImagePath(uploadPath));
    dispatch(setProcessStep('gpx'));
  };
};

export const setSequenceGpxPath = (uploadPath: string): AppThunk => {
  return (dispatch) => {
    dispatch(setGpxPath(uploadPath));
  };
};

export const setSequenceStartTime = (startTime: string): AppThunk => {
  return (dispatch) => {
    dispatch(setStartTime(startTime));
  };
};

export const setSequenceAzimuth = (azimuth: number): AppThunk => {
  return (dispatch) => {
    dispatch(setAzimuth(azimuth));
  };
};

export const setSequenceNadirPath = (paths: string): AppThunk => {
  return (dispatch) => {
    dispatch(setNadirPath(paths));
  };
};

export const setSequenceTags = (tags: string[]): AppThunk => {
  return (dispatch) => {
    dispatch(setTags(tags));
  };
};

export const setSequencePoints = (points: IGeoPoint[]): AppThunk => {
  return (dispatch) => {
    dispatch(setPoints(points));
  };
};

export const setSequenceGpxPoints = (points: any): AppThunk => {
  return (dispatch) => {
    dispatch(setGpxPoints(points));
    dispatch(setCurrentStep('startTime'));
  };
};

export const setSequenceGpxImport = (): AppThunk => {
  return (dispatch) => {
    dispatch(setGpxImport());
  };
};

export const setSequenceSmooth = (): AppThunk => {
  return (dispatch) => {
    dispatch(setSmooth());
  };
};

export const setSequenceDiscard = (): AppThunk => {
  return (dispatch) => {
    dispatch(setDiscard());
  };
};

export const setSequenceOutlierMeters = (meters: number): AppThunk => {
  return (dispatch) => {
    dispatch(setOutlierMeters(meters));
  };
};

export const setSequenceFrame = (frame: number): AppThunk => {
  return (dispatch) => {
    dispatch(setFrame(frame));
  };
};

export const setSequencePosition = (position: number): AppThunk => {
  return (dispatch) => {
    dispatch(setPosition(position));
  };
};

export const setSequenceInit = (): AppThunk => {
  return (dispatch) => {
    dispatch(setInit());
  };
};

export const setSequenceError = (error: any): AppThunk => {
  return (dispatch, getState) => {
    const state = getState();
    if (state.create.step.current === 'processPage') {
      // dispatch(goToPrevStep());
      // dispatch(setUploadError());
    }
    dispatch(setError(error));
  };
};

export const setSequenceUploadError = (error: any, result: any, points: IGeoPoint[], dir: string): AppThunk => {
  return (dispatch) => {
    dispatch(setError(error));
    dispatch(setUploadError((error ? true : false)));
    dispatch(setUpdateResult(result));
    dispatch(setUpdatePoints(points));
    dispatch(setBaseDirectory(dir));
  };
};

export const setSequenceModifyTime = (modifyTime: number): AppThunk => {
  return (dispatch) => {
    dispatch(setModifyTime(modifyTime));
  };
};

export default createSequenceSlice.reducer;

export const selSequenceName = (state: RootState) => state.create.steps.name;

export const selSequenceDescription = (state: RootState) =>
  state.create.steps.description;

export const selSequenceType = (state: RootState) => state.create.steps.type;

export const selSequenceMethod = (state: RootState) =>
  state.create.steps.method;

export const selSequenceMethodConfig = (state: RootState) =>
  state.create.steps.methodConfig;

export const selSequenceCamera = (state: RootState) =>
  state.create.steps.camera;

export const selSequenceAttachType = (state: RootState) =>
  state.create.steps.attachType;

export const selPrevStep = (state: RootState) => {
  const passedlength = state.create.step.passed.length;
  return passedlength ? state.create.step.passed[passedlength - 1] : '';
};

export const selGPXRequired = (state: RootState) =>
  state.create.points.filter(
    (point: IGeoPoint) => {
      return typeof point.GPSDateTime === 'undefined' && point.DateTimeOriginal === 'undefined'
    }
  ).length > 0;

export const selGPXImport = (state: RootState) => state.create.steps.gpx.import;

export const selGPXPoints = (state: RootState) => state.create.steps.gpx.points;

export const selStartTime = (state: RootState) =>
  state.create.points.length ? state.create.points[0].DateTimeOriginal : null;

export const selGPXStartTime = (state: RootState) =>
  Object.keys(state.create.steps.gpx.points).length
    ? Object.keys(state.create.steps.gpx.points)[0]
    : null;

export const selModifyTime = (state: RootState) =>
  state.create.steps.modifyTime;

export const selModifiedStartTime = (state: RootState) => {
  const startTime = selStartTime(state);
  const modifyTime = selModifyTime(state);
  if (startTime) {
    return dayjs(startTime)
      .add(modifyTime, 'second')
      .format('YYYY-MM-DDTHH:mm:ss');
  }
  return null;
};

export const selFirstMatchedPoints = (state: RootState) => {
  const gpxPoints = selGPXPoints(state);

  const startTime = selModifiedStartTime(state);

  if (startTime && startTime in gpxPoints) return gpxPoints[startTime];
  return null;
};

export const selSequenceTags = (state: RootState) => state.create.steps.tags;

export const selPoints = (state: RootState) => state.create.points;

export const selProcessPageNext = (state: RootState) => {
  return state.create.steps.processPage;
};

export const selPreviewNadir = (state: RootState) =>
  state.create.steps.previewnadir.items;

export const selPreviewNadirPercentage = (state: RootState) =>
  state.create.steps.previewnadir.percentage;

export const selCurrentStep = (state: RootState) => state.create.step.current;

export const selSequence = (state: RootState) => state.create;

export const selSequenceOutlierMeter = (state: RootState) =>
  state.create.steps.outlier.meters;

export const selSequenceOutlierMode = (state: RootState) =>
  state.create.steps.outlier.mode;

export const selSequenceFrame = (state: RootState) =>
  state.create.steps.modifySpace.frame;

export const selSequencePosition = (state: RootState) =>
  state.create.steps.modifySpace.position;

export const selSequenceAzimuth = (state: RootState) =>
  state.create.steps.azimuth;

export const selError = (state: RootState) => state.create.error;

export const selUploadError = (state: RootState) => state.create.uploadError;

export const selUpdateResult = (state: RootState) => state.create.updateResult;

export const selUpdatePoints = (state: RootState) => state.create.updatePoints;

export const selBaseDirectory = (state: RootState) => state.create.baseDirectory;

export const selBlur = (state: RootState) => state.create.steps.blur;

export const selDestination = (state: RootState) =>
  state.create.steps.destination;

export const selCopyright = (state: RootState) =>
  state.create.steps.copyright.copyright;

export const selArtist = (state: RootState) =>
  state.create.steps.copyright.artist;

export const selComment = (state: RootState) =>
  state.create.steps.copyright.comment;

export const isRequiredNadir = (state: RootState) =>
  state.create.points.filter((point: IGeoPoint) => !point.equirectangular)
    .length === 0 && state.create.points.length;

export const selGooglePlace = (state: RootState) =>
  state.create.steps.googlePlace;

export const isMultiPartProcessing = (state: RootState) =>
  state.create.multiPartProcessing;

export const selNumberOfDivisions = (state: RootState) =>
  state.create.numberOfDivisions;

export const selCompletedDivisions = (state: RootState) =>
  state.create.completedDivisions;
