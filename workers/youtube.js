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
 * Worker for dealing with invalid youtube videos
 */
module.exports = function(expireTime, model, done) {
    return model.find({enabled : true, type : 'youtube', _sort : { $gte : new Date() - 3600 * 6 * 1000}}, function(err, items) {
        if (!items || !items.length) {
            return done(null, internals.count);
        }

        L('Youtube is dealing with ' + items.length + ' items..');
        internals.count.total = items.length;

        return Async.eachLimit(items, 5, function(doc, next) {
            var option = {
                "timeout"   : 10000,
                'uri'       : 'https://www.googleapis.com/youtube/v3/videos?id=' + doc.data + '&key=' + process.env.YOUTUBE_API_KEY + '&part=status',
                "headers"   : {
                    "User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.94 Safari/537.36",
                    "gzip":false
                }
            };

            return Request(option, function(err, res, body) {
                if (err) {
                    internals.count.errors++;
                    L('Error in youtube', err.message);
                    return next();
                }

                var json = JSON.parse(body || {});

                if (!json || !json.items || json.items.length < 1 || json.items[0].status.embeddable === false) {
                    var newSort = ((+Date.now()) - expireTime);
                    internals.count.removed++;
                    L(doc.data, ' is not embeddable', newSort);
                    doc.set('_sort', newSort.toString());
                    
                    return doc.save(function(err, res) {
                        if (err) {
                            L('ERROR WHEN UPDATING YOUTUBE', err.message);
                        }

                        return next(null, res);
                    });
                }

                return next();
            });
        }, function(err) {
            if (err) {
                console.log('ERROR IN YOUTUBE', err);
            }

            return done(null, internals.count);
        });
    });
};
