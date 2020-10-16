import React from 'react';
import { Button, Typography, Box, Link, FormGroup, FormControlLabel, Container } from '@material-ui/core';
import ChevronRightOutlinedIcon from '@material-ui/icons/ChevronRightRounded';
import { makeStyles } from '@material-ui/core/styles';
import { useDispatch } from 'react-redux';
import { push } from 'connected-react-router';
import { shell } from 'electron';
import routes from '../constants/routes.json';

import Logo from './Logo';

import Checkbox from '@material-ui/core/Checkbox';
import fs from 'fs';
import path from 'path';
const electron = require('electron');

const useStyles = makeStyles((theme) => ({
  content: {
    width: '100%',
    height: '100%',
    display: 'flex',
    position: 'absolute',
    alignItems: 'baseline',
    justifyContent: 'center',
    flexWrap: 'wrap',
    left: '-8px',
    top: '-8px',
    '& > * ': {
      width: '100%',
      textAlign: 'center',
      marginBottom: 0,
    },
  },
  linksWrapper: {
    marginBottom: theme.spacing(2),
    '& > *': {
      padding: theme.spacing(1),
    },
  },
}));

export default function About() {
  const classes = useStyles();
  const dispatch = useDispatch();

  const [state, setState] = React.useState({
    modify_gps_spacing: false,
    remove_outlier: false,
    modify_heading: false,
    add_copyright: false,
    add_nadir: false,
  });

  const handleChange = (event: { target: { name: any; checked: any; }; }) => {
    
    setState({ ...state, [event.target.name]: event.target.checked });

    setTimeout(() => {
      fs.writeFileSync(path.join(path.join((electron.app || electron.remote.app).getAppPath(), '../'), 'settings.json'), 
        JSON.stringify({
          modify_gps_spacing: state.modify_gps_spacing,
          remove_outlier: state.remove_outlier,
          modify_heading: state.modify_heading,
          add_copyright: state.add_copyright,
          add_nadir: state.add_nadir,
        })
      );
    }, 1000);
  };

  const goToListPage = () => {
    dispatch(push(routes.LIST));
  };

  const gotoExternal = (url: string) => {
    shell.openExternal(url);
  };

  return (
    <>
      <div className={classes.content}>
        <div>
          <Logo />
        </div>

        <Typography variant="h6" align="center" color="textSecondary">
          About
        </Typography>
        <Box>
          <Typography paragraph>
            Map the Paths Desktop Uploader is maintained by the team at Trek
            View.
          </Typography>
          <Typography paragraph>
            The code is available on Github under an MIT license.
          </Typography>
          <Typography paragraph>
            This software uses the following open-source tools:
          </Typography>
          <Box className={classes.linksWrapper}>
            <Link
              component="button"
              onClick={() => gotoExternal('https://ffmpeg.org/')}
            >
              ffmpeg
            </Link>
            <Link
              component="button"
              onClick={() => gotoExternal('http://exiftool.org/')}
            >
              exiftool
            </Link>
            <Link
              component="button"
              onClick={() => gotoExternal('https://imagemagick.org/index.php')}
            >
              imagemagick
            </Link>
          </Box>
          <Typography paragraph>
            To find out more, go to Map the Paths.
          </Typography>
        </Box>
        <Box>
        <Typography variant="h6" align="center" color="textSecondary">
          Settings
        </Typography>
        <Box>
          <Typography paragraph>
            Please select upload settings can be skipped:
          </Typography>
          <Container maxWidth="sm">
            <FormGroup>
              <FormControlLabel control={<Checkbox checked={state.modify_gps_spacing} onChange={handleChange} name="modify_gps_spacing" color="primary"/>} label="Modify GPS Spacing"/>
            </FormGroup>
            <FormGroup>
              <FormControlLabel control={<Checkbox checked={state.remove_outlier} onChange={handleChange} name="remove_outlier" color="primary"/>} label="Remove Outlier"/>
            </FormGroup>
            <FormGroup>
              <FormControlLabel control={<Checkbox checked={state.modify_heading} onChange={handleChange} name="modify_heading" color="primary"/>} label="Modify Heading"/>
            </FormGroup>
            <FormGroup>
              <FormControlLabel control={<Checkbox checked={state.add_copyright} onChange={handleChange} name="add_copyright" color="primary"/>} label="Add Copyright"/>
            </FormGroup>
            <FormGroup>
              <FormControlLabel control={<Checkbox checked={state.add_nadir} onChange={handleChange} name="add_nadir" color="primary"/>} label="Add Nadir"/>
            </FormGroup>
          </Container>
        </Box>
          <Button
            onClick={goToListPage}
            endIcon={<ChevronRightOutlinedIcon />}
            color="primary"
            variant="contained"
          >
            Back to List
          </Button>
        </Box>
      </div>
    </>
  );
}
