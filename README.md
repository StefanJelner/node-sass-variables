# Access Sass/Scss variables in node.js

Unlike many other approaches to access Sass/Scss variables in node.js, this approach tries to reach this goal with a minimum of code. The extraction is actually done with a neat, little trick, by first accessing all variables with PostCSS, then generating some extra Sass code to invoke a custom Sass function with the collected variables. In the custom Sass function the final parsed variables are made accessible. No parsing, no fiddling, no rocket science!

## Installation

```sh
npm install node-sass-variables
```

## Synchronous use

```js
const { getSassVariablesStringSync, getSassVariablesSync } = require('node-sass-variables');

console.log(getSassVariablesStringSync('$foo: 42;'));

console.log(getSassVariablesSync('path/to/my/scss-file.scss'));
```

## Asynchronous use

```js
const { getSassVariablesAsync, getSassVariablesStringAsync } = require('node-sass-variables');

getSassVariablesStringAsync('$foo: 42;').then(console.log);

getSassVariablesAsync('path/to/my/scss-file.scss').then(console.log);
```

## Options

```js
getSassVariablesAsync(filepath, postCssConfig, sassConfig, safeKeyWord)
getSassVariablesStringAsync(sass, postCssConfig, sassConfig, safeKeyWord)
getSassVariablesStringSync(sass, postCssConfig, sassConfig, safeKeyWord)
getSassVariablesSync(filepath, postCssConfig, sassConfig, safeKeyWord)
```

### `sass` (string, mandatory) or `filepath` (string, mandatory)

This is Sass/Scss content or the path to the Sass/Scss-file.

### `postCssConfig` (object, optional, default = `{}`)

This is some additional configuration for PostCSS if needed.

### `sassConfig` (object, optional, default = `{}`)

This is some additional configuration for Sass if needed.

### `safeKeyWord` (string, optional, default = `__nirvana__`)

This is a keyword, which is used internally by this module to pass the variables to a custom Sass function. It is assumed highly unlikely that someone uses the default keyword in Sass as a variable name or function name. For the rare case that there might be a collision, the value can be overridden.

## External files

Variables from files which are imported with `@use` or `@import` are useable, but not automatically exported, because only the variables declared in the Sass/Scss content or the `filepath` are exported.

This module tries its best to determine, where external files might be located and tries to import them. If this fails, it might be necessary to provide your own `loadPaths` or `importers` to the `sassConfig`.

## License

This software is brought to you with :heart: **love** :heart: from Dortmund and offered and distributed under the ISC license. See `LICENSE.txt` and [Wikipedia](https://en.wikipedia.org/wiki/ISC_license) for more information.
