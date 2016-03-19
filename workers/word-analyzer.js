var Async       = require('async');
var Request     = require('request');
var L           = require('../lib/logger.js');
var _           = require('lodash');
var forbidden   = require('../data/forbidden_words.json');
var forced      = require('../data/forced_words.json');
var Natural     = require('natural');
var tokenizer   = new Natural.WordTokenizer();

var internals = {
    'accepted_threshold' : 5,
    'word_origin_hash' : {},
    'all_words_occurrences' : {},
    'accepted_words' : {},
    'max_occurrance' : 0,
    'hash_map' : null,
    'count' : {
        'total' : 0,
        'added' : 0,
        'updated' : 0,
        'pushed' : 0
    }
};

/**
 * Worker for analyzing the words in the titles
 */
module.exports = function(models, done) {
    return models.model['item'].find({enabled : true, _sort : { $gte : new Date() - 3600 * 24 * 1000 * 2}}, function(err, items) {
        if (!items || !items.length) {
            return done(null, internals.count);
        }

        L('Analyzer is dealing with ' + items.length + ' items..');

        items.forEach(function(item) {
            var title = item.toObject().title.trim().toLowerCase();

            var words = tokenizer.tokenize(title).filter(function(word) {
                return word.length >= 3;
            });

            words.forEach(function(word) {
                if (forbidden[word]) {
                    return;
                }

                if (!internals.word_origin_hash[word]) {
                    internals.word_origin_hash[word] = {};
                }

                internals.word_origin_hash[word][item.id] = item;

                if (internals.all_words_occurrences[word]) {
                    internals.all_words_occurrences[word]++;

                    if ((internals.all_words_occurrences[word] >= internals.accepted_threshold) || forced[word]) {
                        internals.accepted_words[word] = internals.all_words_occurrences[word];

                        if (internals.all_words_occurrences[word] > internals.max_occurrance) {
                            internals.max_occurrance = internals.all_words_occurrences[word];
                        }
                    }
                } else {
                    internals.all_words_occurrences[word] = 1;
                }
            });
        });

        return Async.eachLimit(Object.keys(internals.accepted_words), 3, function(word, next) {
            if (forbidden[word]) {
                return next();
            }

            models.model['title-fragment'].findOne({ string: word }, function (err, doc) {
                if (err) {
                    return next(err);
                }

                internals.count.total++;

                if (!doc) {
                    internals.count.added++;
                    L('Creating fragment ' + word + ' with score ' + internals.accepted_words[word] * word.length);
                    var newFragment = new models.model['title-fragment']({
                        'string' : word,
                        'count' : 1,
                        'total' : internals.accepted_words[word],
                        'median' : internals.accepted_words[word],
                        'score' : 0
                    });

                    return newFragment.save(function(err, newDoc) {
                        return addFragmentToItems(newDoc, word, next);
                    });
                }

                internals.count.updated++;

                L('Updating fragment ' + word + ' with score ' + internals.accepted_words[word] * word.length);

                //normalize this
                //add a count of source?
                doc.count++;
                doc.total += internals.accepted_words[word];
                doc.median = doc.total / doc.count;
                doc.score  = (internals.accepted_words[word] - doc.median) / internals.accepted_words[word];

                return doc.save(function(err, newDoc) {
                    return addFragmentToItems(newDoc, word, next);
                });
            });
        }, function(err) {
            if (err) {
                return done(err);
            }

            return done(null, internals.count);
        });
    });
};

/**
 *  Add the word to
 */
var addFragmentToItems = function(doc, word, done) {
    return Async.eachLimit(Object.keys(internals.word_origin_hash[word]), 3, function(id, next) {
        var item = internals.word_origin_hash[word][id];

        if (item.fragments.indexOf(word) < 0) {
            internals.count.pushed++;
            L('Adding fragment ' + word + ' to ' + item.title);
            item.fragments.push(word);
        }

        return item.save(function(err, res) {
            if (err) {
                L('ERROR WHEN ADDING FRAGMENT TO ITEM', err);
            }

            return next(null, res);
        });
    }, done);
};
