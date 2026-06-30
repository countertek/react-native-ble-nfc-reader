# Use npm As The Primary Native Package

Public distribution for this Expo and React Native native module goes through `npmjs.com`, with GitHub Actions handling CI and release publishing. GitHub Packages and JSR stay off the required consumer install path because GitHub Packages adds auth and scoped-package friction, and JSR does not cover native module installation.
