# Access Sass/Scss variables in node.js

Unlike many other approaches to access Sass/Scss variables in node.js, this approach tries to reach this goal with a minimum of code. The extraction is actually done with a neat, little trick, by first accessing all variables with PostCSS, then generating some extra Sass code to invoke a custom Sass function with the collected variables. In the custom Sass function the final parsed variables are made accessible. No parsing, no fiddling, no rocket science!

## Installation

```bash
npm install node-sass-variables
```

## Synchronous use

```
const { getSassVariablesSync } = require('node-sass-variables');

console.log(getSassVariablesSync('path/to/my/scss-file.scss'));
```

## Asynchronous use

```
const { getSassVariablesAsync } = require('node-sass-variables');

getSassVariablesAsync('path/to/my/scss-file.scss').then(console.log);
```

## Options

`getSassVariablesSync` and `getSassVariablesAsync` accept the same options:

```
getSassVariablesSync(filepath, postCssConfig, sassConfig, safeKeyWord)
```

### `filepath` (string)

This is the path to the Sass/Scss-file.

### `postCssConfig` (object, optional, default = `{}`)

This is some additional configuration for PostCSS if needed.

### `sassConfig` (object, optional, default = `{}`)

This is some additional configuration for Sass if needed.

### `safeKeyWord` (string, optional, default = `__nirvana__`)

This is a keyword, which is used internally by this module to pass the variables to a custom Sass function. It is assumed highly unlikely that someone uses the default keyword in Sass as a variable name or function name. For the rare case that there might be a collision, the value can be overridden.
