const fs = require('fs');
const sass = require('sass');
const path = require('path');
const postcss = require('postcss');
const postcssScss = require('postcss-scss');
const color = require('color');

// it is assumed, that this variable or function name is never used in Sass.
const defaultSafeKeyWord = '__nirvana__';

/**
 * Loads the Sass file content
 * 
 * @param {string} filepath path to the Sass file
 * @returns Sass file content
 */
function getSassContent(filepath) { return fs.readFileSync(filepath, 'utf8'); }

/**
 * Gets the safe keyword for the variable and custom Sass function
 * 
 * @param {string} safeKeyWord optional user provided safe keyword
 * @returns safe keyword
 */
function getSafeKeyword(safeKeyWord) { return typeof safeKeyWord !== 'undefined' ? safeKeyWord : defaultSafeKeyWord; }

/**
 * Gets PostCSS configuration with some configurations which are necessary to run this module
 * 
 * @param {postcss.ProcessOptions} postCssConfig user provided PostCSS configuration
 * @returns PostCSS configuration
 */
function getPostCssConfig(postCssConfig) {
    return {
        ...typeof postCssConfig !== 'undefined' ? postCssConfig : {}
        , ...{ from: undefined , syntax: postcssScss }
    };
}

/**
 * Finds the Sass variables in the given content. IMPORTANT! It only finds the variables in the given content, but not
 * in files imported with `@use` or `@import`. (But variables from the imported files can be used.)  
 * 
 * @param {postcss.Result} processed Sass processed by PostCSS
 * @returns variable declarations for use with the Sass custom function
 */
function findSassVariables(processed) {
    const root = processed.root;
    const sassVariables = [];

    root.walkDecls(/^\$/, decl => {
		if (decl.parent === root) {
			const sassVariable = `'${decl.prop}':${decl.prop}`;
			
			if (sassVariables.indexOf(sassVariable) === -1) { sassVariables.push(sassVariable); }
		}
	});

    return sassVariables;
}

/**
 * Generates the line of code, which is necessary for passing the variables to the Sass custom function.
 * 
 * @param {string} sassContent the Sass content which the user provided
 * @param {postcss.Result} processed Sass processed by PostCSS
 * @param {string} safeKeyWord safe keyword for the variable and custom Sass function
 * @returns the Sass content with an additional call to the Sass custom function
 */
function getNewSassContent(sassContent, processed, safeKeyWord) {
    return `${sassContent};$${safeKeyWord}:${safeKeyWord}((${findSassVariables(processed).join(',')}));`;
}

/**
 * Removes quotes from strings, which are surrounded by quotes.
 * 
 * @param {string} key string, which is surrounded by quotes
 * @returns string, which is not surrounded by quotes any more
 */
function sanitizeKey(key) { return key.replace(/^(["'])(.+)\1$/, '$2'); }

/**
 * Transforms the parsed variables passed to the Sass custom function into a regular JSON object.
 * 
 * @param {sass.Value} value parsed variables passed to the Sass custom function
 * @returns regular JSON object
 */
function toJSON(value) {
    if (value instanceof sass.SassMap) {
        const obj = value.contents.toObject();

        return {
            type: 'SassMap'
            , value: Object.keys(obj).reduce((result, key) => ({
                ...result,
                [sanitizeKey(key)]: toJSON(obj[key])
            }), {})
        };
    }
    if (value instanceof sass.SassList) {
        return { type: 'SassList', value: value.asList.toArray().map(item => toJSON(item)) };
    }
    if (value instanceof sass.SassColor) {
        return {
            type: 'SassColor'
            , value: {
                r: value.red
                , g: value.green
                , b: value.blue
                , a: value.alpha
                , hex: color.rgb(value.red, value.green, value.blue).hex().toLowerCase()
            }
        };
    }
    if (value instanceof sass.SassString) { return { type: 'SassString', value: value.text }; }
    if (value instanceof sass.SassBoolean) { return { type: 'SassBoolean', value: value.value }; }
    if (value instanceof sass.SassNumber) {
        return { type: 'SassNumber', value: value.value, unit: value.numeratorUnits.toArray().join('') };
    }
    if (typeof value === 'object' && 'value' in value) { return { type: 'unknown', value: value.value }; }

    return undefined;
}

/**
 * Determines which syntax an imported file uses by its filename extension
 * 
 * @param {string} filename filename of the imported file
 * @returns css, indented or scss
 */
function getSyntax(filename) {
    switch(path.parse(filename).ext) {
        case '.css': { return 'css'; }
        case '.sass': { return 'indented'; }
        default: { return 'scss'; }
    }
}

/**
 * Gets Sass configuration with some configurations which are necessary to run this module
 * 
 * @param {sass.StringOptions} sassConfig user provided Sass configuration
 * @param {(sassVariables: Record<string, any>) => void} callback callback function which handles the final variables
 * @param {string} safeKeyWord safe keyword for the variable and custom Sass function
 * @returns Sass configuration
 */
function getSassConfig(sassConfig, callback, safeKeyWord) {
    return {
        ...typeof sassConfig !== 'undefined' ? sassConfig : {}
        , ...{
            functions: {
                ...typeof sassConfig !== 'undefined' && 'functions' in sassConfig ? sassConfig.functions : {}
                , [`${safeKeyWord}($sassVariables)`]: function([sassVariables]) {
                    callback(toJSON(sassVariables).value);

                    // return anything to not cause an error here.
                    return new sass.SassString('\'\'');
                }
            }
            , importers: [{
                canonicalize(url) {
                    const parsed = path.parse(url);

                    return [
                        `${parsed.base}.sass`
                        , `${parsed.base}.scss`
                        , `_${parsed.base}.sass`
                        , `_${parsed.base}.scss`
                    ].reduce(
                        (result, base) => {
                            const filename = path.resolve(`${__dirname}/${parsed.dir}/${base}`);

                            if (fs.existsSync(filename)) { return new URL(filename); }

                            return result;
                        }
                        , null
                    );
                }
                , load(canonicalUrl) {
                    const filename = decodeURI(canonicalUrl.href);

                    return { contents: getSassContent(filename), syntax: getSyntax(filename) };
                }
            }].concat(...typeof sassConfig !== 'undefined' && 'importers' in sassConfig ? sassConfig.importers : [])
        }
    };
}

/**
 * Adds the `loadPaths` configuration based on the path of the Sass file to a given Sass configuration.
 * 
 * @param {string} filepath path to the Sass file
 * @param {sass.StringOptions} sassConfig user provided Sass configuration
 * @returns Sass configuration with `loadPaths` configuration
 */
function getLoadPaths(filepath, sassConfig) {
    return {
        ...typeof sassConfig !== 'undefined' ? sassConfig : {}
        , ...{
            loadPaths: [path.dirname(filepath)].concat(
                ...typeof sassConfig !== 'undefined' && 'loadPaths' in sassConfig ? sassConfig.loadPaths : []
            )
        }
    }
}

/**
 * Gets the Sass variables from a given path to a Sass file synchronously.
 * 
 * @param {string} filepath path to the Sass file
 * @param {postcss.ProcessOptions} postCssConfig user provided PostCSS configuration
 * @param {sass.StringOptions} sassConfig user provided Sass configuration
 * @param {string} safeKeyWord safe keyword for the variable and custom Sass function
 * @returns an object containing the Sass variables
 */
function getSassVariablesSync(filepath, postCssConfig, sassConfig, safeKeyWord) {
    filepath = path.resolve(filepath);

    return getSassVariablesStringSync(
        getSassContent(filepath)
        , postCssConfig
        , getLoadPaths(filepath, sassConfig)
        , safeKeyWord
    );
}

/**
 * Gets the Sass variables from a given path to a Sass file asynchronously.
 * 
 * @param {string} filepath path to the Sass file
 * @param {postcss.ProcessOptions} postCssConfig user provided PostCSS configuration
 * @param {sass.StringOptions} sassConfig user provided Sass configuration
 * @param {string} safeKeyWord safe keyword for the variable and custom Sass function
 * @returns a Promise which resolves an object containing the Sass variables
 */
function getSassVariablesAsync(filepath, postCssConfig, sassConfig, safeKeyWord) {
    filepath = path.resolve(filepath);

    return getSassVariablesStringAsync(
        getSassContent(filepath)
        , postCssConfig
        , getLoadPaths(filepath, sassConfig)
        , safeKeyWord
    )
}

/**
 * Gets the Sass variables from a given Sass content as a string synchronously.
 * 
 * @param {string} sassContent Sass content as a string
 * @param {postcss.ProcessOptions} postCssConfig user provided PostCSS configuration
 * @param {sass.StringOptions} sassConfig user provided Sass configuration
 * @param {string} safeKeyWord safe keyword for the variable and custom Sass function
 * @returns an object containing the Sass variables
 */
function getSassVariablesStringSync(sassContent, postCssConfig, sassConfig, safeKeyWord) {
    let sassVariables = {};
    safeKeyWord = getSafeKeyword(safeKeyWord);

    sass.compileString(
        getNewSassContent(
            sassContent
            // PostCSS process function returns a promise or css for synchronous use.
            , postcss().process(sassContent, getPostCssConfig(postCssConfig)).sync()
            , safeKeyWord
        )
        , getSassConfig(
            sassConfig
            , sassVariables2 => {
                // very ugly mutation of the variable in the outer scope here. but it is the only simple solution.
                sassVariables = sassVariables2;
            }
            , safeKeyWord
        )
    );

    return sassVariables;
}

/**
 * Gets the Sass variables from a given Sass content as a string asynchronously.
 * 
 * @param {string} sassContent Sass content as a string
 * @param {postcss.ProcessOptions} postCssConfig user provided PostCSS configuration
 * @param {sass.StringOptions} sassConfig user provided Sass configuration
 * @param {string} safeKeyWord safe keyword for the variable and custom Sass function
 * @returns a Promise which resolves an object containing the Sass variables
 */
function getSassVariablesStringAsync(sassContent, postCssConfig, sassConfig, safeKeyWord) {
    return new Promise(resolve => {
        safeKeyWord = getSafeKeyword(safeKeyWord);

        postcss().process(sassContent, getPostCssConfig(postCssConfig)).then(processed => {
            sass.compileStringAsync(
                getNewSassContent(sassContent, processed, safeKeyWord)
                , getSassConfig(
                    sassConfig
                    , sassVariables => resolve(sassVariables)
                    , safeKeyWord
                )
            // do nothing!
            ).then(() => {});
        });
    });
}

module.exports = {
    getSassVariablesAsync
    , getSassVariablesStringAsync
    , getSassVariablesStringSync
    , getSassVariablesSync
    , ...typeof jest !== 'undefined' && { toJSON }
};
