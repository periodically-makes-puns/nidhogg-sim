A template for a simple FFXIV sim using the xiv-mech-sim library.

Run `git init` and then `npm install` to get everything set up. `git init` should be run first so the pre-commit hook for the code formatter can get set up by `npm install`.

After everything is set up, you can start a development server with `npm start`. For deployment, run `npx rollup -c` and then serve the resulting 'dist' directory as a static page.

The main things set up in this template are:

- The [Prettier](https://prettier.io) code formatter, plus a pre-commit hook that uses [husky](https://github.com/typicode/husky) and [lint-staged](https://github.com/okonet/lint-staged) to run Prettier automatically
- [Web Dev Server](https://modern-web.dev/blog/introducing-modern-web/#web-dev-server) with node-resolve for development
- [Rollup](https://rollupjs.org/) with node-resolve and minifier plugins for building the non-dev version
- And of course, xiv-mech-sim is set up as a dependency

The files in src/ provide a simple skeleton sim to build on, though of course it's possible to organize your sim in other ways.
