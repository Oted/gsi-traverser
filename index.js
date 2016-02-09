var Async       = require('async');

var EXPIRE_TIME = 1000 * 60 * 60 * 240;

var Models      = require('gsi-models'),
    models      = new Models(),
    Logger      = require('./lib/Logger.js');

require('dotenv').load();

var internals   = {};

/**
 *  Init function
 */
console.log('Connecting to databse...');

process.env.NODE_ENV= 'test';

//connect to the database and go
models.connect(function() {
    return internals.process(internals.processed);
});

/**
 *  The flow
 *
 *  Each of the workers get a chunk of the fetched data
 *  Then each of the workers does what it needs to do with them
 */
internals.process = function(done) {
    return Async.series({
        'twitch' : function(next) {
            return require('./workers/twitch.js')(EXPIRE_TIME, models.model['item'], next);
        },
        '404' : function(next) {
            return require('./workers/404.js')(EXPIRE_TIME, models.model['item'], next);
        },
        'youtube' : function(next) {
            return require('./workers/youtube.js')(EXPIRE_TIME, models.model['item'], next);
        },
        'expire' : function(next) {
            return require('./workers/remover.js')(EXPIRE_TIME, models.model['item'], next);
        },
        'word-analyzer' : function(next) {
            return require('./workers/word-analyzer.js')(models, next);
        }
    }, done);
};

/**
 *  Done with the flow.
 */
internals.processed = function(err, result) {
    if (err) {
        throw err;
    }

    console.log(result);
    process.exit();
};

/**
 *  Save a new trending query
 */
internals.addQuery = function(query, done) {
    // return internals.addQuery({
        // 'type' : 'trending',
        // 'title' : 'Documentaries',
        // 'query' : {
            // 'enabled' : true,
            // 'title' : 'documentaries',
            // 'types' : ['youtube']
        // }
    // }, function() {
        // console.log('done', arguments);
    // })

    var q = new models.model['query'](query);
    q.save(done);
};
