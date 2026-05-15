# EchoAI Mobile

React Native TypeScript app for the EchoAI iOS and Android product.

This app is the mobile product surface. Existing native `apps/ios` and `apps/android` code remains reference material for platform capability modules until each capability is exposed behind the typed React Native interfaces in `src/native`.

## Structure

- `src/App.tsx` - React Native app shell.
- `src/protocol` - exports the shared EchoAI mobile protocol contract.
- `src/native` - TypeScript interfaces for native modules.
- `src/screens` - mobile screens.

## Scripts

Dependencies are declared in `package.json`. Install them from the root workspace once `apps/mobile` is added to the workspace package list.

