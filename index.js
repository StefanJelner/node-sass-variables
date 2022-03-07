const fs = require('fs');
const sass = require('sass');
const path = require('path');
const postcss = require('postcss');
const postcssScss = require('postcss-scss');
const color = require('color');

// it is assumed, that this variable or function name is never used in Sass.
const defaultSafeKeyWord = '__nirvana__';

function getSassContent(filepath) { return fs.readFileSync(filepath, 'utf8'); }

function getSafeKeyword(safeKeyWord) { return typeof safeKeyWord !== 'undefined' ? safeKeyWord : defaultSafeKeyWord; }

function getPostCssConfig(postCssConfig) {
    return {
        ...typeof postCssConfig !== 'undefined' ? postCssConfig : {}
        , ...{ from: undefined , syntax: postcssScss }
    };
}

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

function getNewSassContent(sassContent, processed, safeKeyWord) {
    return `${sassContent};$${safeKeyWord}:${safeKeyWord}((${findSassVariables(processed).join(',')}));`;
}

function sanitizeKey(key) { return key.replace(/^(["'])(.+)\1$/, '$2'); }

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
    if ('value' in value) { return { type: 'unknown', value: value.value }; }

    return undefined;
}

function getSyntax(filename) {
    switch(path.parse(filename).ext) {
        case '.css': { return 'css'; }
        case '.sass': { return 'indented' }
        default: { return 'scss'; }
    }
}

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

function getSassVariablesSync(filepath, postCssConfig, sassConfig, safeKeyWord) {
    filepath = path.resolve(filepath);

    return getSassVariablesStringSync(
        getSassContent(filepath)
        , postCssConfig
        , getLoadPaths(filepath, sassConfig)
        , safeKeyWord
    );
}

function getSassVariablesAsync(filepath, postCssConfig, sassConfig, safeKeyWord) {
    filepath = path.resolve(filepath);

    return getSassVariablesStringAsync(
        getSassContent(filepath)
        , postCssConfig
        , getLoadPaths(filepath, sassConfig)
        , safeKeyWord
    )
}

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
};
