import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import Typography from '@material-ui/core/Typography';
import { Grid, Button, Box, TextField } from '@material-ui/core';

import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import { makeStyles } from '@material-ui/core/styles';

import {
  selComment,
  selCopyright,
  selArtist,
  setCopyright,
  setCurrentStep,
  isRequiredNadir,
} from './slice';

import fs from 'fs';
import path from 'path';
const electron = require('electron');

interface State {
  comment: string;
  copyright: string;
  artist: string;
}

const useStyles = makeStyles((theme) => ({
  wrapper: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    '& > *': {
      margin: theme.spacing(2),
    },
  },
}));

export default function Copyright() {
  const dispatch = useDispatch();

  const propcomment = useSelector(selComment);
  const propcopyright = useSelector(selCopyright);
  const propartist = useSelector(selArtist);
  const isrequirednadir = useSelector(isRequiredNadir);
  const classes = useStyles();

  const [state, setState] = React.useState<State>({
    comment: propcomment,
    copyright: propcopyright,
    artist: propartist,
  });

  const { comment, copyright, artist } = state;

  const handleChange = (key: string, value: string) => {
    setState({
      ...state,
      [key]: value,
    });
  };

  const resetMode = () => {
    setState({
      ...state,
      comment: '',
      copyright: '',
      artist: '',
    });
  };

  const confirmMode = () => {
    dispatch(setCopyright(state));
    fs.readFile(path.join(path.join((electron.app || electron.remote.app).getAppPath(), '../'), 'settings.json'), 'utf8', (error, data) => {
      if (error) {
        console.log(error);
        dispatch(setCurrentStep('nadir'));
        return;
      }
      var settings = JSON.parse(data);
      if (settings.add_nadir === true) {
        dispatch(setCurrentStep('nadir'));
      } else {
        dispatch(setCurrentStep('destination'));
      }
    });
  };

  return (
    <>
      <Grid item xs={12}>
        <Typography variant="h6" align="center" color="textSecondary">
          Copyright
        </Typography>
        <Typography paragraph>
          The following values will be written into the EXIF fields of the image. It's a good place to put your name, should someone need to contact you about using the image. 
        </Typography>
      </Grid>
      <Grid item xs={12} className={classes.wrapper}>
        <TextField
          id="outlined-basic"
          label="Artist"
          fullWidth
          variant="outlined"
          multiline
          value={artist}
          onChange={(e) => handleChange('artist', e.target.value)}
        />
        <TextField
          id="outlined-basic"
          label="Copyright"
          fullWidth
          variant="outlined"
          multiline
          value={copyright}
          onChange={(e) => handleChange('copyright', e.target.value)}
        />
        <TextField
          id="outlined-basic"
          label="User Comment"
          fullWidth
          variant="outlined"
          multiline
          value={comment}
          onChange={(e) => handleChange('comment', e.target.value)}
        />
      </Grid>
      <Grid item xs={12}>
        <Box mr={1} display="inline-block">
          <Button
            endIcon={<ChevronRightIcon />}
            color="secondary"
            onClick={resetMode}
            variant="contained"
          >
            Reset Changes
          </Button>
        </Box>
        <Button
          endIcon={<ChevronRightIcon />}
          color="primary"
          onClick={confirmMode}
          variant="contained"
        >
          {`${
            Object.keys(state).filter((key: string) => state[key] !== '')
              .length === 0
              ? 'Skip This Step'
              : 'Confirm Changes'
          }`}
        </Button>
      </Grid>
    </>
  );
}
