import React from 'react';
import { Button, Typography, Box } from '@material-ui/core';
import ChevronRightOutlinedIcon from '@material-ui/icons/ChevronRightRounded';
import { makeStyles } from '@material-ui/core/styles';
import { useDispatch } from 'react-redux';
import { push } from 'connected-react-router';
import routes from '../constants/routes.json';

import Logo from './Logo';
import { CheckBox } from '@material-ui/icons';

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

export default function Setting() {
  const classes = useStyles();
  const dispatch = useDispatch();

  const goToListPage = () => {
    dispatch(push(routes.LIST));
  };

  return (
    <>
      <div className={classes.content}>
        <div>
          <Logo />
        </div>

        <Typography variant="h6" align="center" color="textSecondary">
          Settings
        </Typography>
        <Box>
          <Typography paragraph>
            Please select upload settings can be skipped:
          </Typography>
          <Box>
            <CheckBox>Modify GPS Spacing</CheckBox>
            <CheckBox>Remove Outlier</CheckBox>
            <CheckBox>Modify Heading</CheckBox>
            <CheckBox>Add Copyright</CheckBox>
            <CheckBox>Add Nadir</CheckBox>
          </Box>
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
