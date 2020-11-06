import React from 'react';
import { useDispatch } from 'react-redux';

import Typography from '@material-ui/core/Typography';
import Grid from '@material-ui/core/Grid';
import Button from '@material-ui/core/Button';
import ListIcon from '@material-ui/icons/List';
import { push } from 'connected-react-router';
import { setCompletedDivisions, setSequenceInit } from './slice';

import routes from '../constants/routes.json';

export default function Final() {
  const dispatch = useDispatch();

  const gotoList = () => {
    
    dispatch(setCompletedDivisions(0));

    dispatch(setSequenceInit());
    dispatch(push(routes.LIST));
  };

  return (
    <>
      <Grid item xs={12}>
        <Typography variant="h6" align="center" color="textSecondary">
          Upload complete
        </Typography>
      </Grid>
      <Grid item xs={12}>
        <Typography paragraph>
          Good news, your upload completed successfully. Please be aware, it can
          take varying amounts of time before you'll see the imagery online. 
        </Typography>
        <Typography paragraph>
          It
          can take up to 72 hours for images to be processed and published
          Mapillary. It can take up to 1 week for images to be processed and
          published Google Maps. You can see the status on the sequence list
          page. Keep the app open, and you'll be able to check the progress of
          uploads on each service.
        </Typography>
        <Typography paragraph>
          You'll see a green tick icon on the sequence list page when the publishing
          process completes.
        </Typography>
      </Grid>
      <Grid item xs={12}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={gotoList}
          endIcon={<ListIcon />}
        >
          Home
        </Button>
      </Grid>
    </>
  );
}
