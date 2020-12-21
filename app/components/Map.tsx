import React, { useState, ReactNode, useEffect } from 'react';
import { useSelector } from 'react-redux';

import mapboxgl, { Map } from 'mapbox-gl';
import dayjs from 'dayjs';

import {
  Modal,
  ButtonGroup,
  IconButton,
  Box,
  Typography,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';

import ReactPannellum from 'react-pannellum';
import { makeStyles } from '@material-ui/core/styles';

import ChevronLeftRoundedIcon from '@material-ui/icons/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@material-ui/icons/ChevronRightRounded';
import DeleteForeverIcon from '@material-ui/icons/DeleteForever';
import { getSequenceImagePath } from '../scripts/utils';

import { IGeoPoint } from '../types/IGeoPoint';
import { selSequenceName } from '../create/slice';
import { selBasePath } from '../base/slice';

import markerImg from '../assets/images/marker.svg';
import { select } from 'async';

const useStyles = makeStyles((theme) => ({
  paper: {
    position: 'absolute',
    width: 400,
    backgroundColor: theme.palette.background.paper,
    border: '2px solid #000',
    boxShadow: theme.shadows[5],
    padding: theme.spacing(2, 4, 3),
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  },
  imageWrapper: {
    width: '100%',
    height: 250,
    backgroundSize: '100%',
  }
}));

interface Props {
  points: IGeoPoint[];
  showPopup?: boolean;
  height?: number;
  onDelete?: CallableFunction | null;
  id?: string;
}

interface State {
  isopen: boolean;
  selected: number;
  showMessage: boolean;
}

mapboxgl.accessToken = process.env.MAPBOX_TOKEN;

export default function MapBox(props: Props) {
  const { points, height, showPopup, onDelete, id } = props;
  const seqname = useSelector(selSequenceName);
  const name = id || seqname;
  const mapId = `map_${name.replace(/\s/g, '_')}`;
  const [state, setState] = useState<State>({
    isopen: false,
    selected: 0,
    showMessage: false,
    // zoom: 22,
  });
  const [selectedCount, setSelectedCount] = useState(1);

  const [map, setMap] = useState<Map | null>(null);

  map?.addControl(new mapboxgl.NavigationControl({
    showCompass: false,
    showZoom: true
  }), 'bottom-right');

  const classes = useStyles();
  const filteredpoints = points.filter(
    (point: IGeoPoint) => point.MAPLatitude && point.MAPLongitude
  );

  const basepath = useSelector(selBasePath);

  const centerPoint = () => {
    if (filteredpoints.length) {
      const centerIdx = Math.floor(filteredpoints.length / 2);
      const centerpoint = filteredpoints[centerIdx];
      return [centerpoint.MAPLongitude, centerpoint.MAPLatitude];
    }
    return [51.5, -0.09];
  };

  const showPhoto = (idx: number) => {
    setState({
      isopen: true,
      selected: idx,
      showMessage: false,
    });
    changeSelectedCount();
  };

  const nextImage = () => {
    setState({
      ...state,
      showMessage: false,
      selected: (state.selected + 1) % filteredpoints.length,
    });
    changeSelectedCount();
  };

  const prevImage = () => {
    setState({
      ...state,
      showMessage: false,
      selected:
        (filteredpoints.length + state.selected - 1) % filteredpoints.length,
    });
    changeSelectedCount();
  };

  const changeSelectedCount = () => {
    setSelectedCount((selectedCount + 1) % 15);
  }

  const handleClose = () => {
    setState({
      ...state,
      isopen: false,
      showMessage: false,
    });
  };

  // const getpath = (idx: number) => {
  //   return getSequenceImagePath(
  //     name,
  //     filteredpoints[idx.toString()].Image,
  //     basepath
  //   );
  // };

  const getpath = (point: IGeoPoint) => {
    var stringImage = getSequenceImagePath(
      name,
      point.Image,
      basepath
    );
    return stringImage;
  };

  const removePhoto = () => {
    if (onDelete) {
      setState({
        ...state,
        showMessage: true,
      });
      onDelete(filteredpoints[state.selected.toString()].id);
    }
  };

  const get2dpath = (idx: number) => {
    const path = getSequenceImagePath(
      name,
      filteredpoints[idx.toString()].Image,
      basepath
    );
    return path.replace(/\\/g, '/');
  };

  const photos: ReactNode[] = filteredpoints.map(
    (point: IGeoPoint, idx: number) => {
      let difftime = 0;
      if (idx < filteredpoints.length - 1) {
        difftime = dayjs(filteredpoints[idx + 1].GPSDateTime).diff(
          dayjs(point.GPSDateTime),
          'second'
        );
      }
      return (
        <>
          <div style={{ marginBottom: '5px' }}>
            <Typography variant="caption" display="block">
              {`File Name: ${point.Image}`}
            </Typography>
            <Typography variant="caption" display="block">
              {`GPS Time: ${point.GPSDateTime ? point.GPSDateTime : point.DateTimeOriginal}`}
            </Typography>
            <Typography variant="caption" display="block">
              {`Heading / Azimuth (degrees): ${point.Azimuth ? point.Azimuth.toFixed(2) : 0
                }`}
            </Typography>
            <Typography variant="caption" display="block">
              {`Distance to next photo (meters): ${point.Distance ? point.Distance.toFixed(2) : 0
                }`}
            </Typography>
            <Typography variant="caption" display="block">
              {`Time to next photo (seconds): ${difftime}`}
            </Typography>
          </div>
          {point.equirectangular && (
            <ReactPannellum
              key={point.Image}
              style={{ width: '100%', height: 250 }}
              imageSource={getpath(point)}
              id={`image_${point.Image}`}
              sceneId={point.Image}
              config={{
                autoLoad: true,
              }}
            />
          )}
          {!point.equirectangular && (
            <div
              className={classes.imageWrapper}
              style={{
                backgroundImage: `url(${get2dpath(idx)})`,
              }}
            />
          )}
        </>
      );
    }
  );

  const modalBody = (
    <div className={classes.paper}>
      {state.selected >= 0 && photos.length && (
        <>
          <Box mb={1}>
            <ButtonGroup>
              <IconButton onClick={prevImage}>
                <ChevronLeftRoundedIcon />
              </IconButton>
              <IconButton onClick={nextImage}>
                <ChevronRightRoundedIcon />
              </IconButton>
              {onDelete && (
                <IconButton onClick={removePhoto} color="secondary">
                  <DeleteForeverIcon />
                </IconButton>
              )}
            </ButtonGroup>
            {onDelete && state.showMessage && (
              <Alert severity="success">
                This photo have been removed successfully.
              </Alert>
            )}
          </Box>
          <Box>{photos[state.selected]}</Box>
        </>
      )}
    </div>
  );

  useEffect(() => {
    if (map) {
      const markerImgId = 'custom-marker';
      if (!map.hasImage(markerImgId)) {
        const img = new Image(36, 36);
        img.onload = () => map.addImage(markerImgId, img);
        img.src = markerImg;
      }

      const lineSourceId = 'route_source';
      const routeSourceData = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: filteredpoints.map((point) => {
            return [point.MAPLongitude, point.MAPLatitude];
          }),
        },
      };
      if (map.getSource(lineSourceId)) {
        map.getSource(lineSourceId).setData(routeSourceData);
      } else {
        map.addSource(lineSourceId, {
          type: 'geojson',
          data: routeSourceData,
        });
      }
      if (!map.getLayer('route')) {
        map.addLayer({
          id: 'route',
          type: 'line',
          source: 'route_source',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#28a745',
            'line-width': 2,
          },
        });
      }

      const markerSourceId = 'maker_source';
      const markerSourceData = {
        type: 'FeatureCollection',
        features: filteredpoints.map((point: IGeoPoint, idx: number) => {
          return {
            type: 'Feature',
            properties: {
              rotate: point.Azimuth,
              index: idx,
            },
            geometry: {
              type: 'Point',
              coordinates: [point.MAPLongitude, point.MAPLatitude],
            },
          };
        }),
      };
      if (map.getSource(markerSourceId)) {
        map.getSource(markerSourceId).setData(markerSourceData);
      } else {
        map.addSource(markerSourceId, {
          type: 'geojson',
          data: markerSourceData,
        });
      }

      const markerSymoblId = 'marker';
      if (!map.getLayer(markerSymoblId)) {
        map.addLayer({
          id: markerSymoblId,
          type: 'symbol',
          source: markerSourceId,
          layout: {
            'icon-image': markerImgId,
            'icon-size': 0.8,
            'icon-allow-overlap': true,
            'icon-rotate': ['get', 'rotate'],
          },
        });
        map.on('click', markerSymoblId, (e) => {
          const bbox = [
            [e.point.x - 5, e.point.y - 5],
            [e.point.x + 5, e.point.y + 5],
          ];

          const features = map.queryRenderedFeatures(bbox, {
            layers: [markerSymoblId],
          });
          if (features.length) {
            showPhoto(features[0].properties.index);
          }
        });
      }
    }
  }, [filteredpoints, map, name, showPopup]);

  useEffect(() => {
    console.log(selectedCount)
    if (selectedCount === 14 || !map) {
      const newMap = new mapboxgl.Map({
        container: mapId,
        style: 'mapbox://styles/mapbox/streets-v9',
        center: map ? map.getCenter() : centerPoint(),
        zoom: map ? [map.getZoom()] : [16],
      });

      newMap.scrollZoom.enable();
      newMap.dragPan.enable();
      newMap.dragRotate.enable();

      newMap.on('load', (e) => {
        setMap(newMap);
      });
    }
  }, [selectedCount]);

  return (
    <div>
      {points.length && (
        <>
          <div
            id={mapId}
            style={{ width: '100%', height: `${height.toString()}px` }}
          />
          <Modal open={state.isopen} onClose={handleClose}>
            {modalBody}
          </Modal>
        </>
      )}
    </div>
  );
}

MapBox.defaultProps = {
  height: 350,
  showPopup: true,
  onDelete: null,
  id: null,
};
