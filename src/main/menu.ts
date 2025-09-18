import {
  app,
  Menu,
  shell,
  BrowserWindow,
  MenuItemConstructorOptions,
} from 'electron';

interface DarwinMenuItemConstructorOptions extends MenuItemConstructorOptions {
  selector?: string;
  submenu?: DarwinMenuItemConstructorOptions[] | Menu;
}

export default class MenuBuilder {
  mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  buildMenu(): Menu {
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true'
    ) {
      this.setupDevelopmentEnvironment();
    }

    const template =
      process.platform === 'darwin'
        ? this.buildDarwinTemplate()
        : this.buildDefaultTemplate();

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    return menu;
  }

  setupDevelopmentEnvironment(): void {
    this.mainWindow.webContents.on('context-menu', (_, props) => {
      const { x, y } = props;

      Menu.buildFromTemplate([
        {
          label: 'Inspect element',
          click: () => {
            this.mainWindow.webContents.inspectElement(x, y);
          },
        },
      ]).popup({ window: this.mainWindow });
    });
  }

  buildDarwinTemplate(): MenuItemConstructorOptions[] {
    const subMenuAbout: DarwinMenuItemConstructorOptions = {
      label: 'Electron',
      submenu: [
        {
          label: 'About ElectronReact',
          selector: 'orderFrontStandardAboutPanel:',
        },
        { type: 'separator' } as MenuItemConstructorOptions,
        { label: 'Services', submenu: [] },
        { type: 'separator' } as MenuItemConstructorOptions,
        {
          label: 'Hide ElectronReact',
          accelerator: 'Command+H',
          selector: 'hide:',
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          selector: 'hideOtherApplications:',
        },
        { label: 'Show All', selector: 'unhideAllApplications:' },
        { type: 'separator' } as MenuItemConstructorOptions,
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    };
    const subMenuViewDev: MenuItemConstructorOptions = {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'Command+R',
          click: () => {
            this.mainWindow.webContents.reload();
          },
        },
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            const wasFullScreen = this.mainWindow.isFullScreen();

            // Notify renderer BEFORE changing fullscreen state
            this.mainWindow.webContents.send('fullscreen-changing', !wasFullScreen);

            // Small delay to let renderer prepare for transition
            setTimeout(() => {
              this.mainWindow.setFullScreen(!wasFullScreen);

              // Confirm the change after window state changes
              setTimeout(() => {
                this.mainWindow.webContents.send('fullscreen-changed', !wasFullScreen);
              }, 50); // Slightly longer delay for state confirmation
            }, 16);
          },
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+Command+I',
          click: () => {
            this.mainWindow.webContents.toggleDevTools();
          },
        },
        { type: 'separator' } as MenuItemConstructorOptions,
        {
          label: 'Zoom In',
          accelerator: 'Command+Plus',
          click: () => {
            const currentZoom = this.mainWindow.webContents.getZoomFactor();
            this.mainWindow.webContents.setZoomFactor(Math.min(currentZoom + 0.1, 3.0));
          },
        },
        {
          label: 'Zoom Out',
          accelerator: 'Command+-',
          click: () => {
            const currentZoom = this.mainWindow.webContents.getZoomFactor();
            this.mainWindow.webContents.setZoomFactor(Math.max(currentZoom - 0.1, 0.5));
          },
        },
        {
          label: 'Reset Zoom',
          accelerator: 'Command+0',
          click: () => {
            this.mainWindow.webContents.setZoomFactor(1.0);
          },
        },
      ],
    };
    const subMenuViewProd: MenuItemConstructorOptions = {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            const wasFullScreen = this.mainWindow.isFullScreen();

            // Notify renderer BEFORE changing fullscreen state
            this.mainWindow.webContents.send('fullscreen-changing', !wasFullScreen);

            // Small delay to let renderer prepare for transition
            setTimeout(() => {
              this.mainWindow.setFullScreen(!wasFullScreen);

              // Confirm the change after window state changes
              setTimeout(() => {
                this.mainWindow.webContents.send('fullscreen-changed', !wasFullScreen);
              }, 50); // Slightly longer delay for state confirmation
            }, 16);
          },
        },
        { type: 'separator' } as MenuItemConstructorOptions,
        {
          label: 'Zoom In',
          accelerator: 'Command+Plus',
          click: () => {
            const currentZoom = this.mainWindow.webContents.getZoomFactor();
            this.mainWindow.webContents.setZoomFactor(Math.min(currentZoom + 0.1, 3.0));
          },
        },
        {
          label: 'Zoom Out',
          accelerator: 'Command+-',
          click: () => {
            const currentZoom = this.mainWindow.webContents.getZoomFactor();
            this.mainWindow.webContents.setZoomFactor(Math.max(currentZoom - 0.1, 0.5));
          },
        },
        {
          label: 'Reset Zoom',
          accelerator: 'Command+0',
          click: () => {
            this.mainWindow.webContents.setZoomFactor(1.0);
          },
        },
      ],
    };
    const subMenuWindow: DarwinMenuItemConstructorOptions = {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'Command+M',
          selector: 'performMiniaturize:',
        },
        { label: 'Close', accelerator: 'Command+W', selector: 'performClose:' },
        { type: 'separator' } as MenuItemConstructorOptions,
        { label: 'Bring All to Front', selector: 'arrangeInFront:' },
      ],
    };

    const subMenuView =
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true'
        ? subMenuViewDev
        : subMenuViewProd;

    return [subMenuAbout, subMenuView, subMenuWindow];
  }

  buildDefaultTemplate() {
    const templateDefault = [
      {
        label: '&File',
        submenu: [
          {
            label: '&Open',
            accelerator: 'Ctrl+O',
          },
          {
            label: '&Close',
            accelerator: 'Ctrl+W',
            click: () => {
              this.mainWindow.close();
            },
          },
        ],
      },
      {
        label: '&View',
        submenu:
          process.env.NODE_ENV === 'development' ||
          process.env.DEBUG_PROD === 'true'
            ? [
                {
                  label: '&Reload',
                  accelerator: 'Ctrl+R',
                  click: () => {
                    this.mainWindow.webContents.reload();
                  },
                },
                {
                  label: 'Toggle &Full Screen',
                  accelerator: 'F11',
          click: () => {
            const wasFullScreen = this.mainWindow.isFullScreen();

            // Notify renderer BEFORE changing fullscreen state
            this.mainWindow.webContents.send('fullscreen-changing', !wasFullScreen);

            // Small delay to let renderer prepare for transition
            setTimeout(() => {
              this.mainWindow.setFullScreen(!wasFullScreen);

              // Confirm the change after window state changes
              setTimeout(() => {
                this.mainWindow.webContents.send('fullscreen-changed', !wasFullScreen);
              }, 50); // Slightly longer delay for state confirmation
            }, 16);
          },
                },
                {
                  label: 'Toggle &Developer Tools',
                  accelerator: 'Alt+Ctrl+I',
                  click: () => {
                    this.mainWindow.webContents.toggleDevTools();
                  },
                },
                { type: 'separator' } as MenuItemConstructorOptions,
                {
                  label: 'Zoom &In',
                  accelerator: 'Ctrl+Plus',
                  click: () => {
                    const currentZoom = this.mainWindow.webContents.getZoomFactor();
                    this.mainWindow.webContents.setZoomFactor(Math.min(currentZoom + 0.1, 3.0));
                  },
                },
                {
                  label: 'Zoom &Out',
                  accelerator: 'Ctrl+-',
                  click: () => {
                    const currentZoom = this.mainWindow.webContents.getZoomFactor();
                    this.mainWindow.webContents.setZoomFactor(Math.max(currentZoom - 0.1, 0.5));
                  },
                },
                {
                  label: '&Reset Zoom',
                  accelerator: 'Ctrl+0',
                  click: () => {
                    this.mainWindow.webContents.setZoomFactor(1.0);
                  },
                },
              ]
            : [
                {
                  label: 'Toggle &Full Screen',
                  accelerator: 'F11',
          click: () => {
            const wasFullScreen = this.mainWindow.isFullScreen();

            // Notify renderer BEFORE changing fullscreen state
            this.mainWindow.webContents.send('fullscreen-changing', !wasFullScreen);

            // Small delay to let renderer prepare for transition
            setTimeout(() => {
              this.mainWindow.setFullScreen(!wasFullScreen);

              // Confirm the change after window state changes
              setTimeout(() => {
                this.mainWindow.webContents.send('fullscreen-changed', !wasFullScreen);
              }, 50); // Slightly longer delay for state confirmation
            }, 16);
          },
                },
                { type: 'separator' } as MenuItemConstructorOptions,
                {
                  label: 'Zoom &In',
                  accelerator: 'Ctrl+Plus',
                  click: () => {
                    const currentZoom = this.mainWindow.webContents.getZoomFactor();
                    this.mainWindow.webContents.setZoomFactor(Math.min(currentZoom + 0.1, 3.0));
                  },
                },
                {
                  label: 'Zoom &Out',
                  accelerator: 'Ctrl+-',
                  click: () => {
                    const currentZoom = this.mainWindow.webContents.getZoomFactor();
                    this.mainWindow.webContents.setZoomFactor(Math.max(currentZoom - 0.1, 0.5));
                  },
                },
                {
                  label: '&Reset Zoom',
                  accelerator: 'Ctrl+0',
                  click: () => {
                    this.mainWindow.webContents.setZoomFactor(1.0);
                  },
                },
              ],
      },
    ];

    return templateDefault;
  }
}
