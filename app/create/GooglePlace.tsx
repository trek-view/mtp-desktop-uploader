import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Autocomplete from 'react-google-autocomplete';
import { makeStyles } from '@material-ui/core/styles';

import Typography from '@material-ui/core/Typography';
import Grid from '@material-ui/core/Grid';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import Button from '@material-ui/core/Button';
import { grey } from '@material-ui/core/colors';

import { setGooglePlace, selSequence, setProcessStep, setNumberOfDivisions } from './slice';

interface State {
  googlePlace: string | null;
}

const { ipcRenderer } = window.require('electron');

const useStyles = makeStyles((theme) => ({
  placeWrapper: {
    width: '90%',
    borderRadius: 4,
    borderColor: grey[500],
    borderWidth: 1,
    fontSize: '1rem',
    padding: theme.spacing(2),
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

export default function GooglePlace() {
  const [state, setState] = useState<State>({
    googlePlace: null,
  });
  const dispatch = useDispatch();
  let sequence = useSelector(selSequence);
  const classes = useStyles();
  const handleChange = (place) => {
    setState({
      googlePlace: place.place_id,
    });
  };

  const confirmMode = () => {
    if (state.googlePlace) dispatch(setGooglePlace(state.googlePlace));

    sequence = {
      ...sequence,
      steps: {
        ...sequence.steps,
        googlePlace: state.googlePlace,
      }
    };

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
  };

  return (
    <>
      <Grid item xs={12}>
        <Typography variant="h6" align="center" color="textSecondary">
          How would you select the place for your sequence?
        </Typography>
      </Grid>
      <Grid item xs={12}>
        <Autocomplete
          style={{ width: '90%' }}
          className={classes.placeWrapper}
          onPlaceSelected={handleChange}
          types={['(regions)']}
        />
      </Grid>
      <Grid item xs={12}>
        <Button
          endIcon={<ChevronRightIcon />}
          color="primary"
          onClick={confirmMode}
          variant="contained"
        >
          {state.googlePlace ? 'Confirm Changes' : 'Skip the Step'}
        </Button>
      </Grid>
    </>
  );
}
