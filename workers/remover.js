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
 * Worker for dealing with removing old stuff 
 */
module.exports = function(expireTime, model, done) {
    return model.find({enabled : true, _sort : { $lte : new Date() - expireTime}}, function(err, items) {
        if (!items || !items.length) {
            return done(null, internals.count);
        }

        L('Expirer is dealing with ' + items.length + ' items..');
        internals.count.total = items.length;

        return Async.eachLimit(items, 3, function(doc, next) {
            if (doc._sort < new Date() - expireTime) {
                internals.count.removed++;
                doc.enabled = false;

                return doc.save(function(err, res) {
                    if (err) {
                        L('ERROR IN REMOVER', err.message);
                    }

                    return next(null, res);
                });
            }

            return next();
        }, function(err) {
            if (err) {
                console.log('ERROR IN EXPIRER', err);
            }

            return done(null, internals.count);
        });
    });
};
