/* eslint global-require: off, no-console: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `yarn build` or `yarn build-main`, this file is compiled to
 * `./app/main.prod.js` using webpack. This gives us some performance wins.
 */
import { app, BrowserWindow, shell, Menu, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import eventsLoader, { sendTokenFromUrl } from './scripts/events_loader';

import { sendToClient } from './scripts/utils';

import { Octokit } from "@octokit/rest";

const electron = require('electron');

const repository = '';
var owner = 'trek-view';
var repo = 'mtp-desktop-uploader';
var excludes = 'draft';

const octokit = new Octokit();
import DownloadManager from "electron-download-manager";

DownloadManager.register({ downloadFolder: app.getPath("downloads") });

let mainWindow: BrowserWindow | null = null;

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

if (
  process.env.NODE_ENV === 'development' ||
  process.env.DEBUG_PROD === 'true'
) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS', 'REDUX_DEVTOOLS'];

  return Promise.all(
    extensions.map((name) => installer.default(installer[name], forceDownload))
  ).catch(console.log);
};

let latestVersion = '';

const checkForUpdate = async () => {
  console.log("Start checking for updates...");
  try {
    if (repository) {
      [owner, repo] = repository.split("/");
    }
    var releases = await octokit.repos.listReleases({
      owner: owner,
      repo: repo,
    });
    releases = releases.data;
    if (excludes.includes('prerelease')) {
      releases = releases.filter((x: { prerelease: boolean; }) => x.prerelease != true);
    }
    if (excludes.includes('draft')) {
      releases = releases.filter((x: { draft: boolean; }) => x.draft != true);
    }
    if (releases.length) {

      latestVersion = releases[0].tag_name.substring(1);
      console.log('Latest release version: ' + latestVersion);
      const appVersion = require('./package.json').version;
      console.log('Current version: ' + appVersion);
      var cmp = require('semver-compare');
      if (cmp(latestVersion, appVersion) > 0)
        return releases[0].tag_name;
    } else {
      console.log('No valid releases');
      return '';
    }
  }
  catch (error) {
    console.log(error.message);
    return '';
  }
};

let downloadAssetUrl = '';
let downloadFileName = '';

const getDownloadAssetUrl = async (tagName: string) => {
  console.log("Start getting a latest release version download url based on the operating system...");
  try {
    var result = await octokit.repos.getReleaseByTag({
      owner: owner,
      repo: repo,
      tag: tagName,
    });
    if (result.data !== undefined && result.data.assets !== undefined && result.data.assets.length > 0) {
      if (process.platform === 'linux') {
        downloadAssetUrl = result.data.assets[0].browser_download_url;
        downloadFileName = result.data.assets[0].name;
      } else if (process.platform === 'freebsd'
        || process.platform === 'aix'
        || process.platform === 'openbsd'
        || process.platform === 'sunos') {
        downloadAssetUrl = result.data.assets[1].browser_download_url;
        downloadFileName = result.data.assets[1].name;
      } else if (process.platform === 'darwin') {
        downloadAssetUrl = result.data.assets[2].browser_download_url;
        downloadFileName = result.data.assets[2].name;
      } else if (process.platform === 'win32') {
        downloadAssetUrl = result.data.assets[3].browser_download_url;
        downloadFileName = result.data.assets[3].name;
      } else {
        console.log('Cannot find specific release for current operating system.');
        return false;
      }
      return true;
    } else {
      console.log('No valid releases');
      return false;
    }
  }
  catch (error) {
    console.log(error.message);
    return false;
  }
}

const downloadLatestVersion = async () => {
  console.log("Start downloading a latest release...");
  try {
    DownloadManager.download({ url: downloadAssetUrl }, function (error: any) {
      if (error) {
        console.log(error);
        return;
      }
      let downloadedFilePath = '';
      if (process.platform === 'win32') {
        downloadedFilePath = app.getPath("downloads") + '\\' + downloadFileName;
      } else {
        downloadedFilePath = app.getPath("downloads") + '/' + downloadFileName;
      }

      console.log("Download completed: " + downloadedFilePath);
      const options = {
        type: 'question',
        buttons: ['Install'],
        defaultId: 0,
        title: 'Install an update',
        message: 'Download completed. Please install it.',
        detail: '',
      };

      var result = dialog.showMessageBoxSync(mainWindow, options);
      if (result == 0) {
        installNewUpdate(downloadedFilePath);
      }
    });
  }
  catch (error) {
    console.log(error.message);
    return;
  }
};

const installNewUpdate = (filePath: string) => {
  if (process.platform === 'win32') {
    var child = require('child_process').execFile;
    child(filePath, function (error: any) {
      if (error) {
        console.error(error);
        return;
      }
      app.quit();
    });
  } else if (process.platform === 'darwin') {
    const { exec } = require("child_process");
    exec('hdiutil attach ' + filePath, (error: { message: any; }, stdout: any, stderr: any) => {
      if (error) { return; }
      if (stderr) { return; }
      const imageName = 'Map the Paths Uploader ' + latestVersion;
      exec('cp -R "/Volumes/' + imageName + '/Map the Paths Uploader.app" /Applications', (error2: { message2: any; }, stdout2: any, stderr2: any) => {
        if (error2) { return; }
        if (stderr2) { return; }
        exec('open -a "Map the Paths Uploader"', () => {
          app.quit();
        });
      });
    });
  }
};

const createWindow = async () => {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  ) {
    await installExtensions();
  }

  const menu = Menu.buildFromTemplate([
    {
      label: 'Home',
      click() {
        sendToClient(mainWindow, 'home_page');
      },
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Community Support',
          click() {
            shell.openExternal('https://campfire.trekview.org/c/support/8');
          },
        },
        {
          label: 'Map the Paths Web',
          click() {
            shell.openExternal('https://www.mapthepaths.com');
          },
        },
        {
          label: 'Source Code',
          click() {
            shell.openExternal('https://github.com/trek-view/mtp-desktop-uploader');
          },
        },
      ]
    },
    {
      label: 'View',
      submenu: [{ role: 'reload' }, { label: 'custom reload' }],
    },
    {
      label: "Edit",
      submenu: [
        { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
        { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
      ]
    },
    {
      label: 'About',
      click() {
        sendToClient(mainWindow, 'about_page');
      },
    },
  ]);

  Menu.setApplicationMenu(menu);

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false,
      enableRemoteModule: true,
    },
  });

  mainWindow.loadURL(`file://${__dirname}/app.html`);

  mainWindow.webContents.on('did-finish-load', async () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
      mainWindow.focus();

      fs.readFile(path.join(path.join((electron.app || electron.remote.app).getAppPath(), '../'), 'tokens.json'), 'utf8', (error, data) => {
        if (error) {
          console.log(error);
          return;
        }
        var tokens = JSON.parse(data);
        tokens.google = { token: null, waiting: true };
        fs.writeFileSync(path.join(path.join((electron.app || electron.remote.app).getAppPath(), '../'), 'tokens.json'),
          JSON.stringify(tokens)
        );
      });

      // mainWindow.toggleDevTools(); // temporary added for developing purpose
      var tagName = await checkForUpdate();
      if (tagName != undefined && tagName != '' && tagName.length > 0) {
        var hasAsset = await getDownloadAssetUrl(tagName);
        if (hasAsset === true) {
          const options = {
            type: 'question',
            buttons: ['Download', 'Later'],
            defaultId: 0,
            title: 'New release available!',
            message: 'Do you want to download new version?',
            detail: 'Map the Paths Uploader now has a new release ' + tagName + ' available. Download progress will run in background.',
          };

          var result = dialog.showMessageBoxSync(mainWindow, options);
          if (result == 0) {
            await downloadLatestVersion();
          }
        }
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('close', async (e) => {
    e.preventDefault();
    sendToClient(mainWindow, 'close_app');
  });

  eventsLoader(mainWindow, app);

  // await sendTokenFromUrl(mainWindow, 'app.mtp.desktop://test/#access_token=abc');
};

/**
 * Add event listeners...
 */

app.on('open-url', (event, protocolLink: string) => {
  event.preventDefault();
  sendTokenFromUrl(
    mainWindow,
    protocolLink,
    path.join(app.getAppPath(), '../')
  );
});

app.setAsDefaultProtocolClient('app.mtp.desktop');

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  // if (process.platform !== 'darwin') {
  app.quit();
  // }
});

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', async (event, commandLine) => {
    event.preventDefault();
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      commandLine.forEach((l: string) => {
        if (l.indexOf('app.mtp.desktop:') >= 0) {
          sendTokenFromUrl(mainWindow, l);
        }
      });
    }
  });

  // Create myWindow, load the rest of the app, etc...
  app.whenReady().then(createWindow).catch(console.error);
}

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) createWindow();
});
