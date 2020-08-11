import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
  Typography,
  Grid,
  Button,
  FormControlLabel,
  Checkbox,
} from '@material-ui/core';

import ChevronRightIcon from '@material-ui/icons/ChevronRight';

import { selBlur, selSequence, setProcessStep, setBlur } from './slice';

const { ipcRenderer } = window.require('electron');

export default function SequenceBur() {
  const dispatch = useDispatch();
  const blurred = useSelector(selBlur);
  const sequence = useSelector(selSequence);

  const confirmMode = () => {
    dispatch(setProcessStep('name'));
    ipcRenderer.send('update_images', sequence);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setBlur(event.target.checked));
  };

  return (
    <>
      <Grid item xs={12}>
        <Typography variant="h6" align="center" color="textSecondary">
          Do you want to get the blurred images too?
        </Typography>
      </Grid>
      <Grid item xs={12}>
        <FormControlLabel
          color="primary"
          control={(
            <Checkbox
              checked={blurred}
              onChange={handleChange}
              name="checkedB"
              color="primary"
            />
          )}
          label="Blur"
        />
      </Grid>
      <Grid item xs={12}>
        <Button
          endIcon={<ChevronRightIcon />}
          color="primary"
          onClick={confirmMode}
          variant="contained"
        >
          Confirm Mods
        </Button>
      </Grid>
    </>
  );
}