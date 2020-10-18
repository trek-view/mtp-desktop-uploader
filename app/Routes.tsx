/* eslint react/jsx-props-no-spreading: off */
import React from 'react';
import { Switch, Route } from 'react-router-dom';
import routes from './constants/routes.json';
import App from './containers/App';
import CratePage from './containers/Sequence/Create';
import EditPage from './containers/Sequence/Edit';
import ListPage from './containers/Sequence/List';
import LoginPage from './containers/Login';
import AboutPage from './containers/About';

export default function Routes() {
  return (
    <App>
      <Switch>
        <Route path={routes.LOGIN} component={LoginPage} />
        <Route path={routes.CREATE} component={CratePage} />
        <Route path={routes.EDIT} component={EditPage} />
        <Route path={routes.ABOUT} component={AboutPage} />
        <Route path={routes.LIST} component={ListPage} />
      </Switch>
    </App>
  );
}
