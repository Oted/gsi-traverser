var Async       = require('async');

var EXPIRE_TIME = 1000 * 60 * 60 * 240;

var Models      = require('gsi-models'),
    models      = new Models();

require('dotenv').load();

var internals   = {};

/**
 *  Init function
 */
console.log('Connecting to databse...');

process.env.NODE_ENV= 'test';

//connect to the database and go
models.connect(function() {
    console.log('Getting all enabled items...');
    
    models.model['item'].find({enabled : true}, {}, {sort : '_sort'}, function(err, docs) {
        if (err) {
            throw err;
        }
        
        return internals.process(docs, internals.processed);
    });
});

/**
 *  The flow
 *
 *  Each of the workers get a chunk of the fetched data
 *  Then each of the workers does what it needs to do with them
 */
internals.process = function(items, done) {
    console.log('Processing ' + items.length + ' items...');

    return Async.parallel({
        'twitch' : function(next) {
            var targets = items.filter(function(item) { 
                return item.type === 'twitch'
            });

            return require('./workers/twitch.js')(EXPIRE_TIME, targets, next);
        },
        '404' : function(next) {
            var targets = items.filter(function(item) { 
                return item._sort > new Date() - 3600 * 6 * 1000 && (
                       item.type === "img" || 
                       item.type === "gif" ||
                       item.type === "video" ||
                       item.type === "vine" ||
                       item.type === "soundcloud"
                   )
            });

            return require('./workers/404.js')(EXPIRE_TIME, targets, next);
        },
        'youtube' : function(next) {
            var targets = items.filter(function(item) { 
                return item._sort > new Date() - 3600 * 6 * 1000 &&
                       item.type === "youtube";
            });

            return require('./workers/youtube.js')(EXPIRE_TIME, targets, next);
        },
        'expire' : function(next) {
            var targets = items.filter(function(item) {
                return item._sort < new Date() - EXPIRE_TIME; 
            });

            return require('./workers/remover.js')(EXPIRE_TIME, targets, next);
        },
        'word-analyzer' : function(next) {
            var targets = items.filter(function(item) {
                return item._sort > new Date() - 3600 * 60 * 1000 &&
                       item.type !== "twitch";
            });

            return require('./workers/word-analyzer.js')(models.model['title-fragment'], targets, next);
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
    console.log('PROCESSED!');
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
