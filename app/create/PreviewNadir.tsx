import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import {
  Slider,
  Typography,
  Grid,
  Input,
  Button,
  Box,
} from '@material-ui/core';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import ReactPannellum from 'react-pannellum';
import { makeStyles } from '@material-ui/core/styles';

import {
  setCurrentStep,
  selPreviewNadir,
  selPreviewNadirPercentage,
  setNadirPercentage,
} from './slice';

const useStyles = makeStyles((theme) => ({
  sliderHeader: {
    width: 200,
  },
  slider: {
    width: 180,
  },
  sliderInput: {
    width: 42,
  },
  sliderWrapper: {
    display: 'flex',
    flexWrap: 'nowrap',
    alignItems: 'center',
    '& > *': {
      margin: theme.spacing(1),
    },
  },
  info: {
    color: 'grey',
    width: '100%',
  },
}));

interface State {
  percentage: number;
}

export default function SequencePreviewNadir() {
  const dispatch = useDispatch();
  const items = useSelector(selPreviewNadir);
  const percentage = useSelector(selPreviewNadirPercentage);
  const classes = useStyles();
  const [state, setState] = useState<State>({
    percentage,
  });

  const resetMode = () => {
    dispatch(setCurrentStep('nadir'));
  };

  const confirmMode = () => {
    dispatch(setNadirPercentage(state.percentage));
    dispatch(setCurrentStep('blur'));
  };

  const handlePercentageSliderChange = (
    _event: React.ChangeEvent,
    newValue: number
  ) => {
    setState({
      percentage: newValue,
    });
  };

  const handlePercentageChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setState({
      percentage: parseFloat(event.target.value),
    });
  };
  return (
    <>
      <Grid item xs={12}>
        <Typography variant="h6" align="center" color="textSecondary">
          Preview Nadir
        </Typography>
        <Typography variant="h6" align="center" color="textSecondary">
          Here’s an example of how your nadir will appear
        </Typography>
      </Grid>
      <Grid item xs={12} className={classes.sliderWrapper}>
        <Typography align="right" className={classes.sliderHeader}>
          Percentage of Height
        </Typography>
        <Slider
          value={state.percentage}
          onChange={handlePercentageSliderChange}
          aria-labelledby="input-slider"
          step={0.01}
          min={0.1}
          max={0.25}
          className={classes.slider}
        />
        <Input
          style={{ width: 50 }}
          value={state.percentage}
          margin="dense"
          onChange={handlePercentageChange}
          inputProps={{
            step: 0.01,
            min: 0.1,
            max: 0.25,
            type: 'number',
            'aria-labelledby': 'input-slider',
          }}
        />
      </Grid>
      <Grid item xs={12}>
        {Object.keys(items)
          .filter((key) => key === state.percentage.toString())
          .map((key) => {
            return (
              <ReactPannellum
                key={key}
                imageSource={items[key]}
                id={key}
                sceneId={key}
                config={{
                  autoLoad: true,
                }}
                style={{
                  width: '100%',
                  height: 500,
                }}
              />
            );
          })}
      </Grid>
      <Grid item xs={12}>
        <Box mr={1} display="inline-block">
          <Button
            endIcon={<ChevronRightIcon />}
            color="secondary"
            onClick={resetMode}
            variant="contained"
          >
            Use other nadir
          </Button>
        </Box>
        <Button
          endIcon={<ChevronRightIcon />}
          color="primary"
          onClick={confirmMode}
          variant="contained"
        >
          Confirm nadir
        </Button>
      </Grid>
    </>
  );
}
