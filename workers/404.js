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
module.exports = function exports404(expireTime, model, done) {
    return model.find({ enabled : true,
                        type : {$in : ['img', 'gif', 'video', 'vine', 'soundcloud']},
                        _sort : {$gte : new Date() - 3600 * 1000 * 6}}, function find(err, items) {
        if (!items || !items.length) {
            return done(null, internals.count);
        }

        L('404 is dealing with ' + items.length + ' items..');
        internals.count.total = items.length;

        return Async.eachLimit(items, 5, function (doc, next) {
            var url = doc.toObject().data + '';

            if (url.indexOf('http://https://') === 0) {
                doc.data = url.replace('http://https://', 'http://');
                return doc.save(function(err, res) {
                    if (err) {
                        L('ERROR IN 404', err.message);
                    }

                    L('Fixed ' + doc.data + ' to ' + res.data);
                    return next();
                });
            }

            return Request({
                "timeout"   : 10000,
                'uri'       : url,
                'method'    : "HEAD"
            }, function gotRes(err, res) {
                if (err) {
                    if (err.message.indexOf('ENOTFOUND') > -1) {
                        var newSort = ((+Date.now()) - expireTime);
                        L('Removing item ' + doc.toObject().data  +' bacause ' + err.message);
                        doc.set('_sort', newSort.toString());
                        internals.count.removed++;

                        return doc.save(function save(iErr, iRes) {
                            if (err) {
                                L('ERROR IN 404', err.message);
                            }

                            return next();
                        });
                    }

                    internals.count.errors++;
                    L('Error in 404',err.message);
                    return next();
                }

                if (res.statusCode !== 200) {
                    var newSort = ((+Date.now()) - expireTime);
                    L('Removing item ' + doc.toObject().data  +' bacause ' + res.statusCode);
                    doc.set('_sort', newSort.toString());
                    internals.count.removed++;

                    return doc.save(function save(iErr, res) {
                        if (iErr) {
                            L('ERROR IN 404', iErr.message);
                        }

                        return next();
                    });
                }

                return next();
            });
        }, function (err) {
            if (err) {
                console.log('ERROR IN 404', err);
            }

            return done(null, internals.count);
        });
    });
};
