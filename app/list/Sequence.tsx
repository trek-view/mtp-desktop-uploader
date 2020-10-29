import React from 'react';

import IconButton from '@material-ui/core/IconButton';

import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import EditIcon from '@material-ui/icons/Edit';

import {
  Box,
  Typography,
  Grid,
  Avatar,
  Chip,
  Badge,
  Tooltip,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';

import { useSelector } from 'react-redux';
import DoneIcon from '@material-ui/icons/Done';
import ErrorIcon from '@material-ui/icons/Error';
import PublishIcon from '@material-ui/icons/Publish';
import Map from '../components/Map';

import transportType from '../../transports/transport-methods.json';

import { selIntegrations, selBasePath } from '../base/slice';
import { getSequenceBasePath } from '../scripts/utils';

import { Summary } from '../types/Result';

const useStyles = makeStyles((theme) => ({
  container: {
    borderRadius: '15px',
    padding: '10px',
    boxShadow: 'rgba(114, 126, 140, 0.5) 0px 0px 10px 0px',
    marginBottom: '20px',
    position: 'relative',
  },
  information: {
    display: 'flex',
    flexWrap: 'wrap',
    '& > *': {
      margin: theme.spacing(0.5),
    },
  },
  contentWrapper: {
    paddingTop: '40px',
  },
  map: {
    height: '200px',
  },
  buttonWrapper: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  destinationWrapper: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
}));

interface Props {
  data: Summary;
  displayName: string;
  onDelete: CallableFunction;
  onSelect: CallableFunction;
}

export default function Sequence({ data, displayName, onDelete, onSelect }: Props) {
  const classes = useStyles();

  const basepath = useSelector(selBasePath);

  const { type, method, points, destination } = data;

  const methodIcons = transportType[type].children.reduce(
    (obj: any, item: any) => {
      obj[item.type] = item.icon;
      return obj;
    },
    {}
  );

  const integrations = useSelector(selIntegrations);

  const destinationIcons = Object.keys(destination).map((key: string) => {
    let icon = <DoneIcon color="primary" fontSize="small" />;
    let message = 'Published';
    if (
      typeof destination[key] === 'string' &&
      destination[key].startsWith('Error')
    ) {
      icon = <ErrorIcon color="error" fontSize="small" />;
      message = destination[key].replace('Error:', '');
    } else if (
      (typeof destination[key] === 'string' && destination[key] !== '') ||
      typeof destination[key] === 'number'
    ) {
      icon = <PublishIcon color="action" fontSize="small" />;
      message = 'Uploading';
    }

    if (integrations[key] && integrations[key].logo) {
      return (
        <Tooltip title={message} key={key}>
          <Badge
            overlap="circle"
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            badgeContent={icon}
          >
            <Avatar src={`data:image/png;base64, ${integrations[key].logo}`} />
          </Badge>
        </Tooltip>
      );
    }
    return <div key={key} />;
  });

  return (
    <Grid xs={12} item className={classes.container}>
      <div className={classes.buttonWrapper}>
        {Object.keys(destination).length === 0 && (
          <IconButton onClick={() => onSelect(data.id)} color="primary">
            <EditIcon />
          </IconButton>
        )}

        <IconButton onClick={() => onDelete(data.name)} color="secondary">
          <DeleteOutlineIcon />
        </IconButton>
      </div>

      <Grid container alignItems="center" spacing={3}>
        <Grid xs={4} item>
          <Map points={points} height={220} id={data.name} />
        </Grid>
        <Grid xs={8} item>
          <Grid container className={classes.contentWrapper}>
            <Grid xs={7} item>
              <Typography variant="h5" color="primary" align="left">
                {displayName}
              </Typography>
              <div className={classes.destinationWrapper}>
                {destinationIcons}
              </div>
              <Typography color="primary" align="left" paragraph>
                {data.description}
              </Typography>
              <Box className={classes.information}>
                <div>
                  <span className={transportType[type].icon} />
                  <Typography color="primary" variant="caption" display="block">
                    {data.type}
                  </Typography>
                </div>
                <div>
                  <span className={methodIcons[method]} />
                  <Typography color="primary" variant="caption" display="block">
                    {data.method}
                  </Typography>
                </div>
                <div>
                  <span className="fas fa-people-arrows" />
                  <Typography color="primary" variant="caption" display="block">
                    {data.total_km.toFixed(3)}
                    <span>KM</span>
                  </Typography>
                </div>
                <div>
                  <span className="far fa-images" />
                  <Typography color="primary" variant="caption" display="block">
                    {points.length}
                  </Typography>
                </div>
                <div>
                  <span className="fas fa-stopwatch" />
                  <Typography color="primary" variant="caption" display="block">
                    {data.time}
                  </Typography>
                </div>
              </Box>
            </Grid>
            <Grid xs={5} item>
              <div className={classes.information}>
                {data.tags.map((tag: string) => (
                  <Chip key={tag} label={tag} color="primary" size="small" />
                ))}
              </div>
              <Typography color="primary" variant="caption" display="block">
                <span>Captured:</span>
                {data.captured}
              </Typography>

              <Typography color="primary" variant="caption" display="block">
                <span>Created:</span>
                {data.created}
              </Typography>
            </Grid>
          </Grid>
          <Grid container alignItems="center" spacing={3}>
            <Grid xs={12} item>
              <Typography variant="caption" color="secondary">
                {basepath ? getSequenceBasePath(data.name, basepath) : ''}
              </Typography>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Grid>
  );
}
