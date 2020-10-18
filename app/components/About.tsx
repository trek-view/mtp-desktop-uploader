import React from 'react';
import { Button, Typography, Box, Link } from '@material-ui/core';
import ChevronRightOutlinedIcon from '@material-ui/icons/ChevronRightRounded';
import { makeStyles } from '@material-ui/core/styles';
import { useDispatch } from 'react-redux';
import { push } from 'connected-react-router';
import { shell } from 'electron';
import routes from '../constants/routes.json';

import Logo from './Logo';

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
