const {
    getSassVariablesAsync
    , getSassVariablesStringAsync
    , getSassVariablesStringSync
    , getSassVariablesSync
    , toJSON
} = require('node-sass-variables');
const fs = require('fs');
const path = require('path');

const filepath = './test1.scss';

const scss = fs.readFileSync(filepath, 'utf8');

function tests(tmp) {
    const foo = {
        type: 'SassNumber'
        , unit: ''
        , value: 1
    };
    const barWaldo = {
        type: 'SassNumber'
        , unit: 'px'
        , value: 10
    };
    const quxFred = {
        type: 'SassString'
        , value: 'string'
    };
    const quuxCorge = {
        type: 'SassList'
        , value: [
            {
                type: 'SassNumber'
                , unit: 'px'
                , value: 10
            }
            , {
                type: 'SassNumber'
                , unit: 'px'
                , value: 20
            }
            , {
                type: 'SassNumber'
                , unit: 'px'
                , value: 30
            }
            , {
                type: 'SassString'
                , value: 'none'
            }
            , {
                type: 'SassString'
                , value: 'string'
            }
        ]
    };
    const xyzzyBla = {
        type: 'SassBoolean'
        , value: true
    };
    const thudBlubb = {
        type: 'SassBoolean'
        , value: false
    };

    expect(tmp.$foo).toStrictEqual(foo);
    expect(tmp.$bar).toStrictEqual(barWaldo);
    expect(tmp.$baz).toStrictEqual({
        type: 'SassString'
        , value: 'none'
    });
    expect(tmp.$qux).toStrictEqual(quxFred);
    expect(tmp.$quux).toStrictEqual(quuxCorge);
    expect(tmp.$corge).toStrictEqual(quuxCorge);
    expect(tmp.$grault).toStrictEqual({
        type: 'SassMap'
        , value: {
            garply: {
                type: 'SassMap'
                , value: {
                    waldo: barWaldo
                }
            }
            , fred: quxFred
        }
    });
    expect(tmp.$garply).toStrictEqual({
        type: 'SassColor'
        , value: {
            r: 0
            , g: 0
            , b: 0
            , a: 1
            , hex: '#000000'
        }
    });
    expect(tmp.$waldo).toStrictEqual({
        type: 'SassColor'
        , value: {
            r: 255
            , g: 255
            , b: 255
            , a: 1
            , hex: '#ffffff'
        }
    });
    expect(tmp.$fred).toStrictEqual({
        type: 'SassColor'
        , value: {
            r: 255
            , g: 255
            , b: 255
            , a: 0.5
            , hex: '#ffffff'
        }
    });
    expect(tmp.$plugh).toStrictEqual(foo);
    expect(tmp.$xyzzy).toStrictEqual(xyzzyBla);
    expect(tmp.$thud).toStrictEqual(thudBlubb);
    expect(tmp.$bla).toStrictEqual(xyzzyBla);
    expect(tmp.$blubb).toStrictEqual(thudBlubb);
}

describe('node-sass-variables', () => {
    it('should get the variables synchronously from given Sass/Scss content', done => {
        tests(getSassVariablesStringSync(scss, {}, { loadPaths: [__dirname] }))
        done();
    });

    it('should get the variables synchronously from given a filepath', done => {
        tests(getSassVariablesSync(filepath))
        done();
    });

    it('should get the variables asynchronously from given Sass/Scss content', done => {
        getSassVariablesStringAsync(scss, {}, { loadPaths: [__dirname] }).then(tmp => {
            tests(tmp);
            done();
        });
    });

    it('should get the variables asynchronously from given a filepath', done => {
        getSassVariablesAsync(filepath).then(tmp => {
            tests(tmp);
            done();
        });
    });

    it('should return an unknown value, if the value is no instance of a known type, but contains a value key', () => {
        expect(toJSON({ value: 1 })).toStrictEqual({ type: 'unknown', value: 1 });
    });

    it('should return an unknown value, if the value is no instance of a known type', () => {
        expect(toJSON(1)).toStrictEqual(undefined);
    });
});
