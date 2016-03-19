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
 *  Twitch handler
 */
module.exports = function(expireTime, model, done) {
    L('Twitch is working...');

    return model.find({enabled : true, type : 'twitch'}, function(err, items) {
        if (!items || !items.length) {
            return done(null, internals.count);
        }

        L('Twitch is dealing with ' + items.length + ' items..');
        internals.count.total = items.length;
        items = items.slice(0,1);

        return Async.eachLimit(items, 3, function(doc, next) {
           var streamName = doc.toObject().data.split('/').slice(-2,-1).join(''),
                option = {
                    "timeout"   : 10000,
                    "uri"       : 'https://api.twitch.tv/kraken/streams/' + streamName,
                    "headers"   : {
                        "User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.94 Safari/537.36",
                        "gzip":false
                    }
                };

            return Request(option, function(err, res, body) {
                if (err) {
                    internals.errors++;
                    return next();
                }

                //if any of these update the doc
                if (res.statusCode !== 200 || !JSON.parse(body).stream) {
                    internals.count.removed++;
                    L('Removing twich item ' + streamName);

                    return doc.remove(function(err, res) {
                        if (err) {
                            L('ERROR WHEN REMOVING TWITCH', err.message);
                        }

                        return next(null, res);
                    });
                }

                return next();
            });
        }, function(err) {
            if (err) {
                console.log('ERROR IN TWITCH', err);
            }

            return done(null, internals.count);
        });
    });
}
