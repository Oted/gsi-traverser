var Async       = require('async');
var Request     = require('request');
var L           = require('../lib/logger.js');

var internals = {
    'count' : {
        'removed' : 0,
        'errors' : 0
    }
};

/**
 * Handler for 404 images n gifs
 */
module.exports = function(expireTime, items, done) {
    if (!items || !items.length) {
        return done(null, internals.count);
    }

    L('404 is dealing with ' + items.length + ' items..');
    internals.count.total = items.length;

    return Async.eachLimit(items, 5, function(doc, next) {
        var option = {
            "timeout"   : 10000,
            'uri'       : doc.toObject().data,
            "headers"   : {
                "User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.94 Safari/537.36",
                "gzip":false
            }
        };

        return Request(option, function(err, res, body) {
            if (err) {
                internals.count.errors++;
                L('Error in 404',err.message);
                return next();
            }

            if (res.statusCode !== 200) {
                var newSort = ((+Date.now()) - expireTime);
                L('Removing item ' + doc.toObject().data  +' bacause ' + res.statusCode);
                doc.set('_sort', newSort.toString());
                internals.count.removed++;
                return doc.save(next);
            }

            return next();
        });
    }, function(err) {
        if (err) {
            console.log('ERROR IN 404', err);
        }

        return done(null, internals.count);
    });
};
