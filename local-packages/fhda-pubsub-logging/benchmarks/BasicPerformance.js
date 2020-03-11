'use strict';
let Logger = require('../src/Index')();

suite('Basic logging performance', function() {

    // Configure suite
    set('mintime', 5000);

    bench('Logging at error level', function() {
        Logger.error('Hello world from the error level', {
            error: new Error('Sample error'),
            hello: 'world',
            nestedHello: {
                nestedWorld: 'nestedBuenoDias'
            }
        });
    });

    bench('Logging at warn level', function() {
        Logger.warn('Hello world from the warn level', {
            hello: 'world',
            nestedHello: {
                nestedWorld: 'nestedBuenoDias'
            }
        });
    });

    bench('Logging at info level', function() {
        Logger.info('Hello world from the info level', {
            hello: 'world',
            nestedHello: {
                nestedWorld: 'nestedBuenoDias'
            }
        });
    });

});

